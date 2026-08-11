import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { subscribeToBudgets, deleteBudget } from '../services/budgets.service';
import { subscribeToCategories } from '../services/categories.service';
import { getTransactionsByDateRange } from '../services/transactions.service';
import type { Budget, Category, Transaction } from '../types';
import { Plus, Pencil, Trash2, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirm } from '../context/ConfirmContext';
import BudgetFormModal from '../components/BudgetFormModal';

export default function BudgetsPage() {
    const { confirm } = useConfirm();
    const { t } = useTranslation();
    const { family } = useFamily();
    
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Budget | null>(null);

    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    // Current month string YYYY-MM based on selectedDate
    const selectedMonthStr = useMemo(() => {
        return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
    }, [selectedDate]);

    const [isSyncing, setIsSyncing] = useState(false);
    const [expandedBudget, setExpandedBudget] = useState<string | null>(null);

    const loadTransactions = async (date: Date) => {
        if (!family) return;
        setIsSyncing(true);
        try {
            const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
            const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
            const txs = await getTransactionsByDateRange(family.id, startDate, endDate);
            setTransactions(txs);
        } catch (error) {
            console.error(error);
            toast.error('Error al sincronizar movimientos');
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (!family) return;
        const unsubBudgets = subscribeToBudgets(family.id, setBudgets);
        const unsubCategories = subscribeToCategories(family.id, setCategories);
        
        loadTransactions(selectedDate);
        
        return () => {
            unsubBudgets();
            unsubCategories();
        };
    }, [family, selectedDate]);

    // Filter active budgets for the selected month
    // Active means startMonth <= selectedMonth and (endMonth > selectedMonth or no endMonth)
    const activeBudgets = useMemo(() => {
        return budgets.filter(b => 
            b.startMonth <= selectedMonthStr && 
            (!b.endMonth || b.endMonth >= selectedMonthStr)
        );
    }, [budgets, selectedMonthStr]);

    const handleEdit = (budget: Budget) => {
        setEditing(budget);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!(await confirm('¿Estás seguro de que deseas eliminar este presupuesto?'))) return;
        try {
            await deleteBudget(id);
            toast.success('Presupuesto eliminado');
        } catch (err) {
            toast.error(String(err));
        }
    };

    // Calculate progress for each budget
    const budgetProgress = useMemo(() => {
        const progress = new Map<string, number>();
        
        // Filter transactions for the selected month
        const currentMonthTxs = transactions.filter(tx => {
            if (tx.type !== 'expense') return false;
            const txDate = new Date(tx.date);
            const txMonthStr = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
            return txMonthStr === selectedMonthStr;
        });

        activeBudgets.forEach(budget => {
            const spent = currentMonthTxs
                .filter(tx => tx.categoryId && budget.categoryIds.includes(tx.categoryId))
                .reduce((sum, tx) => sum + tx.amount, 0);
            progress.set(budget.id, spent);
        });
        
        return progress;
    }, [activeBudgets, transactions, selectedMonthStr]);

    const changeMonth = (offset: number) => {
        setSelectedDate(prev => {
            const next = new Date(prev);
            next.setMonth(prev.getMonth() + offset);
            return next;
        });
    };

    const monthName = selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    if (!family) return null;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold">Presupuestos</h1>
                    <div className="flex items-center bg-gray-100 dark:bg-primary-900/20 rounded-lg p-1">
                        <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-md hover:bg-white dark:hover:bg-surface-card-dark shadow-sm">
                            <ChevronLeft size={18} />
                        </button>
                        <span className="min-w-[120px] text-center font-medium capitalize text-sm">
                            {monthName}
                        </span>
                        <button onClick={() => changeMonth(1)} className="p-1.5 rounded-md hover:bg-white dark:hover:bg-surface-card-dark shadow-sm">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadTransactions(selectedDate)}
                        disabled={isSyncing}
                        className="btn-secondary flex items-center gap-2 p-2"
                        title="Sincronizar movimientos"
                    >
                        <RefreshCw size={18} className={isSyncing ? 'animate-spin text-primary-500' : 'text-black/70'} />
                    </button>
                    <button 
                        onClick={() => { setEditing(null); setShowForm(true); }} 
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus size={18} />
                        {t('common.create')}
                    </button>
                </div>
            </div>

            {activeBudgets.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 text-center">
                    <TrendingUp size={48} className="text-primary-300 dark:text-primary-700 mb-4" />
                    <p className="text-black/70 dark:text-white/70 mb-2">No tienes presupuestos activos para {monthName}.</p>
                    <p className="text-sm text-black/70">Agrupa categorías y establece límites para controlar tus gastos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeBudgets.map(budget => {
                        const spent = budgetProgress.get(budget.id) || 0;
                        const percentage = Math.min((spent / budget.amount) * 100, 100);
                        const isOverBudget = spent > budget.amount;
                        const isNearLimit = percentage >= 80 && !isOverBudget;
                        
                        return (
                            <div key={budget.id} className="card relative group">
                                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(budget)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-900/30">
                                        <Pencil size={14} className="text-black/70" />
                                    </button>
                                    <button onClick={() => handleDelete(budget.id)} className="p-1.5 rounded-lg hover:bg-danger-500/10">
                                        <Trash2 size={14} className="text-danger-500" />
                                    </button>
                                </div>
                                
                                <h3 className="font-bold text-lg pr-12">{budget.name}</h3>
                                
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between items-end">
                                        <div className="text-2xl font-bold font-mono">
                                            {new Intl.NumberFormat(undefined, { style: 'currency', currency: family.currency || 'EUR' }).format(spent)}
                                        </div>
                                        <div className="text-sm text-black/70 dark:text-white/70">
                                            de {new Intl.NumberFormat(undefined, { style: 'currency', currency: family.currency || 'EUR' }).format(budget.amount)}
                                        </div>
                                    </div>
                                    
                                    <div className="h-3 w-full bg-gray-100 dark:bg-primary-900/30 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                isOverBudget ? 'bg-danger-500' : isNearLimit ? 'bg-warning-500' : 'bg-primary-500'
                                            }`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    
                                    {isOverBudget && (
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-danger-500 mt-1">
                                            <AlertCircle size={12} />
                                            ¡Has superado el límite por {new Intl.NumberFormat(undefined, { style: 'currency', currency: family.currency || 'EUR' }).format(spent - budget.amount)}!
                                        </div>
                                    )}
                                </div>
                                
                                <div className="mt-5 border-t border-gray-100 dark:border-primary-800/50 pt-4">
                                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedBudget(expandedBudget === budget.id ? null : budget.id)}>
                                        <div className="text-xs text-black/70 dark:text-white/70 font-medium uppercase tracking-wider mb-2">Categorías</div>
                                        <div className="text-black/40 hover:text-black/80 dark:hover:text-gray-300">
                                            {expandedBudget === budget.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {budget.categoryIds.map(catId => {
                                            const cat = categories.find(c => c.id === catId);
                                            if (!cat) return null;
                                            return (
                                                <div 
                                                    key={cat.id} 
                                                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
                                                    style={{ backgroundColor: cat.color + '15', color: cat.color }}
                                                >
                                                    <span>{cat.icon}</span>
                                                    <span className="font-medium">{cat.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {expandedBudget === budget.id && (
                                        <div className="mt-2 space-y-2 border-t border-gray-50 dark:border-primary-900/20 pt-2 animate-fade-in">
                                            <div className="text-xs text-black/70 dark:text-white/70 font-medium uppercase tracking-wider mb-2">Movimientos del mes</div>
                                            {transactions
                                                .filter(tx => tx.type === 'expense' && tx.categoryId && budget.categoryIds.includes(tx.categoryId))
                                                .map(tx => (
                                                    <div key={tx.id} className="flex justify-between items-center text-sm py-1">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{tx.description || 'Sin descripción'}</span>
                                                            <span className="text-xs text-black/70">{tx.date.toLocaleDateString()}</span>
                                                        </div>
                                                        <span className="font-medium text-danger-500">
                                                            -{new Intl.NumberFormat(undefined, { style: 'currency', currency: family.currency || 'EUR' }).format(tx.amount)}
                                                        </span>
                                                    </div>
                                                ))}
                                            {transactions.filter(tx => tx.type === 'expense' && tx.categoryId && budget.categoryIds.includes(tx.categoryId)).length === 0 && (
                                                <div className="text-sm text-black/70 text-center py-2">No hay movimientos en este mes.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showForm && (
                <BudgetFormModal
                    onClose={() => setShowForm(false)}
                    editing={editing}
                    categories={categories}
                    selectedMonthStr={selectedMonthStr}
                />
            )}
        </div>
    );
}
