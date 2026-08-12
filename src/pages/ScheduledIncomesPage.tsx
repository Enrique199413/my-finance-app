import { useState, useEffect, useMemo } from 'react';
import { useFamily } from '../context/FamilyContext';
import { subscribeToScheduledIncomes, createScheduledIncome, updateScheduledIncome, deleteScheduledIncome } from '../services/scheduled-incomes.service';
import { getAccountsByFamily } from '../services/accounts.service';
import { subscribeToCategories } from '../services/categories.service';
import { getTransactionsByDateRange } from '../services/transactions.service';
import type { ScheduledIncome, BankAccount, Category, Transaction } from '../types';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { useConfirm } from '../context/ConfirmContext';
import { Plus, X, Trash2, Pencil, CheckCircle2, CircleDashed } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';

export default function ScheduledIncomesPage() {
    const { family } = useFamily();
    const { confirm } = useConfirm();

    const [incomes, setIncomes] = useState<ScheduledIncome[]>([]);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Form states
    const [name, setName] = useState('');
    const [estimatedAmount, setEstimatedAmount] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [accountId, setAccountId] = useState('');

    useEffect(() => {
        if (!family) return;
        
        const loadData = async () => {
            try {
                const accs = await getAccountsByFamily(family.id);
                setAccounts(accs);
                
                const mStart = startOfMonth(new Date());
                const mEnd = endOfMonth(new Date());
                const txs = await getTransactionsByDateRange(family.id, mStart, mEnd);
                setTransactions(txs);
            } catch (e) {
                console.error(e);
            }
        };
        
        loadData();
        const unsubIncomes = subscribeToScheduledIncomes(family.id, setIncomes);
        const unsubCats = subscribeToCategories(family.id, setCategories);
        
        return () => {
            unsubIncomes();
            unsubCats();
        };
    }, [family]);

    const formatCurrency = (amount: number, curr?: string) => {
        const c = curr || family?.currency || 'EUR';
        return new Intl.NumberFormat(c === 'MXN' ? 'es-MX' : 'es-ES', {
            style: 'currency',
            currency: c,
        }).format(amount);
    };

    const getCategoryById = (id: string) => categories.find((c) => c.id === id);
    const getAccountById = (id: string) => accounts.find((a) => a.id === id);

    const resetForm = () => {
        setName('');
        setEstimatedAmount('');
        setCategoryId('');
        setAccountId('');
        setEditingId(null);
        setShowForm(false);
    };

    const openEdit = (inc: ScheduledIncome) => {
        setEditingId(inc.id);
        setName(inc.name);
        setEstimatedAmount(String(inc.estimatedAmount));
        setCategoryId(inc.categoryId);
        setAccountId(inc.accountId);
        setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!family || !name.trim() || !estimatedAmount || !categoryId || !accountId) return;
        
        setLoading(true);
        try {
            if (editingId) {
                await updateScheduledIncome(editingId, {
                    name: name.trim(),
                    estimatedAmount: Math.abs(parseFloat(estimatedAmount)),
                    categoryId,
                    accountId
                });
                toast.success('Actualizado correctamente');
            } else {
                await createScheduledIncome({
                    familyId: family.id,
                    name: name.trim(),
                    estimatedAmount: Math.abs(parseFloat(estimatedAmount)),
                    categoryId,
                    accountId
                });
                toast.success('Creado correctamente');
            }
            resetForm();
        } catch (e) {
            toast.error('Error al guardar');
            console.error(e);
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (await confirm('¿Eliminar este ingreso programado?')) {
            try {
                await deleteScheduledIncome(id);
                toast.success('Eliminado');
            } catch (e) {
                toast.error('Error al eliminar');
            }
        }
    };

    const incomeStats = useMemo(() => {
        return incomes.map(inc => {
            const relatedTxs = transactions.filter(tx => tx.type === 'income' && tx.categoryId === inc.categoryId);
            const receivedAmount = relatedTxs.reduce((sum, tx) => sum + tx.amount, 0);
            return {
                ...inc,
                receivedAmount,
                isReceived: receivedAmount > 0
            };
        });
    }, [incomes, transactions]);

    if (!family) return null;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Ingresos Programados</h1>
                    <p className="text-black/60 dark:text-white/60 text-sm">
                        Gestiona tus ingresos recurrentes y verifica su estado en el mes actual.
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={18} />
                    Añadir Ingreso
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {incomeStats.map(inc => {
                    const cat = getCategoryById(inc.categoryId);
                    const diff = inc.receivedAmount - inc.estimatedAmount;
                    
                    return (
                        <div key={inc.id} className={`card border-2 transition-all ${inc.isReceived ? 'border-primary-500/20 bg-primary-50/50 dark:bg-primary-900/10' : 'border-transparent'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm ${inc.isReceived ? 'bg-primary-100 dark:bg-primary-800' : 'bg-gray-100 dark:bg-white/10'}`}>
                                        {inc.isReceived ? <CheckCircle2 size={24} className="text-primary-500" /> : <CircleDashed size={24} className="text-gray-400" />}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg">{inc.name}</h3>
                                        <p className="text-xs font-medium text-black/50 dark:text-white/50 flex items-center gap-1">
                                            {cat?.icon} {cat?.name}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => openEdit(inc)} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                                        <Pencil size={14} className="text-black/50 dark:text-white/50" />
                                    </button>
                                    <button onClick={() => handleDelete(inc.id)} className="p-1.5 rounded-md hover:bg-danger-100 dark:hover:bg-danger-900/30 transition-colors">
                                        <Trash2 size={14} className="text-danger-500" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                {inc.isReceived ? (
                                    <div className="bg-white dark:bg-black/20 p-3 rounded-xl">
                                        <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-1">Recibido este mes</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xl font-bold">{formatCurrency(inc.receivedAmount, getAccountById(inc.accountId)?.currency)}</span>
                                        </div>
                                        {diff < 0 && <p className="text-xs text-danger-500 mt-1 font-medium">Esperabas {formatCurrency(inc.estimatedAmount)}, recibiste menos.</p>}
                                        {diff > 0 && <p className="text-xs text-primary-500 mt-1 font-medium">Esperabas {formatCurrency(inc.estimatedAmount)} ¡Has recibido extra!</p>}
                                        {diff === 0 && <p className="text-xs text-black/50 dark:text-white/50 mt-1 font-medium">Exactamente lo esperado.</p>}
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Pendiente de recibir</p>
                                        <span className="text-xl font-bold text-black/70 dark:text-white/70">{formatCurrency(inc.estimatedAmount, getAccountById(inc.accountId)?.currency)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                
                {incomes.length === 0 && (
                    <div className="col-span-full card flex flex-col items-center justify-center py-12 text-center border-dashed border-2 bg-transparent shadow-none">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4 text-3xl">📅</div>
                        <h3 className="text-lg font-bold mb-2">Sin Ingresos Programados</h3>
                        <p className="text-black/60 dark:text-white/60 text-sm max-w-sm mb-4">
                            Añade tus nóminas o ingresos recurrentes para llevar un mejor control del flujo de caja esperado en el mes.
                        </p>
                        <button onClick={() => setShowForm(true)} className="btn-secondary">
                            Añadir mi primer ingreso
                        </button>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={resetForm}>
                    <div className="card w-full max-w-md animate-scale-in space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">{editingId ? 'Editar Ingreso' : 'Añadir Ingreso'}</h2>
                            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1">Nombre (ej. Nómina Principal)</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="input-field"
                                placeholder="Nómina"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1">Monto Estimado</label>
                            <input
                                type="number"
                                step="0.01"
                                value={estimatedAmount}
                                onChange={e => setEstimatedAmount(e.target.value)}
                                className="input-field"
                                placeholder="0.00"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1">Categoría Asociada (Para detectar si llegó)</label>
                            <SearchableSelect
                                value={categoryId}
                                onChange={setCategoryId}
                                options={[
                                    { value: '', label: 'Seleccionar categoría...' },
                                    ...categories.filter(c => c.type === 'income').map(c => ({
                                        value: c.id,
                                        label: `${c.icon} ${c.name}`,
                                        searchTerms: [c.name]
                                    }))
                                ]}
                                className="w-full"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1">Cuenta Destino</label>
                            <select
                                value={accountId}
                                onChange={e => setAccountId(e.target.value)}
                                className="input-field"
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="flex gap-3 pt-4">
                            <button onClick={resetForm} className="btn-secondary flex-1">Cancelar</button>
                            <button 
                                onClick={handleSubmit} 
                                disabled={loading || !name || !estimatedAmount || !categoryId || !accountId}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {loading ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
