import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { useNavigate } from 'react-router-dom';
import { getAccountsByFamily } from '../services/accounts.service';
import { getTransactionsByFamily } from '../services/transactions.service';
import { subscribeToCategories } from '../services/categories.service';
import { subscribeToDebts } from '../services/debts.service';
import type { BankAccount, Transaction, Category, Debt } from '../types';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    PiggyBank,
    ArrowRight,
    ArrowLeftRight,
    Upload,
    Plus,
    RefreshCw,
} from 'lucide-react';

export default function DashboardPage() {
    const { t, i18n } = useTranslation();
    const { family } = useFamily();
    const navigate = useNavigate();

    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [debts, setDebts] = useState<Debt[]>([]);

    const dateLocale = i18n.language === 'es' ? es : enUS;

    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        if (!family) return;
        setRefreshing(true);
        try {
            const [accs, txs] = await Promise.all([
                getAccountsByFamily(family.id),
                getTransactionsByFamily(family.id, 500)
            ]);
            setAccounts(accs);
            setTransactions(txs);
        } catch (e) {
            console.error('Error fetching dashboard data', e);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (!family) return;
        loadData();
        const unsub3 = subscribeToCategories(family.id, setCategories);
        const unsub4 = subscribeToDebts(family.id, setDebts);
        return () => { unsub3(); unsub4(); };
    }, [family]);

    const formatCurrency = (amount: number, curr?: string) => {
        const c = curr || family?.currency || 'EUR';
        return new Intl.NumberFormat(c === 'MXN' ? 'es-MX' : 'es-ES', {
            style: 'currency',
            currency: c,
        }).format(amount);
    };

    // Current month transactions
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const currentMonthTx = useMemo(() =>
        transactions.filter((tx) => {
            const d = new Date(tx.date);
            return d >= monthStart && d <= monthEnd;
        }), [transactions, monthStart, monthEnd]);

    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    const monthlyIncome = currentMonthTx.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const monthlyExpenses = currentMonthTx.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);

    // Projected automated debts
    const projectedDebts = debts
        .filter(d => d.paymentType === 'auto' && d.minimumPayment > 0 && (d.totalAmount - d.paidAmount) > 0)
        .reduce((sum, d) => sum + d.minimumPayment, 0);

    const totalMonthlyExpenses = monthlyExpenses + projectedDebts;
    const monthlySavings = monthlyIncome - totalMonthlyExpenses;

    // Spending by category (pie chart)
    const categorySpending = useMemo(() => {
        const map = new Map<string, number>();
        currentMonthTx.filter((tx) => tx.type === 'expense').forEach((tx) => {
            const key = tx.categoryId || 'uncategorized';
            map.set(key, (map.get(key) || 0) + tx.amount);
        });
        return Array.from(map.entries())
            .map(([catId, amount]) => {
                const cat = categories.find((c) => c.id === catId);
                return {
                    name: cat?.name || 'Sin categoría',
                    value: amount,
                    color: cat?.color || '#94a3b8',
                    icon: cat?.icon || '📦',
                };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [currentMonthTx, categories]);

    // Monthly trend (last 6 months bar chart)
    const monthlyTrend = useMemo(() => {
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const monthDate = subMonths(now, i);
            const mStart = startOfMonth(monthDate);
            const mEnd = endOfMonth(monthDate);
            const monthTx = transactions.filter((tx) => {
                const d = new Date(tx.date);
                return d >= mStart && d <= mEnd;
            });
            months.push({
                month: format(monthDate, 'MMM', { locale: dateLocale }),
                income: monthTx.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0),
                expenses: monthTx.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0),
            });
        }
        return months;
    }, [transactions, dateLocale]);

    // Recent 5 transactions
    const recentTx = transactions.slice(0, 5);
    const getCategoryById = (id?: string) => categories.find((c) => c.id === id);
    const getAccountById = (id: string) => accounts.find((a) => a.id === id);

    if (!family) return null;

    const stats = [
        {
            label: t('dashboard.totalBalance'),
            value: formatCurrency(totalBalance),
            icon: Wallet,
            gradient: 'from-primary-500 to-primary-700',
            shadow: 'shadow-primary-500/20',
        },
        {
            label: t('dashboard.monthlyIncome'),
            value: formatCurrency(monthlyIncome),
            icon: TrendingUp,
            gradient: 'from-accent-400 to-accent-600',
            shadow: 'shadow-accent-500/20',
            positive: true,
        },
        {
            label: t('dashboard.monthlyExpenses'),
            value: formatCurrency(totalMonthlyExpenses),
            subValue: projectedDebts > 0 ? (i18n.language === 'es' ? `Incluye ${formatCurrency(projectedDebts)} prog.` : `Incl. ${formatCurrency(projectedDebts)} sched.`) : undefined,
            icon: TrendingDown,
            gradient: 'from-danger-400 to-danger-600',
            shadow: 'shadow-danger-500/20',
        },
        {
            label: t('dashboard.monthlySavings'),
            value: formatCurrency(monthlySavings),
            icon: PiggyBank,
            gradient: monthlySavings >= 0 ? 'from-accent-400 to-accent-600' : 'from-danger-400 to-danger-600',
            shadow: monthlySavings >= 0 ? 'shadow-accent-500/20' : 'shadow-danger-500/20',
        },
    ];

    const quickActions = [
        { label: t('transactions.addTransaction'), icon: Plus, path: '/transactions', color: 'text-primary-500' },
        { label: t('nav.import'), icon: Upload, path: '/import', color: 'text-accent-500' },
        { label: t('nav.accounts'), icon: Wallet, path: '/accounts', color: 'text-warning-500' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
                    <p className="text-text-muted-light dark:text-text-muted-dark text-sm">
                        {family.name} · {format(now, 'MMMM yyyy', { locale: dateLocale })}
                    </p>
                </div>
                <button 
                    onClick={loadData} 
                    disabled={refreshing}
                    className="p-2 rounded-xl bg-gray-100 dark:bg-primary-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-primary-700 transition-colors disabled:opacity-50"
                    title="Actualizar datos"
                >
                    <RefreshCw size={20} className={refreshing ? 'animate-spin text-primary-500' : ''} />
                </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <div
                        key={i}
                        className="card card-hover group"
                        style={{ animationDelay: `${i * 80}ms` }}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div
                                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} ${stat.shadow} shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                            >
                                <stat.icon size={20} className="text-white" />
                            </div>
                        </div>
                        <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                            {stat.label}
                        </p>
                        <p className="text-2xl font-bold mt-1">{stat.value}</p>
                        {stat.subValue && (
                            <p className="text-xs text-danger-500 font-medium mt-1">{stat.subValue}</p>
                        )}
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Spending by category (pie) */}
                <div className="card">
                    <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider mb-4">
                        {t('dashboard.spendingByCategory')}
                    </h3>
                    {categorySpending.length === 0 ? (
                        <div className="flex items-center justify-center h-48 text-text-muted-light dark:text-text-muted-dark text-sm">
                            {t('common.noResults')}
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div className="w-40 h-40 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categorySpending}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={35}
                                            outerRadius={65}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {categorySpending.map((entry, idx) => (
                                                <Cell key={idx} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) => formatCurrency(Number(value))}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-1 space-y-1.5 overflow-hidden">
                                {categorySpending.map((cat, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                        <span className="truncate flex-1">{cat.icon} {cat.name}</span>
                                        <span className="font-medium shrink-0">{formatCurrency(cat.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Monthly overview (bar) */}
                <div className="card">
                    <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider mb-4">
                        {t('dashboard.monthlyOverview')}
                    </h3>
                    {transactions.length === 0 ? (
                        <div className="flex items-center justify-center h-48 text-text-muted-light dark:text-text-muted-dark text-sm">
                            {t('common.noResults')}
                        </div>
                    ) : (
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyTrend} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={50} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                    <Tooltip
                                        formatter={(value, name) => [formatCurrency(Number(value)), name === 'income' ? t('transactions.income') : t('transactions.expense')]}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)' }}
                                    />
                                    <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick actions + recent transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Actions */}
                <div className="card">
                    <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider mb-4">
                        {i18n.language === 'es' ? 'Acciones rápidas' : 'Quick Actions'}
                    </h3>
                    <div className="space-y-2">
                        {quickActions.map((action, i) => (
                            <button
                                key={i}
                                onClick={() => navigate(action.path)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-primary-900/20 transition-all duration-200 group cursor-pointer"
                            >
                                <action.icon size={20} className={action.color} />
                                <span className="text-sm font-medium flex-1 text-left">{action.label}</span>
                                <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="card lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">
                            {t('dashboard.recentTransactions')}
                        </h3>
                        {transactions.length > 0 && (
                            <button onClick={() => navigate('/transactions')} className="text-xs text-primary-500 hover:text-primary-600 font-medium cursor-pointer flex items-center gap-1">
                                {i18n.language === 'es' ? 'Ver todas' : 'View all'} <ArrowRight size={12} />
                            </button>
                        )}
                    </div>
                    {recentTx.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-text-muted-light dark:text-text-muted-dark text-sm gap-3">
                            <ArrowLeftRight size={32} className="text-gray-300 dark:text-gray-700" />
                            <p>{t('transactions.noTransactions')}</p>
                            <button onClick={() => navigate('/import')} className="btn-primary text-xs !px-4 !py-1.5">
                                {t('nav.import')}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {recentTx.map((tx) => {
                                const cat = getCategoryById(tx.categoryId);
                                const acc = getAccountById(tx.accountId);
                                return (
                                    <div key={tx.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-primary-900/10 transition-colors">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                                            style={{ backgroundColor: (cat?.color || '#64748b') + '20' }}
                                        >
                                            {cat?.icon || (tx.type === 'income' ? '💵' : '💳')}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{tx.description}</p>
                                            <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                                                {cat?.name || '—'} · {format(new Date(tx.date), 'd MMM', { locale: dateLocale })}
                                            </p>
                                        </div>
                                        <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-accent-500' : 'text-danger-500'}`}>
                                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, acc?.currency)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
