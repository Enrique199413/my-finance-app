import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import {
    subscribeToDebts,
    createDebt,
    updateDebt,
    deleteDebt,
    addPayment,
} from '../services/debts.service';
import { getAccountsByFamily } from '../services/accounts.service';
import type { Debt, BankAccount } from '../types';
import {
    Plus,
    CreditCard,
    Pencil,
    Trash2,
    X,
    DollarSign,
    Target,
    ArrowRight,
    Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';

const CURRENCIES = ['EUR', 'MXN', 'USD', 'GBP'];

export default function DebtsPage() {
    const { t, i18n } = useTranslation();
    const { family } = useFamily();
    const { user } = useAuth();
    const [debts, setDebts] = useState<Debt[]>([]);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Debt | null>(null);
    const [showPayment, setShowPayment] = useState<Debt | null>(null);
    const [loading, setLoading] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [paidAmount, setPaidAmount] = useState('0');
    const [interestRate, setInterestRate] = useState('0');
    const [minimumPayment, setMinimumPayment] = useState('0');
    const [currency, setCurrency] = useState('EUR');
    const [paymentType, setPaymentType] = useState<'manual' | 'auto'>('manual');
    const [autoPaymentDay, setAutoPaymentDay] = useState('');
    const [autoPaymentAccountId, setAutoPaymentAccountId] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');

    useEffect(() => {
        if (!family) return;
        const unsubDebts = subscribeToDebts(family.id, setDebts);
        
        getAccountsByFamily(family.id).then(setAccounts).catch(console.error);
        
        return () => { unsubDebts(); };
    }, [family]);

    const formatCurrency = (amount: number, curr: string = 'EUR') => {
        return new Intl.NumberFormat(curr === 'MXN' ? 'es-MX' : 'es-ES', {
            style: 'currency',
            currency: curr,
        }).format(amount);
    };

    const resetForm = () => {
        setName('');
        setTotalAmount('');
        setPaidAmount('0');
        setInterestRate('0');
        setMinimumPayment('0');
        setCurrency(family?.currency || 'EUR');
        setPaymentType('manual');
        setAutoPaymentDay('');
        setAutoPaymentAccountId('');
        setEditing(null);
        setShowForm(false);
    };

    const openEdit = (debt: Debt) => {
        setEditing(debt);
        setName(debt.name);
        setTotalAmount(String(debt.totalAmount));
        setPaidAmount(String(debt.paidAmount));
        setInterestRate(String(debt.interestRate));
        setMinimumPayment(String(debt.minimumPayment));
        setCurrency(debt.currency);
        setPaymentType(debt.paymentType || 'manual');
        setAutoPaymentDay(debt.autoPaymentDay ? String(debt.autoPaymentDay) : '');
        setAutoPaymentAccountId(debt.autoPaymentAccountId || '');
        setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!name.trim() || !totalAmount || !family || !user) return;
        setLoading(true);
        try {
            const debtData = {
                name: name.trim(),
                totalAmount: parseFloat(totalAmount),
                paidAmount: parseFloat(paidAmount) || 0,
                interestRate: parseFloat(interestRate) || 0,
                minimumPayment: parseFloat(minimumPayment) || 0,
                currency,
                paymentType,
                autoPaymentDay: paymentType === 'auto' && autoPaymentDay ? parseInt(autoPaymentDay) : undefined,
                autoPaymentAccountId: paymentType === 'auto' ? autoPaymentAccountId : undefined,
            };

            if (editing) {
                await updateDebt(editing.id, debtData);
            } else {
                await createDebt({
                    familyId: family.id,
                    ownerId: user.uid,
                    ...debtData,
                });
            }
            toast.success('✅');
            resetForm();
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    const handlePayment = async () => {
        if (!showPayment || !paymentAmount) return;
        setLoading(true);
        try {
            await addPayment(showPayment.id, showPayment.paidAmount, parseFloat(paymentAmount));
            toast.success('💰');
            setShowPayment(null);
            setPaymentAmount('');
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('common.confirm') + '?')) return;
        try {
            await deleteDebt(id);
            toast.success('🗑️');
        } catch (err) {
            toast.error(String(err));
        }
    };

    // Summary
    const totalDebt = debts.reduce((sum, d) => sum + d.totalAmount, 0);
    const totalPaid = debts.reduce((sum, d) => sum + d.paidAmount, 0);
    const totalRemaining = totalDebt - totalPaid;
    const overallProgress = totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0;

    if (!family) return null;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold">{t('debts.title')}</h1>
                    {debts.length > 0 && (
                        <p className="text-text-muted-light dark:text-text-muted-dark text-sm mt-1">
                            {i18n.language === 'es' ? 'Restante' : 'Remaining'}: <span className="font-semibold text-danger-500">{formatCurrency(totalRemaining, family.currency)}</span>
                            {' / '}
                            <span className="text-text-muted-light dark:text-text-muted-dark">{formatCurrency(totalDebt, family.currency)}</span>
                        </p>
                    )}
                </div>
                <button onClick={() => { resetForm(); setCurrency(family.currency); setShowForm(true); }} className="btn-primary flex items-center gap-2">
                    <Plus size={18} />
                    {t('debts.addDebt')}
                </button>
            </div>

            {/* Overall progress */}
            {debts.length > 0 && (
                <div className="card">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Target size={18} className="text-primary-500" />
                            <span className="text-sm font-medium">{i18n.language === 'es' ? 'Progreso total' : 'Overall Progress'}</span>
                        </div>
                        <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{overallProgress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-primary-900/30 rounded-full h-3 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500 gradient-primary"
                            style={{ width: `${Math.min(overallProgress, 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-text-muted-light dark:text-text-muted-dark">
                        <span>{i18n.language === 'es' ? 'Pagado' : 'Paid'}: {formatCurrency(totalPaid, family.currency)}</span>
                        <span>{i18n.language === 'es' ? 'Restante' : 'Remaining'}: {formatCurrency(totalRemaining, family.currency)}</span>
                    </div>
                </div>
            )}

            {/* Debts list */}
            {debts.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 text-center">
                    <CreditCard size={48} className="text-primary-300 dark:text-primary-700 mb-4" />
                    <p className="text-text-muted-light dark:text-text-muted-dark">{t('debts.noDebts')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {debts.map((debt) => {
                        const remaining = debt.totalAmount - debt.paidAmount;
                        const progress = debt.totalAmount > 0 ? (debt.paidAmount / debt.totalAmount) * 100 : 0;
                        const isPaidOff = remaining <= 0;

                        return (
                            <div key={debt.id} className={`card card-hover group ${isPaidOff ? 'opacity-60' : ''}`}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPaidOff ? 'bg-accent-100 dark:bg-accent-900/30' : 'bg-danger-100 dark:bg-danger-900/20'}`}>
                                            {isPaidOff ? <span className="text-lg">✅</span> : <CreditCard size={20} className="text-danger-500" />}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold flex items-center gap-2">
                                                {debt.name}
                                                {debt.paymentType === 'auto' && (
                                                    <span className="flex items-center text-[10px] bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded-md" title={`Cobro automático el día ${debt.autoPaymentDay}`}>
                                                        <Calendar size={10} className="mr-1" />
                                                        Día {debt.autoPaymentDay}
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                                                {debt.interestRate > 0 ? `${debt.interestRate}% APR` : i18n.language === 'es' ? 'Sin interés' : 'No interest'}
                                                {debt.minimumPayment > 0 && ` · Min: ${formatCurrency(debt.minimumPayment, debt.currency)}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEdit(debt)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-900/30">
                                            <Pencil size={14} className="text-gray-400" />
                                        </button>
                                        <button onClick={() => handleDelete(debt.id)} className="p-1.5 rounded-lg hover:bg-danger-500/10">
                                            <Trash2 size={14} className="text-danger-400" />
                                        </button>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="mb-3">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-text-muted-light dark:text-text-muted-dark">{progress.toFixed(0)}%</span>
                                        <span className="font-medium">{formatCurrency(remaining, debt.currency)}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-primary-900/30 rounded-full h-2">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${isPaidOff ? 'bg-accent-500' : 'gradient-primary'}`}
                                            style={{ width: `${Math.min(progress, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Actions */}
                                {!isPaidOff && (
                                    <button
                                        onClick={() => { setShowPayment(debt); setPaymentAmount(String(debt.minimumPayment || '')); }}
                                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors cursor-pointer"
                                    >
                                        <DollarSign size={14} />
                                        {i18n.language === 'es' ? 'Registrar pago' : 'Record Payment'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Debt Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={resetForm}>
                    <div className="card w-full max-w-md animate-scale-in space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">{editing ? t('common.edit') : t('debts.addDebt')}</h2>
                            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-900/30">
                                <X size={18} />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">{i18n.language === 'es' ? 'Nombre de la deuda' : 'Debt name'}</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Préstamo coche..." className="input-field" autoFocus />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">{i18n.language === 'es' ? 'Monto total' : 'Total amount'}</label>
                                <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="10000" className="input-field" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">{i18n.language === 'es' ? 'Ya pagado' : 'Already paid'}</label>
                                <input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="input-field" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">% APR</label>
                                <input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} className="input-field" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">{i18n.language === 'es' ? 'Pago min.' : 'Min. payment'}</label>
                                <input type="number" step="0.01" value={minimumPayment} onChange={(e) => setMinimumPayment(e.target.value)} className="input-field" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('common.currency')}</label>
                                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field">
                                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Automated Payments */}
                        <div className="pt-2 border-t border-gray-100 dark:border-primary-800/30">
                            <label className="flex items-center gap-2 mb-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={paymentType === 'auto'}
                                    onChange={(e) => setPaymentType(e.target.checked ? 'auto' : 'manual')}
                                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                                />
                                <span className="text-sm font-medium">{i18n.language === 'es' ? 'Pago automático programado' : 'Scheduled automatic payment'}</span>
                            </label>

                            {paymentType === 'auto' && (
                                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-primary-900/10 rounded-xl mb-2">
                                    <div>
                                        <label className="block text-xs font-medium mb-1">{i18n.language === 'es' ? 'Día del mes' : 'Day of month'}</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="31"
                                            value={autoPaymentDay}
                                            onChange={(e) => setAutoPaymentDay(e.target.value)}
                                            placeholder="15"
                                            className="input-field !text-sm !py-1.5"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">{i18n.language === 'es' ? 'Cuenta origen' : 'Source account'}</label>
                                        <select
                                            value={autoPaymentAccountId}
                                            onChange={(e) => setAutoPaymentAccountId(e.target.value)}
                                            className="input-field !text-sm !py-1.5"
                                        >
                                            <option value="">---</option>
                                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={resetForm} className="btn-secondary flex-1">{t('common.cancel')}</button>
                            <button onClick={handleSubmit} disabled={loading || !name.trim() || !totalAmount} className="btn-primary flex-1 disabled:opacity-50">
                                {loading ? '...' : (editing ? t('common.save') : t('common.create'))}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPayment && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowPayment(null)}>
                    <div className="card w-full max-w-sm animate-scale-in space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">💰 {i18n.language === 'es' ? 'Registrar pago' : 'Record Payment'}</h2>
                            <button onClick={() => setShowPayment(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-900/30">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                            {showPayment.name} — {i18n.language === 'es' ? 'Restante' : 'Remaining'}: <span className="font-semibold">{formatCurrency(showPayment.totalAmount - showPayment.paidAmount, showPayment.currency)}</span>
                        </p>
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('transactions.amount')}</label>
                            <input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="input-field text-xl font-bold" autoFocus />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowPayment(null)} className="btn-secondary flex-1">{t('common.cancel')}</button>
                            <button onClick={handlePayment} disabled={loading || !paymentAmount} className="btn-primary flex-1 disabled:opacity-50">
                                {loading ? '...' : <>{i18n.language === 'es' ? 'Pagar' : 'Pay'} <ArrowRight size={16} /></>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
