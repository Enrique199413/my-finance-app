import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { subscribeToCategories } from '../services/categories.service';
import {
    subscribeToFamilyDrafts,
    subscribeToDraftTransactions,
    updateDraftTransaction,
    updateDraftBatchStatus,
    autoCategorizeDrafts,
    deleteDraftBatch
} from '../services/drafts.service';
import { importTransactions } from '../services/transactions.service';
import type { Category, DraftBatch, DraftTransaction } from '../types';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import {
    Check,
    Wand2,
    Trash2,
    Search,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import CategoryFormModal from '../components/CategoryFormModal';

export default function DraftConsolidationPage() {
    const { batchId } = useParams();
    const navigate = useNavigate();
    const { i18n } = useTranslation();
    const { family } = useFamily();

    const [categories, setCategories] = useState<Category[]>([]);
    const [batch, setBatch] = useState<DraftBatch | null>(null);
    const [drafts, setDrafts] = useState<DraftTransaction[]>([]);

    // For Supermarket matching
    const [completedShoppingLists, setCompletedShoppingLists] = useState<any[]>([]);
    const [linkedLists, setLinkedLists] = useState<Record<string, string>>({}); // draftId -> listId

    const [autoCategorizing, setAutoCategorizing] = useState(false);
    const [committing, setCommitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCategoryModal, setShowCategoryModal] = useState<{ draftId: string, type: 'expense' | 'income' } | null>(null);

    const dateLocale = i18n.language === 'es' ? es : enUS;

    useEffect(() => {
        if (!family) return;
        const unsub = subscribeToCategories(family.id, setCategories);
        return () => unsub();
    }, [family]);

    useEffect(() => {
        if (!family || !batchId) return;

        const unsubBatch = subscribeToFamilyDrafts(family.id, (batches) => {
            const b = batches.find(x => x.id === batchId);
            if (b) setBatch(b);
        });

        const unsubDrafts = subscribeToDraftTransactions(batchId, setDrafts);

        // Fetch completed lists dynamically (no subscribe, just read once is usually enough for consolidation, or subscribe to keep it updated)
        import('../services/shopping.service').then(({ subscribeToShoppingLists }) => {
            const unsubShopping = subscribeToShoppingLists(family.id, (lists) => {
                setCompletedShoppingLists(lists.filter(l => l.status === 'completed' && !l.transactionId));
            });
            return () => unsubShopping();
        });

        return () => {
            unsubBatch();
            unsubDrafts();
        };
    }, [family, batchId]);

    const formatCurrency = (amount: number, curr?: string) => {
        const c = curr || family?.currency || 'EUR';
        return new Intl.NumberFormat(c === 'MXN' ? 'es-MX' : 'es-ES', {
            style: 'currency',
            currency: c,
        }).format(amount);
    };

    const handleAutoCategorize = async () => {
        if (!family || !batchId) return;
        setAutoCategorizing(true);
        try {
            await updateDraftBatchStatus(batchId, 'categorizing');
            const matched = await autoCategorizeDrafts(family.id, batchId);
            toast.success(
                i18n.language === 'es'
                    ? `Se autocategorizaron ${matched} movimientos.`
                    : `Auto-categorized ${matched} transactions.`
            );
            await updateDraftBatchStatus(batchId, 'reviewing');
        } catch (err) {
            toast.error('Error: ' + String(err));
        } finally {
            setAutoCategorizing(false);
        }
    };

    const handleCategoryChange = async (draftId: string, categoryId: string) => {
        try {
            await updateDraftTransaction(draftId, {
                categoryId,
                status: categoryId ? 'categorized' : 'pending'
            });
        } catch (err) {
            toast.error('Error updating category');
        }
    };

    const handleIgnore = async (draftId: string, isIgnored: boolean) => {
        try {
            await updateDraftTransaction(draftId, {
                status: isIgnored ? 'ignored' : 'pending',
                categoryId: '' // clear category if ignoring or unignoring
            });
        } catch (err) {
            toast.error('Error updating status');
        }
    };

    const handleDeleteBatch = async () => {
        if (!batchId) return;
        const confirm = window.confirm(
            i18n.language === 'es'
                ? '¿Estás seguro de eliminar este borrador? Se perderán los cambios.'
                : 'Are you sure you want to delete this draft? Changes will be lost.'
        );
        if (!confirm) return;

        try {
            await deleteDraftBatch(batchId);
            toast.success('Borrador eliminado');
            navigate('/transactions');
        } catch (err) {
            toast.error('Error deleted draft');
        }
    };

    const handleCommit = async () => {
        if (!batchId || !family) return;
        setCommitting(true);
        try {
            // Only commit categorized ones
            const toCommit = drafts.filter(d => d.status === 'categorized');

            if (toCommit.length === 0) {
                toast.error('No hay movimientos categorizados para guardar.');
                setCommitting(false);
                return;
            }

            // Strip out Draft specific fields and parse it to Transaction schema
            const finalTxs = toCommit.map(d => {
                const { id, status, originalDescription, suggestedCategoryId, confidence, createdAt, ...rest } = d;
                return rest;
            });

            await importTransactions(finalTxs);

            // Note: Currently, importTransactions might not return the inserted transactions IDs directly or mapped identically
            // but for shopping lists, let's assume we can map them back by order if the server returns them, 
            // OR if importTransactions doesn't return exactly mapped IDs, we just need to adapt.
            // Wait, importTransactions returns `void`! 
            // So to link lists to a `transactionId`, since we generated finalTxs with NO id... we might need the created IDs.
            // A simpler approach right now is to just mark the list with transactionId = 'imported_from_draft' OR update importTransactions to return ids!

            // To avoid refactoring too deep too early, let's just mark it as imported using the draft ID or 'consolidated' 
            const { linkListToTransaction } = await import('../services/shopping.service');

            const linkPromises = Object.entries(linkedLists).map(([dId, listId]) => {
                // we use the draft id basically since we don't have the final tx id returned instantly 
                // Alternatively, we could update the shopping list BEFORE the commit
                return linkListToTransaction(family.id, listId, `draft_${dId}`);
            });
            await Promise.all(linkPromises);

            await updateDraftBatchStatus(batchId, 'completed');

            // Clean up the draft now that they are in the actual transactions collection
            await deleteDraftBatch(batchId);

            toast.success(`✅ ${finalTxs.length} movimientos guardados en tu cuenta.`);
            navigate('/transactions');
        } catch (err) {
            toast.error('Error: ' + String(err));
            setCommitting(false);
        }
    };

    const filteredDrafts = useMemo(() => {
        if (!searchTerm) return drafts;
        const term = searchTerm.toLowerCase();
        return drafts.filter(d =>
            d.originalDescription.toLowerCase().includes(term) ||
            (d.amount.toString().includes(term))
        );
    }, [drafts, searchTerm]);

    const stats = useMemo(() => {
        let pending = 0;
        let categorized = 0;
        let ignored = 0;
        drafts.forEach(d => {
            if (d.status === 'pending') pending++;
            else if (d.status === 'categorized') categorized++;
            else if (d.status === 'ignored') ignored++;
        });
        return { pending, categorized, ignored, total: drafts.length };
    }, [drafts]);

    if (!family || !batch) return <div className="animate-pulse flex p-8 justify-center">Loading...</div>;

    return (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        Consolidación: {batch.fileName}
                    </h1>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                        Revisa y asigna categorías antes de guardar definitivamente.
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={handleDeleteBatch}
                        className="btn-danger flex items-center justify-center gap-2"
                        title="Eliminar borrador"
                    >
                        <Trash2 size={18} />
                    </button>

                    <button
                        onClick={handleAutoCategorize}
                        disabled={autoCategorizing || stats.pending === 0}
                        className="btn-secondary flex items-center justify-center gap-2 flex-1 md:flex-none whitespace-nowrap"
                    >
                        {autoCategorizing ? (
                            <div className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                        ) : (
                            <Wand2 size={18} className="text-primary-500" />
                        )}
                        Auto-Categorizar
                    </button>

                    <button
                        onClick={handleCommit}
                        disabled={committing || stats.categorized === 0}
                        className="btn-primary flex items-center justify-center gap-2 flex-1 md:flex-none whitespace-nowrap"
                    >
                        {committing ? 'Guardando...' : (
                            <>
                                <Check size={18} />
                                {stats.pending > 0
                                    ? `Guardar ${stats.categorized} (Faltan ${stats.pending})`
                                    : `Guardar Todos (${stats.categorized})`
                                }
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card text-center p-4">
                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase font-semibold">Total</p>
                    <p className="text-xl font-bold">{stats.total}</p>
                </div>
                <div className="card text-center p-4 border-l-4 border-warning-400">
                    <p className="text-xs text-warning-600 dark:text-warning-400 uppercase font-semibold">Pendientes</p>
                    <p className="text-xl font-bold">{stats.pending}</p>
                </div>
                <div className="card text-center p-4 border-l-4 border-accent-500">
                    <p className="text-xs text-accent-600 dark:text-accent-400 uppercase font-semibold">Listos</p>
                    <p className="text-xl font-bold">{stats.categorized}</p>
                </div>
                <div className="card text-center p-4 border-l-4 border-gray-400">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Ignorados</p>
                    <p className="text-xl font-bold text-gray-400">{stats.ignored}</p>
                </div>
            </div>

            <div className="card space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por descripción o monto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field pl-10 w-full md:w-1/3"
                    />
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-primary-800">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-primary-900/20 text-text-muted-light dark:text-text-muted-dark border-b border-gray-200 dark:border-primary-800">
                                <th className="px-4 py-3 font-medium">Estado</th>
                                <th className="px-4 py-3 font-medium">Fecha</th>
                                <th className="px-4 py-3 font-medium">Descripción Original</th>
                                <th className="px-4 py-3 font-medium">Categoría</th>
                                <th className="px-4 py-3 font-medium text-right">Monto</th>
                                <th className="px-4 py-3 font-medium text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-primary-800/30">
                            {filteredDrafts.map(draft => {
                                const isIncome = draft.type === 'income';
                                const rowOpacity = draft.status === 'ignored' ? 'opacity-50 grayscale bg-gray-50 dark:bg-gray-900/20' : '';

                                return (
                                    <tr key={draft.id} className={`hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors ${rowOpacity}`}>
                                        <td className="px-4 py-3">
                                            {draft.status === 'pending' && <AlertCircle size={18} className="text-warning-500" aria-label="Pendiente" />}
                                            {draft.status === 'categorized' && <CheckCircle2 size={18} className="text-accent-500" aria-label="Categorizado" />}
                                            {draft.status === 'ignored' && <Trash2 size={18} className="text-gray-400" aria-label="Ignorado" />}
                                        </td>
                                        <td className="px-4 py-3 text-text-muted-light dark:text-text-muted-dark whitespace-nowrap">
                                            {format(draft.date, 'dd MMM yy', { locale: dateLocale })}
                                        </td>
                                        <td className="px-4 py-3 font-medium truncate max-w-[200px]" title={draft.originalDescription}>
                                            {draft.originalDescription}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <select
                                                    disabled={draft.status === 'ignored'}
                                                    value={draft.categoryId || ''}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'NEW') {
                                                            setShowCategoryModal({ draftId: draft.id, type: draft.type === 'income' ? 'income' : 'expense' });
                                                        } else {
                                                            handleCategoryChange(draft.id, e.target.value);
                                                        }
                                                    }}
                                                    className="input-field !py-1.5 !px-2 !text-xs w-full min-w-[140px]"
                                                >
                                                    <option value="">-- Asignar --</option>
                                                    {categories
                                                        .filter(c => c.type === draft.type)
                                                        .map(c => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.icon} {c.name}
                                                            </option>
                                                        ))}
                                                    <option value="NEW" className="font-semibold text-primary-600 dark:text-primary-400">
                                                        ➕ Nueva Categoría
                                                    </option>
                                                </select>

                                                {/* If Category is Pantry (Despensa) and we have unlinked lists */}
                                                {draft.categoryId && categories.find(c => c.id === draft.categoryId)?.name.toLowerCase().includes('despensa') && completedShoppingLists.length > 0 && (
                                                    <select
                                                        value={linkedLists[draft.id] || ''}
                                                        onChange={(e) => setLinkedLists(prev => ({ ...prev, [draft.id]: e.target.value }))}
                                                        className="input-field !py-1 !px-2 !text-[10px] w-full min-w-[140px] border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20"
                                                    >
                                                        <option value="">-- Vincular a Lista de Súper (Opcional) --</option>
                                                        {completedShoppingLists.map(list => (
                                                            <option key={list.id} value={list.id}>
                                                                {list.name} ({list.completedAt ? format(list.completedAt, 'dd MMM', { locale: dateLocale }) : '?'})
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${isIncome ? 'text-accent-500' : 'text-danger-500'}`}>
                                            {isIncome ? '+' : '-'}{formatCurrency(draft.amount)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleIgnore(draft.id, draft.status !== 'ignored')}
                                                className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${draft.status === 'ignored'
                                                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                                    : 'text-gray-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20'
                                                    }`}
                                            >
                                                {draft.status === 'ignored' ? 'Restaurar' : 'Ignorar'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {filteredDrafts.length === 0 && (
                        <div className="p-8 text-center text-text-muted-light dark:text-text-muted-dark">
                            No se encontraron movimientos.
                        </div>
                    )}
                </div>
            </div>

            {showCategoryModal && (
                <CategoryFormModal
                    defaultType={showCategoryModal.type === 'income' ? 'income' : 'expense'}
                    onClose={() => setShowCategoryModal(null)}
                    onSuccess={(newCategoryId) => {
                        handleCategoryChange(showCategoryModal.draftId, newCategoryId);
                        setShowCategoryModal(null);
                    }}
                />
            )}
        </div>
    );
}
