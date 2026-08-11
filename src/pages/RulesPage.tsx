import { useConfirm } from '../context/ConfirmContext';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { subscribeToRules, createRule, updateRule, deleteRule, getInferredRules } from '../services/rules.service';
import { subscribeToCategories } from '../services/categories.service';
import type { CategorizationRule, Category } from '../types';
import { SearchableSelect, type SelectOption } from '../components/ui/SearchableSelect';
import {
    Wand2,
    Plus,
    Trash2,
    Edit3,
    Search,
    AlertCircle,
    BrainCircuit,
    Sparkles,
    ArrowUpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RulesPage() {
    const { confirm } = useConfirm();
    const { i18n } = useTranslation();
    const { family } = useFamily();
    const [rules, setRules] = useState<CategorizationRule[]>([]);
    const [inferredRules, setInferredRules] = useState<CategorizationRule[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'explicit' | 'inferred'>('all');
    const [showModal, setShowModal] = useState(false);
    
    // Modal state
    const [editingRule, setEditingRule] = useState<CategorizationRule | null>(null);
    const [pattern, setPattern] = useState('');
    const [matchType, setMatchType] = useState<'exact' | 'contains' | 'startsWith'>('contains');
    const [categoryId, setCategoryId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!family) return;
        const unsubRules = subscribeToRules(family.id, setRules);
        const unsubCat = subscribeToCategories(family.id, setCategories);
        return () => {
            unsubRules();
            unsubCat();
        };
    }, [family]);

    useEffect(() => {
        if (!family || categories.length === 0) return;
        const loadInferred = async () => {
            const inf = await getInferredRules(family.id, categories);
            setInferredRules(inf);
        };
        loadInferred();
    }, [family, categories]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!family || !pattern || !categoryId) return;
        
        setIsSubmitting(true);
        try {
            if (editingRule) {
                await updateRule(editingRule.id, { pattern, matchType, categoryId });
                toast.success(i18n.language === 'es' ? 'Regla actualizada' : 'Rule updated');
            } else {
                await createRule(family.id, pattern, matchType, categoryId);
                toast.success(i18n.language === 'es' ? 'Regla creada' : 'Rule created');
            }
            closeModal();
        } catch (err) {
            console.error('Error saving rule:', err);
            toast.error(i18n.language === 'es' ? 'Error al guardar' : 'Error saving');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!(await confirm(i18n.language === 'es' ? '¿Eliminar regla?' : 'Delete rule?'))) return;
        try {
            await deleteRule(id);
            toast.success(i18n.language === 'es' ? 'Regla eliminada' : 'Rule deleted');
        } catch (err) {
            console.error('Error deleting rule:', err);
            toast.error(i18n.language === 'es' ? 'Error al eliminar' : 'Error deleting');
        }
    };

    const handlePromote = async (rule: CategorizationRule) => {
        if (!family) return;
        try {
            await createRule(family.id, rule.pattern, rule.matchType, rule.categoryId);
            toast.success(i18n.language === 'es' ? 'Regla promovida con éxito' : 'Rule promoted successfully');
            // Remove from local inferred rules state immediately for better UX
            setInferredRules(prev => prev.filter(r => r.id !== rule.id));
        } catch (_err) {
            toast.error(i18n.language === 'es' ? 'Error al promover' : 'Error promoting rule');
        }
    };

    const openModal = (rule?: CategorizationRule) => {
        if (rule) {
            setEditingRule(rule);
            setPattern(rule.pattern);
            setMatchType(rule.matchType);
            setCategoryId(rule.categoryId);
        } else {
            setEditingRule(null);
            setPattern('');
            setMatchType('contains');
            setCategoryId('');
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingRule(null);
    };

    const getCategory = (id: string) => categories.find(c => c.id === id);

    const allCombinedRules = [...rules, ...inferredRules];
    
    const filteredRules = allCombinedRules.filter(r => {
        const matchesSearch = r.pattern.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              getCategory(r.categoryId)?.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;
        
        if (filterType === 'explicit') return !r.inferred;
        if (filterType === 'inferred') return !!r.inferred;
        return true;
    });

    const categoryOptions: SelectOption[] = categories.map(c => ({
        value: c.id,
        label: c.name,
        icon: c.icon,
        color: c.color,
    }));

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Wand2 className="h-6 w-6 text-primary-500" />
                        {i18n.language === 'es' ? 'Reglas Inteligentes' : 'Smart Rules'}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {i18n.language === 'es' 
                            ? 'Automatiza la categorización de tus gastos con reglas personalizadas' 
                            : 'Automate your expense categorization with custom rules'}
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all shadow-sm shadow-primary-500/20 active:scale-95"
                >
                    <Plus className="h-4 w-4" />
                    <span>{i18n.language === 'es' ? 'Nueva Regla' : 'New Rule'}</span>
                </button>
            </div>

            {/* Explainer Alert */}
            <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4 flex gap-3 text-sm text-primary-800 dark:text-primary-200">
                <BrainCircuit className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold mb-1">
                        {i18n.language === 'es' ? '¿Cómo funciona?' : 'How does it work?'}
                    </p>
                    <p className="opacity-90 leading-relaxed">
                        {i18n.language === 'es' 
                            ? 'Cuando importas movimientos, la aplicación buscará primero coincidencias con estas reglas explícitas (Alta Confianza). Si no encuentra ninguna, intentará aprender de tu historial reciente (Confianza Media).' 
                            : 'When importing transactions, the app will first look for matches using these explicit rules (High Confidence). If none match, it will try to learn from your recent history (Medium Confidence).'}
                    </p>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative group flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={i18n.language === 'es' ? 'Buscar reglas...' : 'Search rules...'}
                        className="block w-full pl-10 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
                    />
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterType === 'all' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        {i18n.language === 'es' ? 'Todas' : 'All'}
                    </button>
                    <button
                        onClick={() => setFilterType('explicit')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterType === 'explicit' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        {i18n.language === 'es' ? 'Fijas' : 'Fixed'}
                    </button>
                    <button
                        onClick={() => setFilterType('inferred')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterType === 'inferred' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        {i18n.language === 'es' ? 'Sugeridas' : 'Learned'}
                    </button>
                </div>
            </div>

            {/* Rules List */}
            {allCombinedRules.length === 0 ? (
                <div className="text-center py-16 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-500 mb-4">
                        <Wand2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                        {i18n.language === 'es' ? 'Sin reglas de categorización' : 'No categorization rules'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        {i18n.language === 'es' 
                            ? 'Crea tu primera regla para empezar a automatizar.' 
                            : 'Create your first rule to start automating.'}
                    </p>
                    <button
                        onClick={() => openModal()}
                        className="text-primary-600 dark:text-primary-400 font-medium hover:underline inline-flex items-center gap-1"
                    >
                        <Plus className="h-4 w-4" />
                        {i18n.language === 'es' ? 'Crear Regla' : 'Create Rule'}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRules.map(rule => {
                        const cat = getCategory(rule.categoryId);
                        return (
                            <div key={rule.id} className={`bg-white dark:bg-gray-800 p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden ${rule.inferred ? 'border-dashed border-primary-200 dark:border-primary-800' : 'border-gray-100 dark:border-gray-700'}`}>
                                {/* Decorator line */}
                                <div 
                                    className="absolute top-0 left-0 w-full h-1" 
                                    style={{ backgroundColor: cat?.color || '#ccc' }} 
                                />
                                
                                <div className="flex justify-between items-start mb-3 mt-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                            {rule.matchType === 'exact' && (i18n.language === 'es' ? 'Exacto' : 'Exact')}
                                            {rule.matchType === 'contains' && (i18n.language === 'es' ? 'Contiene' : 'Contains')}
                                            {rule.matchType === 'startsWith' && (i18n.language === 'es' ? 'Inicia con' : 'Starts with')}
                                        </span>
                                        {rule.inferred && (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center gap-1 border border-primary-100 dark:border-primary-800">
                                                <Sparkles className="h-3 w-3" />
                                                {i18n.language === 'es' ? 'Sugerida' : 'Learned'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {rule.inferred ? (
                                            <button 
                                                onClick={() => handlePromote(rule)}
                                                className="p-1.5 text-primary-500 hover:text-white hover:bg-primary-500 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                                                title={i18n.language === 'es' ? 'Convertir a Regla Fija' : 'Promote to Fixed Rule'}
                                            >
                                                <ArrowUpCircle className="h-4 w-4" />
                                                {i18n.language === 'es' ? 'Fijar' : 'Promote'}
                                            </button>
                                        ) : (
                                            <>
                                                <button 
                                                    onClick={() => openModal(rule)}
                                                    className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                                                >
                                                    <Edit3 className="h-4 w-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(rule.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                <p className="text-lg font-medium text-gray-900 dark:text-white truncate mb-4" title={rule.pattern}>
                                    "{rule.pattern}"
                                </p>
                                
                                <div className="flex items-center gap-2">
                                    {cat ? (
                                        <div 
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm"
                                            style={{ 
                                                backgroundColor: `${cat.color}20`,
                                                color: cat.color,
                                                border: `1px solid ${cat.color}40`
                                            }}
                                        >
                                            <span className="text-base leading-none">{cat.icon}</span>
                                            <span className="font-medium">{cat.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-red-500 text-sm flex items-center gap-1">
                                            <AlertCircle className="h-4 w-4" />
                                            {i18n.language === 'es' ? 'Categoría no encontrada' : 'Category not found'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleSave} className="p-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                                {editingRule 
                                    ? (i18n.language === 'es' ? 'Editar Regla' : 'Edit Rule') 
                                    : (i18n.language === 'es' ? 'Nueva Regla' : 'New Rule')}
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {i18n.language === 'es' ? 'Palabra clave o frase' : 'Keyword or phrase'}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={pattern}
                                        onChange={(e) => setPattern(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white transition-all"
                                        placeholder="Ej. UBER, AMAZON, NETFLIX..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {i18n.language === 'es' ? 'Condición' : 'Condition'}
                                    </label>
                                    <select
                                        value={matchType}
                                        onChange={(e) => setMatchType(e.target.value as 'exact' | 'contains' | 'startsWith')}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white transition-all appearance-none"
                                    >
                                        <option value="contains">{i18n.language === 'es' ? 'Contiene' : 'Contains'}</option>
                                        <option value="exact">{i18n.language === 'es' ? 'Exactamente igual a' : 'Exactly matches'}</option>
                                        <option value="startsWith">{i18n.language === 'es' ? 'Comienza con' : 'Starts with'}</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {i18n.language === 'es' ? 'Asignar a Categoría' : 'Assign to Category'}
                                    </label>
                                    <SearchableSelect
                                        options={categoryOptions}
                                        value={categoryId}
                                        onChange={setCategoryId}
                                        placeholder={i18n.language === 'es' ? 'Seleccionar categoría...' : 'Select category...'}
                                    />
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors font-medium"
                                >
                                    {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !pattern || !categoryId}
                                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all shadow-sm shadow-primary-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none font-medium"
                                >
                                    {isSubmitting 
                                        ? (i18n.language === 'es' ? 'Guardando...' : 'Saving...')
                                        : (i18n.language === 'es' ? 'Guardar Regla' : 'Save Rule')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
