import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { createCategory, updateCategory } from '../services/categories.service';
import type { Category } from '../types';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

const EMOJI_ICONS = ['🛒', '🍽️', '🚗', '🏠', '🏥', '🎬', '👕', '📱', '📚', '🐾', '📦', '💰', '💻', '📈', '💵', '✈️', '🎮', '💊', '🧹', '🎁', '⚡', '💧', '📡', '🏋️', '🍺', '☕'];
const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6', '#a855f7', '#64748b', '#06b6d4'];

interface CategoryFormModalProps {
    onClose: () => void;
    onSuccess?: (categoryId: string) => void;
    editing?: Category | null;
    defaultType?: 'expense' | 'income';
}

export default function CategoryFormModal({ onClose, onSuccess, editing, defaultType = 'expense' }: CategoryFormModalProps) {
    const { t } = useTranslation();
    const { family } = useFamily();
    const [loading, setLoading] = useState(false);

    const [catName, setCatName] = useState(editing?.name || '');
    const [icon, setIcon] = useState(editing?.icon || '📦');
    const [color, setColor] = useState(editing?.color || '#6366f1');
    const [catType, setCatType] = useState<'expense' | 'income'>(editing?.type || defaultType);

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
                });
                toast.success('✅');
                onSuccess?.(editing.id);
            } else {
                const newCatId = await createCategory({
                    familyId: family.id,
                    name: catName.trim(),
                    icon,
                    color,
                    type: catType,
                });
                toast.success('✅');
                onSuccess?.(newCatId);
            }
            onClose();
        } catch (err) {
            toast.error(String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="card w-full max-w-md animate-scale-in space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">
                        {editing ? t('common.edit') : t('common.create')}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-900/30">
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
                    <button onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
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
    );
}
