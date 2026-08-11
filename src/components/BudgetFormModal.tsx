import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { createBudget, updateBudget } from '../services/budgets.service';
import type { Budget, Category } from '../types';
import { X, CornerDownRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface BudgetFormModalProps {
    onClose: () => void;
    editing?: Budget | null;
    categories: Category[];
    selectedMonthStr: string;
}

export default function BudgetFormModal({ onClose, editing, categories, selectedMonthStr }: BudgetFormModalProps) {
    const { t } = useTranslation();
    const { family } = useFamily();
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState(editing?.name || '');
    const [amount, setAmount] = useState(editing?.amount ? String(editing.amount) : '');
    const [startMonth, setStartMonth] = useState(editing?.startMonth || selectedMonthStr);
    const [endMonth, setEndMonth] = useState(editing?.endMonth || '');
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set(editing?.categoryIds || []));

    const toggleCategory = (id: string) => {
        const next = new Set(selectedCategoryIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedCategoryIds(next);
    };

    const handleSubmit = async () => {
        if (!name.trim() || !amount || selectedCategoryIds.size === 0 || !family) return;
        setLoading(true);
        try {
            const numAmount = parseFloat(amount);
            
            if (editing) {
                // Manual override if they change startMonth or endMonth
                await updateBudget(editing.id, {
                    name: name.trim(),
                    amount: numAmount,
                    categoryIds: Array.from(selectedCategoryIds),
                    startMonth: startMonth,
                    endMonth: endMonth || null as any,
                });
            } else {
                await createBudget({
                    familyId: family.id,
                    name: name.trim(),
                    amount: numAmount,
                    categoryIds: Array.from(selectedCategoryIds),
                    period: 'monthly',
                    startMonth: startMonth,
                    ...(endMonth ? { endMonth } : {})
                });
            }
            toast.success('✅');
            onClose();
        } catch (err) {
            toast.error(String(err));
        } finally {
            setLoading(false);
        }
    };

    // Prepare expenses for multi-select
    const expenses = categories.filter(c => c.type === 'expense');
    const sortedExpenses: Category[] = [];
    const parents = expenses.filter(c => !c.parentId);
    parents.forEach(p => {
        sortedExpenses.push(p);
        sortedExpenses.push(...expenses.filter(c => c.parentId === p.id));
    });

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="card w-full max-w-md animate-scale-in space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">
                        {editing ? t('common.edit') : t('common.create')} Presupuesto
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-900/30">
                        <X size={18} />
                    </button>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Nombre del presupuesto</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej: Ocio de fin de semana"
                        className="input-field"
                        autoFocus
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Monto límite (Mensual)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Ej: 500"
                        className="input-field"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Mes de Inicio</label>
                        <input
                            type="month"
                            value={startMonth}
                            onChange={(e) => setStartMonth(e.target.value)}
                            className="input-field"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Mes de Fin (Opcional)</label>
                        <input
                            type="month"
                            value={endMonth}
                            onChange={(e) => setEndMonth(e.target.value)}
                            className="input-field"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Categorías incluidas</label>
                    <div className="border border-gray-200 dark:border-primary-800 rounded-xl max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-primary-900/30">
                        {sortedExpenses.map((cat) => (
                            <label
                                key={cat.id}
                                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-primary-900/20 ${cat.parentId ? 'pl-8' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedCategoryIds.has(cat.id)}
                                    onChange={() => toggleCategory(cat.id)}
                                    className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500"
                                />
                                {cat.parentId && <CornerDownRight size={16} className="text-gray-400 shrink-0" />}
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                                    style={{ backgroundColor: cat.color + '20' }}
                                >
                                    {cat.icon}
                                </div>
                                <span className="text-sm font-medium">{cat.name}</span>
                            </label>
                        ))}
                        {sortedExpenses.length === 0 && (
                            <div className="p-4 text-center text-sm text-gray-500">
                                No hay categorías de gasto disponibles.
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !name.trim() || !amount || selectedCategoryIds.size === 0}
                        className="btn-primary flex-1 disabled:opacity-50"
                    >
                        {loading ? '...' : (editing ? t('common.save') : t('common.create'))}
                    </button>
                </div>
            </div>
        </div>
    );
}
