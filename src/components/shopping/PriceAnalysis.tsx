import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { ShoppingList, ShoppingListItem } from '../../types';
import { getItemsForListsOnce, updateShoppingListItem } from '../../services/shopping.service';
import { Search, Loader2, TrendingUp, TrendingDown, Clock, Edit2, Check, X, Tag, ShoppingCart, List, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface PriceAnalysisProps {
    familyId: string;
    completedLists: ShoppingList[];
}

export const PriceAnalysis: React.FC<PriceAnalysisProps> = ({ familyId, completedLists }) => {
    const { i18n } = useTranslation();
    const dateLocale = i18n.language === 'es' ? es : enUS;

    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<ShoppingListItem[]>([]);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProductName, setSelectedProductName] = useState<string | null>(null);

    // Editing State
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [savingItem, setSavingItem] = useState(false);

    useEffect(() => {
        const fetchItems = async () => {
            setLoading(true);
            try {
                const listIds = completedLists.map(l => l.id);
                const fetchedItems = await getItemsForListsOnce(familyId, listIds);
                setItems(fetchedItems);
            } catch (error) {
                console.error("Error fetching items:", error);
                toast.error("Error al cargar el historial");
            } finally {
                setLoading(false);
            }
        };

        if (completedLists.length > 0) {
            fetchItems();
        } else {
            setLoading(false);
        }
    }, [familyId, completedLists]);

    // Normalize name helper
    const normalize = (name: string) => name.toLowerCase().trim();

    // Group items by normalized name
    const productStats = useMemo(() => {
        const map = new Map<string, {
            originalName: string;
            count: number;
            items: ShoppingListItem[];
        }>();

        items.forEach(item => {
            const norm = normalize(item.name);
            if (!map.has(norm)) {
                map.set(norm, { originalName: item.name, count: 0, items: [] });
            }
            const group = map.get(norm)!;
            group.count += 1;
            group.items.push(item);
        });

        return Array.from(map.values()).sort((a, b) => b.count - a.count);
    }, [items]);

    const mostBought = productStats.filter(p => p.count > 1).slice(0, 5);
    const boughtOnce = productStats.filter(p => p.count === 1).slice(0, 5);

    // Selected Product Logic
    const selectedGroup = useMemo(() => {
        if (!selectedProductName) return null;
        const norm = normalize(selectedProductName);
        return productStats.find(p => normalize(p.originalName) === norm) || null;
    }, [selectedProductName, productStats]);

    // Chart Data
    const chartData = useMemo(() => {
        if (!selectedGroup) return [];
        // Map items to lists to get dates
        const data = selectedGroup.items.map(item => {
            const list = completedLists.find(l => l.id === item.listId);
            const date = list?.completedAt || item.createdAt;
            return {
                ...item,
                date,
                timestamp: date.getTime(),
                price: item.unitPrice || 0,
                storeName: list?.storeName || 'Súper'
            };
        }).sort((a, b) => a.timestamp - b.timestamp);
        
        return data.map(d => ({
            ...d,
            displayDate: format(d.date, 'dd MMM yyyy', { locale: dateLocale }),
        }));
    }, [selectedGroup, completedLists, dateLocale]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'es-ES', {
            style: 'currency',
            currency: 'EUR', // Use default or let user config
        }).format(amount);
    };

    const handleEditSave = async (item: ShoppingListItem) => {
        if (!editingName.trim() || editingName === item.name) {
            setEditingItemId(null);
            return;
        }
        setSavingItem(true);
        try {
            await updateShoppingListItem(familyId, item.listId, item.id, { name: editingName.trim() });
            
            // Update local state directly so we don't have to refetch all
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, name: editingName.trim() } : i));
            
            // If the name changed so much it doesn't match the current group, we might want to clear selection or keep it
            // For now, if they change the name, they might want to stay on the newly named product
            setSelectedProductName(editingName.trim());
            
            toast.success("Nombre actualizado");
            setEditingItemId(null);
        } catch (e) {
            console.error(e);
            toast.error("Error al actualizar");
        } finally {
            setSavingItem(false);
        }
    };

    // Derived Stats
    let avgPrice = 0;
    let minPrice = 0;
    let maxPrice = 0;
    
    if (chartData.length > 0) {
        const prices = chartData.map(d => d.price).filter(p => p > 0);
        if (prices.length > 0) {
            avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            minPrice = Math.min(...prices);
            maxPrice = Math.max(...prices);
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-black/50 dark:text-white/50">
                <Loader2 size={32} className="animate-spin mb-4 text-primary-500" />
                <p>Analizando historial de despensas...</p>
            </div>
        );
    }

    if (completedLists.length === 0) {
        return (
            <div className="card flex flex-col items-center text-center py-12">
                <ShoppingCart size={48} className="text-black/20 dark:text-white/20 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay historial disponible</h3>
                <p className="text-black/60 dark:text-white/60">
                    Completa listas de compras (súper) para empezar a analizar la evolución de los precios de tus productos.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" size={20} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedProductName(null); // Clear selection when typing
                    }}
                    placeholder="Busca un producto para analizar su precio..."
                    className="input-field !pl-11 !py-3 w-full text-lg shadow-sm"
                />
                
                {/* Search Results Dropdown */}
                {searchQuery && !selectedProductName && (
                    <div className="absolute top-full mt-2 w-full glass shadow-xl rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-20 max-h-60 overflow-y-auto">
                        {productStats
                            .filter(p => normalize(p.originalName).includes(normalize(searchQuery)))
                            .map((p, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setSelectedProductName(p.originalName);
                                        setSearchQuery(p.originalName);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 last:border-0 flex justify-between items-center"
                                >
                                    <span className="font-medium">{p.originalName}</span>
                                    <span className="text-xs text-black/50 dark:text-white/50 bg-black/5 dark:bg-white/10 px-2 py-1 rounded-md">
                                        Comprado {p.count} veces
                                    </span>
                                </button>
                            ))}
                        {productStats.filter(p => normalize(p.originalName).includes(normalize(searchQuery))).length === 0 && (
                            <div className="px-4 py-3 text-black/50 dark:text-white/50 text-sm">
                                No se encontraron productos con ese nombre.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Quick Discover (if no product is selected) */}
            {!selectedProductName && !searchQuery && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="card bg-gradient-to-br from-primary-50 to-transparent dark:from-primary-900/20 border-primary-100 dark:border-primary-900/30">
                        <h3 className="font-semibold text-primary-700 dark:text-primary-400 mb-4 flex items-center gap-2">
                            <TrendingUp size={18} />
                            Productos más comprados
                        </h3>
                        <div className="space-y-2">
                            {mostBought.map((p, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setSelectedProductName(p.originalName);
                                        setSearchQuery(p.originalName);
                                    }}
                                    className="w-full text-left p-2 rounded-lg hover:bg-white/50 dark:hover:bg-black/20 transition-colors flex justify-between items-center"
                                >
                                    <span className="font-medium text-sm">{p.originalName}</span>
                                    <span className="text-xs font-semibold bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-1 rounded-lg">
                                        x{p.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="card bg-gradient-to-br from-accent-50 to-transparent dark:from-accent-900/20 border-accent-100 dark:border-accent-900/30">
                        <h3 className="font-semibold text-accent-700 dark:text-accent-400 mb-4 flex items-center gap-2">
                            <Tag size={18} />
                            Comprados una sola vez
                        </h3>
                        <div className="space-y-2">
                            {boughtOnce.map((p, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setSelectedProductName(p.originalName);
                                        setSearchQuery(p.originalName);
                                    }}
                                    className="w-full text-left p-2 rounded-lg hover:bg-white/50 dark:hover:bg-black/20 transition-colors flex justify-between items-center"
                                >
                                    <span className="font-medium text-sm">{p.originalName}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {!selectedProductName && !searchQuery && (
                <div className="card border-gray-200 dark:border-white/10 mt-6">
                    <h3 className="font-semibold mb-4 px-4 pt-4 flex items-center gap-2">
                        <List size={18} />
                        Todos los productos ({productStats.length})
                    </h3>
                    <div className="flex flex-wrap gap-2 px-4 pb-4 max-h-[300px] overflow-y-auto">
                        {productStats.map((p, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    setSelectedProductName(p.originalName);
                                    setSearchQuery(p.originalName);
                                }}
                                className="text-sm px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors flex items-center gap-2"
                            >
                                <span>{p.originalName}</span>
                                {p.count > 1 && (
                                    <span className="text-[10px] font-bold bg-white dark:bg-black/20 px-1.5 rounded-md text-black/50 dark:text-white/50">
                                        {p.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Selected Product Analysis */}
            {selectedProductName && selectedGroup && (
                <div className="space-y-6 animate-scale-in">
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => {
                                setSelectedProductName(null);
                                setSearchQuery('');
                            }}
                            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-black/60 dark:text-white/60 active:scale-95 flex items-center gap-2"
                        >
                            <ArrowLeft size={20} />
                            <span className="font-semibold text-sm">Volver</span>
                        </button>
                        <h2 className="text-xl font-bold ml-2 border-l border-gray-200 dark:border-white/10 pl-4">{selectedGroup.originalName}</h2>
                    </div>
                    
                    {/* Stats Header */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="card p-4">
                            <p className="text-xs text-black/50 dark:text-white/50 uppercase tracking-wider mb-1 font-semibold">Precio Promedio</p>
                            <p className="text-xl font-bold">{formatCurrency(avgPrice)}</p>
                        </div>
                        <div className="card p-4 bg-success-50 dark:bg-success-900/20 border border-success-100 dark:border-success-900/30">
                            <p className="text-xs text-success-600 dark:text-success-400 uppercase tracking-wider mb-1 font-semibold flex items-center gap-1">
                                <TrendingDown size={14} /> Mejor Precio
                            </p>
                            <p className="text-xl font-bold text-success-700 dark:text-success-300">{formatCurrency(minPrice)}</p>
                        </div>
                        <div className="card p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-100 dark:border-danger-900/30">
                            <p className="text-xs text-danger-600 dark:text-danger-400 uppercase tracking-wider mb-1 font-semibold flex items-center gap-1">
                                <TrendingUp size={14} /> Precio Más Alto
                            </p>
                            <p className="text-xl font-bold text-danger-700 dark:text-danger-300">{formatCurrency(maxPrice)}</p>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="card p-2 sm:p-4">
                        <h3 className="font-semibold text-lg px-2 mb-4">Evolución de Precio</h3>
                        <div className="h-[250px] sm:h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                                    <XAxis 
                                        dataKey="displayDate" 
                                        tick={{ fontSize: 10 }}
                                        tickMargin={10}
                                        minTickGap={20}
                                        stroke="currentColor" 
                                        opacity={0.5} 
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(val) => `$${val}`}
                                        width={40}
                                        stroke="currentColor" 
                                        opacity={0.5} 
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tw-colors-white)' }}
                                        formatter={(value: any) => [formatCurrency(Number(value)), 'Precio']}
                                        labelStyle={{ color: '#000', fontWeight: 'bold', marginBottom: '4px' }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="price" 
                                        stroke="#0284c7" 
                                        strokeWidth={3}
                                        activeDot={{ r: 6, fill: '#0284c7', stroke: '#fff', strokeWidth: 2 }} 
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Historical List & Typo Fixer */}
                    <div className="card overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Clock size={18} className="text-black/50 dark:text-white/50" />
                                Historial de Compras
                            </h3>
                            <p className="text-xs text-black/50 dark:text-white/50 mt-1">
                                Si un producto se agrupó mal por error tipográfico (ej. "tomate chrry"), pulsa el lápiz para corregirlo.
                            </p>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-white/5">
                            {chartData.map((d, i) => {
                                const isEditing = editingItemId === d.id;
                                return (
                                    <div key={d.id + i} className="p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between group">
                                        <div className="flex-1 min-w-0 mr-4">
                                            {isEditing ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        className="input-field py-1 px-2 text-sm w-full max-w-[150px] sm:max-w-[200px]"
                                                        autoFocus
                                                    />
                                                    <button 
                                                        onClick={() => handleEditSave(d as ShoppingListItem)}
                                                        disabled={savingItem}
                                                        className="p-2 sm:p-1.5 rounded-lg bg-success-100 text-success-600 hover:bg-success-200 transition-colors active:scale-95"
                                                    >
                                                        {savingItem ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingItemId(null)}
                                                        disabled={savingItem}
                                                        className="p-2 sm:p-1.5 rounded-lg bg-gray-200 text-black/60 hover:bg-gray-300 transition-colors active:scale-95"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-sm truncate">{d.name}</p>
                                                    <button 
                                                        onClick={() => {
                                                            setEditingItemId(d.id);
                                                            setEditingName(d.name);
                                                        }}
                                                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-all text-black/40 active:scale-95"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-xs text-black/50 dark:text-white/50 flex items-center gap-1 mt-0.5">
                                                {d.displayDate} <span className="w-1 h-1 rounded-full bg-black/20 dark:bg-white/20 inline-block"></span> {d.storeName}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-semibold text-primary-600 dark:text-primary-400">
                                                {formatCurrency(d.price)}
                                            </p>
                                            <p className="text-xs text-black/50 dark:text-white/50">
                                                {d.quantity} {d.unit}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
