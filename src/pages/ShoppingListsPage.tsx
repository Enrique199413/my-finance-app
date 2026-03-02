import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import {
    subscribeToShoppingLists,
    subscribeToShoppingListItems,
    createShoppingList,
    addShoppingListItem,
    updateShoppingListItem,
    completeShoppingList,
    deleteShoppingList,
    deleteShoppingListItem
} from '../services/shopping.service';
import type { ShoppingList, ShoppingListItem } from '../types';
import {
    ShoppingCart, Plus, Check, Trash2, ArrowRight, X
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShoppingListsPage() {
    const { t } = useTranslation();
    const { family } = useFamily();
    const [lists, setLists] = useState<ShoppingList[]>([]);
    const [items, setItems] = useState<ShoppingListItem[]>([]);
    const [activeListId, setActiveListId] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemAmount, setNewItemAmount] = useState('');
    const [newListName, setNewListName] = useState('');

    useEffect(() => {
        if (!family) return;
        const unsub = subscribeToShoppingLists(family.id, (fetchedLists) => {
            setLists(fetchedLists);
            // Auto select a pending list if none is selected
            if (!activeListId) {
                const pending = fetchedLists.find(l => l.status === 'pending');
                if (pending) setActiveListId(pending.id);
            }
        });
        return () => unsub();
    }, [family, activeListId]);

    useEffect(() => {
        if (!family || !activeListId) return;
        const unsub = subscribeToShoppingListItems(family.id, activeListId, (fetchedItems) => {
            setItems(fetchedItems);
        });
        return () => unsub();
    }, [family, activeListId]);

    const activeList = lists.find(l => l.id === activeListId);

    // Sort logic
    const pendingLists = lists.filter(l => l.status === 'pending');
    const completedLists = lists.filter(l => l.status === 'completed');

    const handleCreateList = async () => {
        if (!family || !newListName.trim()) return;
        setLoading(true);
        try {
            const listId = await createShoppingList(family.id, newListName.trim());
            setActiveListId(listId);
            setNewListName('');
            toast.success('Lista creada');
        } catch (err) {
            toast.error('Error al crear lista');
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!family || !activeListId || !newItemName.trim()) return;

        try {
            await addShoppingListItem(
                family.id,
                activeListId,
                newItemName.trim(),
                parseFloat(newItemAmount) || 0
            );
            setNewItemName('');
            setNewItemAmount('');
        } catch (err) {
            toast.error('Error al agregar ítem');
        }
    };

    const handleToggleItem = async (item: ShoppingListItem) => {
        if (!family || !activeListId) return;
        try {
            await updateShoppingListItem(family.id, activeListId, item.id, {
                isChecked: !item.isChecked
            });
        } catch (err) {
            toast.error('Error al actualizar ítem');
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!family || !activeListId) return;
        try {
            await deleteShoppingListItem(family.id, activeListId, itemId);
        } catch (err) {
            toast.error('Error al eliminar ítem');
        }
    }

    const handleDeleteList = async (listId: string) => {
        if (!family) return;
        if (!window.confirm('¿Seguro que deseas eliminar esta lista?')) return;
        try {
            await deleteShoppingList(family.id, listId);
            if (activeListId === listId) setActiveListId(null);
            toast.success('Lista eliminada');
        } catch (err) {
            toast.error('Error al eliminar lista');
        }
    }

    const handleCompleteList = async () => {
        if (!family || !activeListId || !activeList) return;

        const uncheckedItems = items.filter(i => !i.isChecked);

        let confirmMessage = "¿Confirmar compra?";
        if (uncheckedItems.length > 0) {
            confirmMessage = `Faltan comprar ${uncheckedItems.length} artículos. ¿Terminar compra y pasarlos a una siguiente lista?`;
        }

        if (!window.confirm(confirmMessage)) return;

        setLoading(true);
        try {
            await completeShoppingList(family.id, activeListId, activeList.name);
            toast.success('Compra completada');
            setActiveListId(null); // will auto fallback to pending
        } catch (err) {
            toast.error('Error al completar la compra');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: family?.currency || 'EUR'
        }).format(amount);
    };

    const totalEstimate = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalSelected = items.filter(i => i.isChecked).reduce((sum, item) => sum + (item.amount || 0), 0);
    const progressPercent = items.length === 0 ? 0 : Math.round((items.filter(i => i.isChecked).length / items.length) * 100);

    return (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto h-full flex flex-col md:flex-row gap-6">

            {/* Sidebar with Lists */}
            <div className="w-full md:w-1/3 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShoppingCart className="text-primary-500" />
                        Súper
                    </h1>
                </div>

                {/* Create New List */}
                <div className="card p-3 flex flex-col gap-2">
                    <input
                        type="text"
                        placeholder="Nueva lista (ej. Súper semana...)"
                        value={newListName}
                        onChange={e => setNewListName(e.target.value)}
                        className="input-field"
                    />
                    <button
                        onClick={handleCreateList}
                        disabled={loading || !newListName.trim()}
                        className="btn-primary flex justify-center w-full"
                    >
                        <Plus size={18} /> Crear Lista
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    {/* Pending Lists */}
                    {pendingLists.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-text-muted-light dark:text-text-muted-dark uppercase mb-2">Activas</h3>
                            <div className="space-y-2">
                                {pendingLists.map(list => (
                                    <div
                                        key={list.id}
                                        onClick={() => setActiveListId(list.id)}
                                        className={`card p-3 cursor-pointer transition-colors flex justify-between items-center ${activeListId === list.id ? 'ring-2 ring-primary-500 bg-primary-50/10' : 'hover:bg-gray-50 dark:hover:bg-primary-900/10'}`}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm">{list.name}</span>
                                            <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
                                                {list.createdAt.toLocaleDateString()}
                                            </span>
                                        </div>
                                        {activeListId === list.id ? <ArrowRight size={16} className="text-primary-500" /> : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed Lists */}
                    {completedLists.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-text-muted-light dark:text-text-muted-dark uppercase mb-2 mt-4">Historial</h3>
                            <div className="space-y-2">
                                {completedLists.map(list => (
                                    <div
                                        key={list.id}
                                        onClick={() => setActiveListId(list.id)}
                                        className={`card p-3 opacity-60 cursor-pointer transition-colors flex justify-between items-center ${activeListId === list.id ? 'ring-2 ring-gray-400 bg-gray-50' : 'hover:opacity-100'}`}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm line-through decoration-1">{list.name}</span>
                                            <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
                                                {list.completedAt?.toLocaleDateString()}
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                                            className="p-1.5 rounded hover:bg-danger-100 text-danger-400"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Active List Content */}
            <div className="w-full md:flex-1 card min-h-[500px] flex flex-col relative">
                {!activeList ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-text-muted-light dark:text-text-muted-dark">
                        <ShoppingCart size={48} className="mb-4 opacity-50" />
                        <h2 className="text-lg font-semibold">Selecciona o crea una lista</h2>
                        <p className="text-sm max-w-sm mt-2">Agrega los insumos que necesitas y sincroniza el tachado en tiempo real con tu familia.</p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b border-gray-100 dark:border-primary-800 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    {activeList.status === 'completed' && <Check className="text-accent-500" />}
                                    {activeList.name}
                                </h2>
                                {activeList.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDeleteList(activeList.id)}
                                            className="btn-danger p-2"
                                            title="Eliminar lista"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <button
                                            onClick={handleCompleteList}
                                            disabled={loading || items.length === 0}
                                            className="btn-primary flex items-center gap-2"
                                        >
                                            <Check size={18} />
                                            Terminar Compra
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Progress Bar & Stats */}
                            <div className="flex gap-4 items-center mt-2">
                                <div className="flex-1 shrink-0 bg-gray-200 dark:bg-primary-900/30 rounded-full h-2.5 overflow-hidden">
                                    <div className="bg-accent-500 h-2.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }}></div>
                                </div>
                                <span className="text-xs font-semibold">{progressPercent}% completado</span>
                            </div>

                            <div className="flex justify-between mt-2 text-sm">
                                <span className="text-text-muted-light dark:text-text-muted-dark">
                                    Presupuestado: <span className="font-semibold text-text-light dark:text-white">{formatCurrency(totalEstimate)}</span>
                                </span>
                                <span className="text-accent-600 dark:text-accent-400">
                                    Costo al momento: <span className="font-bold">{formatCurrency(totalSelected)}</span>
                                </span>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {items.length === 0 ? (
                                <div className="text-center py-10 text-text-muted-light dark:text-text-muted-dark">
                                    La lista está vacía.
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {items.map(item => (
                                        <div
                                            key={item.id}
                                            className={`group flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50/50 dark:hover:bg-primary-900/10 border border-transparent hover:border-gray-100 dark:hover:border-primary-800/30 transition-all ${item.isChecked ? 'opacity-60 bg-gray-50/30 dark:bg-primary-900/5' : ''}`}
                                        >
                                            <button
                                                onClick={() => activeList.status === 'pending' && handleToggleItem(item)}
                                                disabled={activeList.status === 'completed'}
                                                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border-2 transition-colors cursor-pointer ${item.isChecked ? 'bg-accent-500 border-accent-500 text-white' : 'border-gray-300 dark:border-primary-600 hover:border-accent-400'}`}
                                            >
                                                {item.isChecked && <Check size={14} strokeWidth={3} />}
                                            </button>

                                            <div className={`flex-1 min-w-0 font-medium transition-all ${item.isChecked ? 'line-through text-gray-400' : ''}`}>
                                                {item.name}
                                            </div>

                                            <div className={`w-28 text-right shrink-0 text-sm font-semibold pr-2 ${item.isChecked ? 'text-gray-400' : ''}`}>
                                                {formatCurrency(item.amount)}
                                            </div>

                                            {activeList.status === 'pending' && (
                                                <button
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-danger-400 hover:bg-danger-50 rounded"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add Item Form */}
                        {
                            activeList.status === 'pending' && (
                                <div className="p-4 border-t border-gray-100 dark:border-primary-800 bg-gray-50/50 dark:bg-primary-900/10 rounded-b-2xl">
                                    <form onSubmit={handleAddItem} className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            placeholder="Nombre del artículo (e.g. Huevos)"
                                            value={newItemName}
                                            onChange={e => setNewItemName(e.target.value)}
                                            className="input-field"
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Monto ($)"
                                            value={newItemAmount}
                                            onChange={e => setNewItemAmount(e.target.value)}
                                            className="input-field text-right font-mono"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!newItemName.trim()}
                                            className="btn-primary p-2 flex items-center justify-center shrink-0 disabled:opacity-50"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </form>
                                </div>
                            )
                        }
                    </>
                )}
            </div>
        </div>
    );
}
