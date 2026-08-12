import { useConfirm } from '../context/ConfirmContext';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import {
    getTransactionsByFamily,
    createTransaction,
    deleteTransaction,
    deleteTransactionsByDateRange,
    updateTransaction,
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
    RefreshCw,
    Pencil,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function TransactionsPage() {
    const { confirm } = useConfirm();
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
    const [filterCategory, setFilterCategory] = useState('all');
    const [groupingMode, setGroupingMode] = useState<'day' | 'week' | 'fortnight' | 'category'>('day');
    
    // Month filter using Date
    const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    // Form
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [txDate, setTxDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [txType, setTxType] = useState<TransactionType>('expense');
    const [txAccountId, setTxAccountId] = useState('');
    const [txCategoryId, setTxCategoryId] = useState('');

    const [editingTx, setEditingTx] = useState<Transaction | null>(null);

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
            if (selectedMonth !== null) {
                const txDate = new Date(tx.date);
                if (txDate.getFullYear() !== selectedMonth.getFullYear() || txDate.getMonth() !== selectedMonth.getMonth()) {
                    return false;
                }
            }
            if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [transactions, filterType, filterAccount, filterCategory, selectedMonth, search]);
    
    const totals = useMemo(() => {
        let income = 0;
        let expense = 0;
        filtered.forEach(tx => {
            if (tx.type === 'income') income += tx.amount;
            else expense += tx.amount;
        });
        return { income, expense, balance: income - expense };
    }, [filtered]);

    const changeMonth = (offset: number) => {
        setSelectedMonth(prev => {
            if (!prev) {
                const now = new Date();
                return new Date(now.getFullYear(), now.getMonth(), 1);
            }
            const next = new Date(prev);
            next.setMonth(prev.getMonth() + offset);
            return next;
        });
    };
    
    const monthName = selectedMonth ? format(selectedMonth, 'MMMM yyyy', { locale: dateLocale }) : (i18n.language === 'es' ? 'Todos los meses' : 'All months');

    // Group logic
    const grouped = useMemo(() => {
        const map = new Map<string, { txs: Transaction[], income: number, expense: number }>();
        
        for (const tx of filtered) {
            let key = '';
            const txDate = new Date(tx.date);
            const dateStr = format(txDate, 'yyyy-MM-dd');
            const day = txDate.getDate();

            if (groupingMode === 'day') {
                key = dateStr;
            } else if (groupingMode === 'week') {
                if (day <= 7) key = 'Semana 1';
                else if (day <= 14) key = 'Semana 2';
                else if (day <= 21) key = 'Semana 3';
                else if (day <= 28) key = 'Semana 4';
                else key = 'Semana 5';
            } else if (groupingMode === 'fortnight') {
                key = day <= 15 ? 'Quincena 1' : 'Quincena 2';
            } else if (groupingMode === 'category') {
                const cat = categories.find(c => c.id === tx.categoryId);
                key = cat ? `${cat.icon} ${cat.name}` : 'Sin categoría';
            }
            
            if (!map.has(key)) map.set(key, { txs: [], income: 0, expense: 0 });
            const group = map.get(key)!;
            group.txs.push(tx);
            if (tx.type === 'income') group.income += tx.amount;
            else group.expense += tx.amount;
        }
        
        const entries = Array.from(map.entries());
        // Sort entries
        if (groupingMode === 'day') {
            entries.sort((a, b) => b[0].localeCompare(a[0])); // Descending date
        } else {
            entries.sort((a, b) => a[0].localeCompare(b[0])); // Alphabetical or logical string sort
        }
        
        return entries;
    }, [filtered, groupingMode, categories]);

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
        setEditingTx(null);
        setShowForm(false);
    };

    const openEdit = (tx: Transaction) => {
        setEditingTx(tx);
        setAmount(String(tx.amount));
        setDescription(tx.description);
        setTxDate(format(new Date(tx.date), 'yyyy-MM-dd'));
        setTxType(tx.type);
        setTxAccountId(tx.accountId);
        setTxCategoryId(tx.categoryId || '');
        setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!amount || !description.trim() || !txAccountId || !family || !user) return;
        setLoading(true);
        try {
            if (editingTx) {
                await updateTransaction(editingTx.id, {
                    accountId: txAccountId,
                    amount: Math.abs(parseFloat(amount)),
                    type: txType,
                    description: description.trim(),
                    categoryId: txCategoryId || undefined,
                    date: new Date(txDate),
                });
                toast.success('✅');
            } else {
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
            }
            resetForm();
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!(await confirm(t('common.confirm') + '?'))) return;
        try {
            await deleteTransaction(id);
            toast.success('🗑️');
        } catch (err) {
            toast.error(String(err));
        }
    };

    const handleDeleteMonth = async () => {
        if (!family || !selectedMonth) return;
        const formattedMonth = format(selectedMonth, 'MMMM yyyy', { locale: dateLocale });
        const confirmMsg = i18n.language === 'es'
            ? `¿Estás seguro de que quieres borrar TODOS los movimientos de ${formattedMonth}? Esta acción no se puede deshacer.`
            : `Are you sure you want to delete ALL transactions for ${formattedMonth}? This action cannot be undone.`;
        if (!(await confirm(confirmMsg))) return;

        setLoading(true);
        try {
            const year = selectedMonth.getFullYear();
            const month = selectedMonth.getMonth() + 1;
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
                        className="p-2 rounded-xl bg-gray-100 dark:bg-white/10 text-black/80 dark:text-white/80 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
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
            <div className="flex flex-col gap-4 bg-white/50 dark:bg-black/10 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                {/* Row 1: Search, Month, Account, Categories */}
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[200px] group">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 group-focus-within:text-primary-500 transition-colors" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('common.search')}
                            className="input-field !pl-9 w-full transition-all focus:ring-2 focus:ring-primary-500/20"
                        />
                    </div>
                    
                    <div className="flex items-center bg-gray-100/80 dark:bg-black/30 rounded-xl p-1 border border-transparent dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10 transition-colors">
                        <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 shadow-sm cursor-pointer text-black/70 dark:text-white/70 active:scale-95 transition-all">
                            <ChevronLeft size={16} />
                        </button>
                        <button 
                            onClick={() => setSelectedMonth(prev => prev ? null : new Date(new Date().getFullYear(), new Date().getMonth(), 1))} 
                            className="min-w-[120px] text-center font-semibold capitalize text-sm px-2 cursor-pointer hover:text-primary-500 text-black/80 dark:text-white/80 active:scale-95 transition-all"
                            title={selectedMonth ? "Mostrar todos los meses" : "Filtrar por mes actual"}
                        >
                            {monthName}
                        </button>
                        <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 shadow-sm cursor-pointer text-black/70 dark:text-white/70 active:scale-95 transition-all">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    
                    <select
                        value={filterAccount}
                        onChange={(e) => setFilterAccount(e.target.value)}
                        className="input-field !w-auto text-sm cursor-pointer hover:border-gray-300 dark:hover:border-white/20 transition-colors"
                    >
                        <option value="all">{t('transactions.account')}: Todas</option>
                        {accounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                    
                    <div className="min-w-[200px] flex-1">
                        <SearchableSelect
                            value={filterCategory}
                            onChange={setFilterCategory}
                            options={[
                                { value: 'all', label: 'Categoría: Todas' },
                                ...categories.map(c => ({
                                    value: c.id,
                                    label: `${c.icon} ${c.name}`,
                                    searchTerms: [c.name]
                                }))
                            ]}
                            className="w-full"
                        />
                    </div>
                </div>

                {/* Row 2: Type, Grouping, Delete */}
                <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex gap-4 items-center flex-wrap">
                        {/* Type Filter */}
                        <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 dark:bg-black/30 border border-transparent dark:border-white/5">
                            {(['all', 'expense', 'income'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilterType(f)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95 ${filterType === f
                                        ? 'bg-white dark:bg-white/10 shadow-sm text-primary-600 dark:text-primary-400'
                                        : 'text-black/60 dark:text-white/60 hover:text-black/80 dark:hover:text-white/80'
                                        }`}
                                >
                                    {f === 'all' ? 'Todos' : t(`transactions.${f}`)}
                                </button>
                            ))}
                        </div>

                        <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-white/10 rounded-full"></div>

                        {/* Grouping Filter */}
                        <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 dark:bg-black/30 border border-transparent dark:border-white/5 overflow-x-auto max-w-full">
                            {[
                                { id: 'day', label: 'Día' },
                                { id: 'week', label: 'Semana' },
                                { id: 'fortnight', label: 'Quincena' },
                                { id: 'category', label: 'Categoría' }
                            ].map((g) => (
                                <button
                                    key={g.id}
                                    onClick={() => setGroupingMode(g.id as any)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${groupingMode === g.id
                                        ? 'bg-white dark:bg-white/10 shadow-sm text-primary-600 dark:text-primary-400'
                                        : 'text-black/60 dark:text-white/60 hover:text-black/80 dark:hover:text-white/80'
                                        }`}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedMonth && (
                        <button
                            onClick={handleDeleteMonth}
                            disabled={loading}
                            className="p-2 rounded-xl bg-danger-50 text-danger-500 hover:bg-danger-100 dark:bg-danger-900/20 dark:hover:bg-danger-900/40 transition-all cursor-pointer active:scale-95 flex items-center gap-2 text-xs font-bold px-4 ml-auto"
                            title={i18n.language === 'es' ? 'Borrar todos los movimientos del mes' : 'Delete all transactions for month'}
                        >
                            <Trash2 size={16} />
                            <span className="hidden sm:inline">Eliminar Mes</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Totals Summary */}
            <div className="flex gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                <div className="flex-1">
                    <p className="text-xs text-black/50 dark:text-white/50">{t('transactions.income', 'Ingresos')}</p>
                    <p className="text-sm font-semibold text-accent-500">{formatCurrency(totals.income)}</p>
                </div>
                <div className="flex-1">
                    <p className="text-xs text-black/50 dark:text-white/50">{t('transactions.expense', 'Gastos')}</p>
                    <p className="text-sm font-semibold text-danger-500">{formatCurrency(totals.expense)}</p>
                </div>
                <div className="flex-1 border-l pl-4 border-gray-200 dark:border-white/10">
                    <p className="text-xs text-black/50 dark:text-white/50">{t('dashboard.totalBalance', 'Balance')}</p>
                    <p className={`text-sm font-semibold ${totals.balance >= 0 ? 'text-accent-500' : 'text-danger-500'}`}>
                        {totals.balance >= 0 ? '+' : ''}{formatCurrency(totals.balance)}
                    </p>
                </div>
            </div>

            {/* Transaction list */}
            {filtered.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16">
                    <ArrowLeftRight size={48} className="text-primary-300 dark:text-primary-700 mb-4" />
                    <p className="text-black/70 dark:text-white/70">{t('transactions.noTransactions')}</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {grouped.map(([groupKey, group]) => (
                        <div key={groupKey}>
                            <div className="flex flex-wrap items-center justify-between sticky top-0 bg-white/80 dark:bg-black/20 backdrop-blur-md py-1.5 px-2 -mx-2 rounded-lg z-10 mb-2 gap-2">
                                <h3 className="text-sm font-semibold text-black/80 dark:text-white/80">
                                    {groupingMode === 'day' ? format(new Date(groupKey), 'EEEE, d MMMM yyyy', { locale: dateLocale }) : groupKey}
                                </h3>
                                <div className="flex gap-3 text-xs font-medium">
                                    {group.income > 0 && <span className="text-accent-500">Ingresos: {formatCurrency(group.income)}</span>}
                                    {group.expense > 0 && <span className="text-danger-500">Gastos: {formatCurrency(group.expense)}</span>}
                                </div>
                            </div>
                            <div className="space-y-1">
                                {group.txs.map((tx) => {
                                    const cat = getCategoryById(tx.categoryId);
                                    const acc = getAccountById(tx.accountId);
                                    return (
                                        <div
                                            key={tx.id}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                                        >
                                            <div
                                                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                                                style={{ backgroundColor: (cat?.color || '#64748b') + '20' }}
                                            >
                                                {cat?.icon || (tx.type === 'income' ? '💵' : '💳')}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{tx.description}</p>
                                                <p className="text-xs text-black/70 dark:text-white/70">
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
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    onClick={() => openEdit(tx)}
                                                    className="p-2 sm:p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 active:scale-95 transition-transform"
                                                >
                                                    <Pencil size={16} className="text-black/40 sm:w-[14px] sm:h-[14px]" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(tx.id)}
                                                    className="p-2 sm:p-1.5 rounded-lg hover:bg-danger-500/10 active:scale-95 transition-transform"
                                                >
                                                    <Trash2 size={16} className="text-danger-400 sm:w-[14px] sm:h-[14px]" />
                                                </button>
                                            </div>
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
                            <h2 className="text-lg font-bold">{editingTx ? t('common.edit') : t('transactions.addTransaction')}</h2>
                            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
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
                                        : 'bg-gray-100 dark:bg-white/5 text-black/70 dark:text-white/70 border border-transparent'
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
                            <SearchableSelect
                                value={txCategoryId}
                                onChange={(val) => setTxCategoryId(val)}
                                options={[
                                    { value: '', label: '---' },
                                    ...(() => {
                                        const filtered = categories.filter((c) => c.type === txType);
                                        const sorted: any[] = [];
                                        const parents = filtered.filter(c => !c.parentId);
                                        parents.forEach(p => {
                                            sorted.push(p);
                                            sorted.push(...filtered.filter(c => c.parentId === p.id));
                                        });
                                        return sorted.map((c) => ({
                                            value: c.id,
                                            label: `${c.parentId ? '   ↳ ' : ''}${c.icon} ${c.name}`,
                                            searchTerms: [c.name]
                                        }));
                                    })()
                                ]}
                                className="w-full"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={resetForm} className="btn-secondary flex-1">{t('common.cancel')}</button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !amount || !description.trim() || !txAccountId}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {loading ? '...' : (editingTx ? t('common.save') : t('common.create'))}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
