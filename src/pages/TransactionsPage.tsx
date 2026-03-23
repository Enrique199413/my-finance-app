import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import {
    getTransactionsByFamily,
    createTransaction,
    deleteTransaction,
    deleteTransactionsByDateRange,
} from '../services/transactions.service';
import { getAccountsByFamily } from '../services/accounts.service';
import { subscribeToCategories } from '../services/categories.service';
import type { Transaction, BankAccount, Category, TransactionType } from '../types';
import {
    Plus,
    ArrowLeftRight,
    TrendingUp,
    TrendingDown,
    Trash2,
    X,
    Search,
    Upload,
    Calendar,
    RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function TransactionsPage() {
    const { t, i18n } = useTranslation();
    const { family } = useFamily();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
    const [filterAccount, setFilterAccount] = useState('all');
    const [filterCategory] = useState('all');
    const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM')); // Default currently viewed month

    // Form
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [txDate, setTxDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [txType, setTxType] = useState<TransactionType>('expense');
    const [txAccountId, setTxAccountId] = useState('');
    const [txCategoryId, setTxCategoryId] = useState('');

    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        if (!family) return;
        setRefreshing(true);
        try {
            const [txs, accs] = await Promise.all([
                getTransactionsByFamily(family.id, 500),
                getAccountsByFamily(family.id)
            ]);
            setTransactions(txs);
            setAccounts(accs);
        } catch (e) {
            console.error(e);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (!family) return;
        loadData();
        const unsub3 = subscribeToCategories(family.id, setCategories);
        return () => { unsub3(); };
    }, [family]);

    const dateLocale = i18n.language === 'es' ? es : enUS;

    const filtered = useMemo(() => {
        return transactions.filter((tx) => {
            if (filterType !== 'all' && tx.type !== filterType) return false;
            if (filterAccount !== 'all' && tx.accountId !== filterAccount) return false;
            if (filterCategory !== 'all' && tx.categoryId !== filterCategory) return false;
            if (filterMonth !== 'all') {
                const txMonth = format(new Date(tx.date), 'yyyy-MM');
                if (txMonth !== filterMonth) return false;
            }
            if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [transactions, filterType, filterAccount, filterCategory, filterMonth, search]);

    // Group by date
    const grouped = useMemo(() => {
        const map = new Map<string, Transaction[]>();
        for (const tx of filtered) {
            const key = format(new Date(tx.date), 'yyyy-MM-dd');
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(tx);
        }
        return Array.from(map.entries());
    }, [filtered]);

    const getCategoryById = (id?: string) => categories.find((c) => c.id === id);
    const getAccountById = (id: string) => accounts.find((a) => a.id === id);

    const formatCurrency = (amount: number, curr: string = 'EUR') => {
        return new Intl.NumberFormat(curr === 'MXN' ? 'es-MX' : 'es-ES', {
            style: 'currency',
            currency: curr,
        }).format(amount);
    };

    const resetForm = () => {
        setAmount('');
        setDescription('');
        setTxDate(format(new Date(), 'yyyy-MM-dd'));
        setTxType('expense');
        setTxAccountId('');
        setTxCategoryId('');
        setShowForm(false);
    };

    const handleSubmit = async () => {
        if (!amount || !description.trim() || !txAccountId || !family || !user) return;
        setLoading(true);
        try {
            await createTransaction({
                familyId: family.id,
                accountId: txAccountId,
                amount: Math.abs(parseFloat(amount)),
                type: txType,
                description: description.trim(),
                categoryId: txCategoryId || undefined,
                date: new Date(txDate),
            });
            toast.success('✅');
            resetForm();
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('common.confirm') + '?')) return;
        try {
            await deleteTransaction(id);
            toast.success('🗑️');
        } catch (err) {
            toast.error(String(err));
        }
    };

    const handleDeleteMonth = async () => {
        if (!family || filterMonth === 'all') return;
        const confirmMsg = i18n.language === 'es'
            ? `¿Estás seguro de que quieres borrar TODOS los movimientos de ${filterMonth}? Esta acción no se puede deshacer.`
            : `Are you sure you want to delete ALL transactions for ${filterMonth}? This action cannot be undone.`;
        if (!confirm(confirmMsg)) return;

        setLoading(true);
        try {
            const [year, month] = filterMonth.split('-').map(Number);
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0, 23, 59, 59, 999);
            const count = await deleteTransactionsByDateRange(family.id, start, end);
            toast.success(i18n.language === 'es' ? `Se borraron ${count} movimientos` : `Deleted ${count} transactions`);
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    if (!family) return null;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">{t('transactions.title')}</h1>
                    <button 
                        onClick={loadData} 
                        disabled={refreshing}
                        className="p-2 rounded-xl bg-gray-100 dark:bg-primary-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-primary-700 transition-colors disabled:opacity-50"
                        title="Actualizar datos"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin text-primary-500' : ''} />
                    </button>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/import')}
                        className="btn-secondary flex items-center gap-2 text-sm"
                    >
                        <Upload size={16} />
                        {t('transactions.importCsv')}
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus size={18} />
                        {t('transactions.addTransaction')}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('common.search')}
                        className="input-field !pl-9"
                    />
                </div>
                <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-primary-900/20">
                    {(['all', 'expense', 'income'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilterType(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${filterType === f
                                ? 'bg-white dark:bg-surface-card-dark shadow-sm text-primary-600 dark:text-primary-400'
                                : 'text-gray-500'
                                }`}
                        >
                            {f === 'all' ? 'Todos' : t(`transactions.${f}`)}
                        </button>
                    ))}
                </div>
                <select
                    value={filterAccount}
                    onChange={(e) => setFilterAccount(e.target.value)}
                    className="input-field !w-auto text-sm"
                >
                    <option value="all">{t('transactions.account')}: Todas</option>
                    {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="month"
                            value={filterMonth === 'all' ? '' : filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value || 'all')}
                            className="input-field !pl-9 !pr-3 !w-auto text-sm"
                        />
                    </div>
                    {filterMonth !== 'all' && (
                        <button
                            onClick={handleDeleteMonth}
                            disabled={loading}
                            className="p-2.5 rounded-xl bg-danger-50 text-danger-500 hover:bg-danger-100 dark:bg-danger-900/20 dark:hover:bg-danger-900/40 transition-colors cursor-pointer"
                            title={i18n.language === 'es' ? 'Borrar todos los movimientos del mes' : 'Delete all transactions for month'}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Transaction list */}
            {filtered.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16">
                    <ArrowLeftRight size={48} className="text-primary-300 dark:text-primary-700 mb-4" />
                    <p className="text-text-muted-light dark:text-text-muted-dark">{t('transactions.noTransactions')}</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {grouped.map(([dateKey, txs]) => (
                        <div key={dateKey}>
                            <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark mb-2 sticky top-0 bg-bg-light dark:bg-bg-dark py-1 z-10">
                                {format(new Date(dateKey), 'EEEE, d MMMM yyyy', { locale: dateLocale })}
                            </h3>
                            <div className="space-y-1">
                                {txs.map((tx) => {
                                    const cat = getCategoryById(tx.categoryId);
                                    const acc = getAccountById(tx.accountId);
                                    return (
                                        <div
                                            key={tx.id}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-primary-900/10 transition-colors group"
                                        >
                                            <div
                                                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                                                style={{ backgroundColor: (cat?.color || '#64748b') + '20' }}
                                            >
                                                {cat?.icon || (tx.type === 'income' ? '💵' : '💳')}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{tx.description}</p>
                                                <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                                                    {cat?.name || '—'} · {acc?.name || '—'}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className={`text-sm font-semibold ${tx.type === 'income'
                                                    ? 'text-accent-500'
                                                    : 'text-danger-500'
                                                    }`}>
                                                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, acc?.currency)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(tx.id)}
                                                className="p-1.5 rounded-lg hover:bg-danger-500/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                            >
                                                <Trash2 size={14} className="text-danger-400" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Transaction Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={resetForm}>
                    <div className="card w-full max-w-md animate-scale-in space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">{t('transactions.addTransaction')}</h2>
                            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-900/30">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Type selector */}
                        <div className="flex gap-2">
                            {(['expense', 'income'] as const).map((typ) => (
                                <button
                                    key={typ}
                                    onClick={() => setTxType(typ)}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${txType === typ
                                        ? typ === 'expense'
                                            ? 'bg-danger-500/10 text-danger-500 border border-danger-500/30'
                                            : 'bg-accent-500/10 text-accent-600 border border-accent-500/30'
                                        : 'bg-gray-100 dark:bg-primary-900/20 text-gray-500 border border-transparent'
                                        }`}
                                >
                                    {typ === 'expense' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                                    {t(`transactions.${typ}`)}
                                </button>
                            ))}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">{t('transactions.amount')}</label>
                            <input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="input-field text-xl font-bold"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">{t('transactions.description')}</label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Compra en Mercadona..."
                                className="input-field"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('transactions.date')}</label>
                                <input
                                    type="date"
                                    value={txDate}
                                    onChange={(e) => setTxDate(e.target.value)}
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('transactions.account')}</label>
                                <select
                                    value={txAccountId}
                                    onChange={(e) => setTxAccountId(e.target.value)}
                                    className="input-field"
                                >
                                    <option value="">---</option>
                                    {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">{t('transactions.category')}</label>
                            <select
                                value={txCategoryId}
                                onChange={(e) => setTxCategoryId(e.target.value)}
                                className="input-field"
                            >
                                <option value="">---</option>
                                {categories
                                    .filter((c) => c.type === txType)
                                    .map((c) => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                    ))}
                            </select>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={resetForm} className="btn-secondary flex-1">{t('common.cancel')}</button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !amount || !description.trim() || !txAccountId}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {loading ? '...' : t('common.create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
