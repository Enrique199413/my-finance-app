import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import {
    subscribeToCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    seedDefaultCategories,
} from '../services/categories.service';
import type { Category } from '../types';
import { Plus, Pencil, Trash2, X, Tags, Sparkles, CornerDownRight, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const EMOJI_ICONS = ['🛒', '🍽️', '🚗', '🏠', '🏥', '🎬', '👕', '📱', '📚', '🐾', '📦', '💰', '💻', '📈', '💵', '✈️', '🎮', '💊', '🧹', '🎁', '⚡', '💧', '📡', '🏋️', '🍺', '☕'];
const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6', '#a855f7', '#64748b', '#06b6d4'];

export default function CategoriesPage() {
    const { t } = useTranslation();
    const { family } = useFamily();
    const [categories, setCategories] = useState<Category[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Category | null>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
    const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());

    // Form
    const [catName, setCatName] = useState('');
    const [icon, setIcon] = useState('📦');
    const [color, setColor] = useState('#6366f1');
    const [catType, setCatType] = useState<'expense' | 'income'>('expense');
    const [parentId, setParentId] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!family) return;
        const unsub = subscribeToCategories(family.id, setCategories);
        return () => unsub();
    }, [family]);

    const resetForm = () => {
        setCatName('');
        setIcon('📦');
        setColor('#6366f1');
        setCatType('expense');
        setParentId(undefined);
        setEditing(null);
        setShowForm(false);
    };

    const openEdit = (cat: Category) => {
        setEditing(cat);
        setCatName(cat.name);
        setIcon(cat.icon);
        setColor(cat.color);
        setCatType(cat.type);
        setParentId(cat.parentId);
        setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!catName.trim() || !family) return;
        setLoading(true);
        try {
            if (editing) {
                await updateCategory(editing.id, {
                    name: catName.trim(),
                    icon,
                    color,
                    type: catType,
                    parentId: parentId || undefined,
                });
            } else {
                await createCategory({
                    familyId: family.id,
                    name: catName.trim(),
                    icon,
                    color,
                    type: catType,
                    parentId: parentId || undefined,
                });
            }
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
            await deleteCategory(id);
            toast.success('🗑️');
        } catch (err) {
            toast.error(String(err));
        }
    };

    const handleSeedDefaults = async () => {
        if (!family) return;
        setLoading(true);
        try {
            await seedDefaultCategories(family.id);
            toast.success('✨');
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    const toggleCollapse = (parentId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(collapsedParents);
        if (next.has(parentId)) {
            next.delete(parentId);
        } else {
            next.add(parentId);
        }
        setCollapsedParents(next);
    };

    const filtered = categories.filter(
        (c) => filter === 'all' || c.type === filter
    );

    const expenses = filtered.filter((c) => c.type === 'expense');
    const incomes = filtered.filter((c) => c.type === 'income');

    // Sort to show parents first, then their children
    const sortCategories = (cats: Category[]) => {
        const sorted: Category[] = [];
        const parents = cats.filter(c => !c.parentId);
        parents.forEach(p => {
            sorted.push(p);
            if (!collapsedParents.has(p.id)) {
                sorted.push(...cats.filter(c => c.parentId === p.id));
            }
        });
        return sorted;
    };

    const sortedExpenses = sortCategories(expenses);
    const sortedIncomes = sortCategories(incomes);

    if (!family) return null;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-bold">{t('nav.categories')}</h1>
                <div className="flex gap-2">
                    {categories.length === 0 && (
                        <button onClick={handleSeedDefaults} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
                            <Sparkles size={16} />
                            Cargar por defecto
                        </button>
                    )}
                    <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-2">
                        <Plus size={18} />
                        {t('common.create')}
                    </button>
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-primary-900/20 w-fit">
                {(['all', 'expense', 'income'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${filter === f
                                ? 'bg-white dark:bg-surface-card-dark shadow-sm text-primary-600 dark:text-primary-400'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        {f === 'all' ? 'Todas' : f === 'expense' ? t('transactions.expense') : t('transactions.income')}
                    </button>
                ))}
            </div>

            {categories.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 text-center">
                    <Tags size={48} className="text-primary-300 dark:text-primary-700 mb-4" />
                    <p className="text-text-muted-light dark:text-text-muted-dark mb-4">No hay categorías aún</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Expenses */}
                    {expenses.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider mb-3">
                                {t('transactions.expense')}s ({expenses.length})
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {sortedExpenses.map((cat) => {
                                    const hasChildren = expenses.some(c => c.parentId === cat.id);
                                    const isCollapsed = collapsedParents.has(cat.id);
                                    
                                    return (
                                        <div
                                            key={cat.id}
                                            onClick={hasChildren ? (e) => toggleCollapse(cat.id, e) : undefined}
                                            className={`card card-hover group flex items-center gap-2 !p-3 cursor-default relative ${cat.parentId ? 'ml-4 sm:ml-0 border-l-4 border-l-primary-500/50' : ''} ${hasChildren ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-primary-900/10' : ''}`}
                                        >
                                            {cat.parentId && <CornerDownRight size={16} className="text-gray-400 shrink-0" />}
                                            <div
                                                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                                                style={{ backgroundColor: cat.color + '20' }}
                                            >
                                                {cat.icon}
                                            </div>
                                            <span className="text-sm font-medium truncate flex-1">{cat.name}</span>
                                            
                                            {hasChildren && (
                                                <div className="text-gray-400 shrink-0">
                                                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                                </div>
                                            )}
                                            
                                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <button onClick={(e) => { e.stopPropagation(); openEdit(cat); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-primary-900/30">
                                                    <Pencil size={12} className="text-gray-400" />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(cat.id); }} className="p-1 rounded hover:bg-danger-500/10">
                                                    <Trash2 size={12} className="text-danger-400" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Income */}
                    {incomes.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider mb-3">
                                {t('transactions.income')}s ({incomes.length})
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {sortedIncomes.map((cat) => {
                                    const hasChildren = incomes.some(c => c.parentId === cat.id);
                                    const isCollapsed = collapsedParents.has(cat.id);
                                    
                                    return (
                                        <div
                                            key={cat.id}
                                            onClick={hasChildren ? (e) => toggleCollapse(cat.id, e) : undefined}
                                            className={`card card-hover group flex items-center gap-2 !p-3 cursor-default relative ${cat.parentId ? 'ml-4 sm:ml-0 border-l-4 border-l-primary-500/50' : ''} ${hasChildren ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-primary-900/10' : ''}`}
                                        >
                                            {cat.parentId && <CornerDownRight size={16} className="text-gray-400 shrink-0" />}
                                            <div
                                                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                                                style={{ backgroundColor: cat.color + '20' }}
                                            >
                                                {cat.icon}
                                            </div>
                                            <span className="text-sm font-medium truncate flex-1">{cat.name}</span>
                                            
                                            {hasChildren && (
                                                <div className="text-gray-400 shrink-0">
                                                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                                </div>
                                            )}
                                            
                                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <button onClick={(e) => { e.stopPropagation(); openEdit(cat); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-primary-900/30">
                                                    <Pencil size={12} className="text-gray-400" />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(cat.id); }} className="p-1 rounded hover:bg-danger-500/10">
                                                    <Trash2 size={12} className="text-danger-400" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal form */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => resetForm()}>
                    <div className="card w-full max-w-md animate-scale-in space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">
                                {editing ? t('common.edit') : t('common.create')}
                            </h2>
                            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-900/30">
                                <X size={18} />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Nombre</label>
                            <input
                                type="text"
                                value={catName}
                                onChange={(e) => setCatName(e.target.value)}
                                placeholder="Supermercado..."
                                className="input-field"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Categoría Padre (Opcional)</label>
                            <select
                                value={parentId || ''}
                                onChange={(e) => setParentId(e.target.value || undefined)}
                                className="input-field"
                            >
                                <option value="">-- Ninguna (Es categoría principal) --</option>
                                {categories
                                    .filter(c => c.type === catType && c.id !== editing?.id && !c.parentId)
                                    .map(c => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                    ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Tipo</label>
                            <div className="flex gap-2">
                                {(['expense', 'income'] as const).map((ct) => (
                                    <button
                                        key={ct}
                                        onClick={() => setCatType(ct)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${catType === ct
                                                ? ct === 'expense'
                                                    ? 'bg-danger-500/10 text-danger-500 border border-danger-500/30'
                                                    : 'bg-accent-500/10 text-accent-600 border border-accent-500/30'
                                                : 'bg-gray-100 dark:bg-primary-900/20 text-gray-500 border border-transparent'
                                            }`}
                                    >
                                        {t(`transactions.${ct}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Icono</label>
                            <div className="flex flex-wrap gap-1.5">
                                {EMOJI_ICONS.map((e) => (
                                    <button
                                        key={e}
                                        onClick={() => setIcon(e)}
                                        className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all cursor-pointer ${icon === e
                                                ? 'bg-primary-100 dark:bg-primary-900/40 ring-2 ring-primary-500 scale-110'
                                                : 'hover:bg-gray-100 dark:hover:bg-primary-900/20'
                                            }`}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Color</label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={`w-7 h-7 rounded-full transition-all cursor-pointer ${color === c ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : 'hover:scale-110'
                                            }`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={resetForm} className="btn-secondary flex-1">{t('common.cancel')}</button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !catName.trim()}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {loading ? '...' : (editing ? t('common.save') : t('common.create'))}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
