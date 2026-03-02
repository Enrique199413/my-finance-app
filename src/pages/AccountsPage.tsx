import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import {
    subscribeToAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
} from '../services/accounts.service';
import type { BankAccount, AccountType } from '../types';
import {
    Plus,
    Wallet,
    Pencil,
    Trash2,
    X,
    Building2,
    CreditCard,
    PiggyBank,
    Banknote,
} from 'lucide-react';
import toast from 'react-hot-toast';

const ACCOUNT_ICONS: Record<AccountType, typeof Wallet> = {
    checking: Building2,
    savings: PiggyBank,
    credit: CreditCard,
    cash: Banknote,
};

const BANKS = ['BBVA', 'Revolut', 'Santander', 'CaixaBank', 'Banamex', 'Banorte', 'HSBC', 'Otro'];
const CURRENCIES = ['EUR', 'MXN', 'USD', 'GBP'];

export default function AccountsPage() {
    const { t } = useTranslation();
    const { family } = useFamily();
    const { user } = useAuth();
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
    const [loading, setLoading] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [bank, setBank] = useState('');
    const [type, setType] = useState<AccountType>('checking');
    const [currency, setCurrency] = useState('EUR');
    const [balance, setBalance] = useState('0');

    useEffect(() => {
        if (!family) return;
        const unsub = subscribeToAccounts(family.id, setAccounts);
        return () => unsub();
    }, [family]);

    const resetForm = () => {
        setName('');
        setBank('');
        setType('checking');
        setCurrency('EUR');
        setBalance('0');
        setEditingAccount(null);
        setShowForm(false);
    };

    const openEdit = (account: BankAccount) => {
        setEditingAccount(account);
        setName(account.name);
        setBank(account.bank);
        setType(account.type);
        setCurrency(account.currency);
        setBalance(String(account.balance));
        setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!name.trim() || !bank.trim() || !family || !user) return;
        setLoading(true);
        try {
            if (editingAccount) {
                await updateAccount(editingAccount.id, {
                    name: name.trim(),
                    bank: bank.trim(),
                    type,
                    currency,
                    balance: parseFloat(balance) || 0,
                });
                toast.success('✅');
            } else {
                await createAccount({
                    familyId: family.id,
                    name: name.trim(),
                    bank: bank.trim(),
                    type,
                    currency,
                    balance: parseFloat(balance) || 0,
                    ownerId: user.uid,
                });
                toast.success('✅');
            }
            resetForm();
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('common.confirm') + '?')) return;
        try {
            await deleteAccount(id);
            toast.success('🗑️');
        } catch (err) {
            toast.error(String(err));
        }
    };

    const totalBalance = accounts.reduce((sum, a) => {
        if (a.currency === (family?.currency || 'EUR')) return sum + a.balance;
        return sum;
    }, 0);

    const formatCurrency = (amount: number, curr: string = 'EUR') => {
        return new Intl.NumberFormat(curr === 'MXN' ? 'es-MX' : 'es-ES', {
            style: 'currency',
            currency: curr,
        }).format(amount);
    };

    if (!family) return null;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{t('accounts.title')}</h1>
                    <p className="text-text-muted-light dark:text-text-muted-dark text-sm mt-1">
                        {t('dashboard.totalBalance')}: <span className="font-semibold text-primary-600 dark:text-primary-400">{formatCurrency(totalBalance, family.currency)}</span>
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={18} />
                    {t('accounts.addAccount')}
                </button>
            </div>

            {/* Accounts grid */}
            {accounts.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 text-center">
                    <Wallet size={48} className="text-primary-300 dark:text-primary-700 mb-4" />
                    <p className="text-text-muted-light dark:text-text-muted-dark">{t('accounts.noAccounts')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {accounts.map((account) => {
                        const Icon = ACCOUNT_ICONS[account.type] || Wallet;
                        return (
                            <div key={account.id} className="card card-hover group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                            <Icon size={20} className="text-primary-600 dark:text-primary-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{account.name}</h3>
                                            <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{account.bank} · {t(`accounts.${account.type}`)}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEdit(account)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-900/30">
                                            <Pencil size={14} className="text-gray-400" />
                                        </button>
                                        <button onClick={() => handleDelete(account.id)} className="p-1.5 rounded-lg hover:bg-danger-500/10">
                                            <Trash2 size={14} className="text-danger-400" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(account.balance, account.currency)}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal form */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => resetForm()}>
                    <div className="card w-full max-w-md animate-scale-in space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">
                                {editingAccount ? t('common.edit') : t('accounts.addAccount')}
                            </h2>
                            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-900/30">
                                <X size={18} />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">{t('accounts.accountName')}</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Cuenta principal..."
                                className="input-field"
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('accounts.bank')}</label>
                                <select
                                    value={bank}
                                    onChange={(e) => setBank(e.target.value)}
                                    className="input-field"
                                >
                                    <option value="">---</option>
                                    {BANKS.map((b) => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('accounts.type')}</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value as AccountType)}
                                    className="input-field"
                                >
                                    {(['checking', 'savings', 'credit', 'cash'] as AccountType[]).map((t2) => (
                                        <option key={t2} value={t2}>{t(`accounts.${t2}`)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('common.currency')}</label>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="input-field"
                                >
                                    {CURRENCIES.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('accounts.balance')}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={balance}
                                    onChange={(e) => setBalance(e.target.value)}
                                    className="input-field"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={resetForm} className="btn-secondary flex-1">{t('common.cancel')}</button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !name.trim() || !bank.trim()}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {loading ? '...' : (editingAccount ? t('common.save') : t('common.create'))}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
