import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { getTransactionsByDateRange } from '../services/transactions.service';
import { subscribeToCategories, updateCategory } from '../services/categories.service';
import type { Transaction, Category } from '../types';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { PiggyBank, Sparkles, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const MOTIVATIONAL_QUOTES = [
    "Un centavo ahorrado es un centavo ganado. – Benjamin Franklin",
    "No ahorres lo que te queda después de gastar, gasta lo que te queda después de ahorrar. – Warren Buffett",
    "La riqueza no consiste en tener grandes posesiones, sino en tener pocas necesidades. – Epicteto",
    "El ahorro es una excelente defensa contra los imprevistos de la vida.",
    "Pequeños ahorros diarios construyen grandes riquezas futuras.",
    "Tu yo del futuro agradecerá el esfuerzo que haces hoy.",
    "El hábito del ahorro es en sí mismo una educación; fomenta cada virtud, enseña autocontrol, cultiva el sentido del orden."
];

export default function SavingsPage() {
    const { t, i18n } = useTranslation();
    const { family } = useFamily();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const dateLocale = i18n.language === 'es' ? es : enUS;

    const [randomQuote] = useState(() => MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);

    useEffect(() => {
        if (!family) return;
        const unsubscribe = subscribeToCategories(family.id, setCategories);
        return () => unsubscribe();
    }, [family]);

    useEffect(() => {
        if (!family) return;
        const start = startOfMonth(selectedDate);
        const end = endOfMonth(selectedDate);
        getTransactionsByDateRange(family.id, start, end).then(setTransactions);
    }, [family, selectedDate]);

    const prevMonth = () => setSelectedDate(prev => subMonths(prev, 1));
    const nextMonth = () => setSelectedDate(prev => subMonths(prev, -1));

    const savingsCategories = useMemo(() => categories.filter(c => c.isSavings), [categories]);
    const savingsCategoryIds = useMemo(() => new Set(savingsCategories.map(c => c.id)), [savingsCategories]);

    const totalSavings = useMemo(() => {
        return transactions
            .filter(tx => tx.categoryId && savingsCategoryIds.has(tx.categoryId))
            .reduce((sum, tx) => sum + tx.amount, 0);
    }, [transactions, savingsCategoryIds]);

    const toggleCategorySavings = async (category: Category) => {
        try {
            await updateCategory(category.id, { isSavings: !category.isSavings });
            toast.success(category.isSavings ? 'Se removió de ahorros' : 'Se marcó como ahorro');
        } catch (err) {
            toast.error(String(err));
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat(i18n.language === 'es' ? 'es-MX' : 'en-US', {
            style: 'currency',
            currency: family?.currency || 'USD',
        }).format(val);
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-accent-500">
                        Ahorros
                    </h1>
                    <p className="text-black/60 dark:text-white/60">Monitorea y configura tus ahorros mensuales</p>
                </div>
                <div className="flex items-center gap-4 bg-white dark:bg-primary-900/30 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-primary-800/30">
                    <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-primary-800 rounded-xl transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="font-semibold text-lg min-w-[120px] text-center capitalize">
                        {format(selectedDate, 'MMMM yyyy', { locale: dateLocale })}
                    </span>
                    <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-primary-800 rounded-xl transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Metric & Motivation */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="card relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <PiggyBank size={80} />
                        </div>
                        <div className="relative z-10">
                            <h2 className="text-sm font-semibold text-black/60 dark:text-white/60 flex items-center gap-2 mb-2">
                                <PiggyBank size={16} /> Total Ahorrado del Mes
                            </h2>
                            <p className="text-4xl font-bold text-accent-600 dark:text-accent-400">
                                {formatCurrency(totalSavings)}
                            </p>
                        </div>
                    </div>

                    <div className="card bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 border-primary-100 dark:border-primary-800/50">
                        <h3 className="font-semibold text-primary-700 dark:text-primary-300 flex items-center gap-2 mb-3">
                            <Sparkles size={18} /> Consejo del Día
                        </h3>
                        <p className="text-black/80 dark:text-white/80 italic font-medium">
                            "{randomQuote}"
                        </p>
                    </div>
                </div>

                {/* Categories Configuration */}
                <div className="lg:col-span-2 card">
                    <div className="mb-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            Configuración de Categorías
                        </h2>
                        <p className="text-sm text-black/60 dark:text-white/60">
                            Selecciona las categorías de transacciones que deseas contar como ahorro. Al categorizar una transacción (gasto o transferencia) en estas categorías, se sumará a tu total de ahorro.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {categories.map(c => (
                            <div 
                                key={c.id}
                                onClick={() => toggleCategorySavings(c)}
                                className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${
                                    c.isSavings 
                                    ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/10' 
                                    : 'border-transparent bg-gray-50 dark:bg-primary-900/20 hover:border-gray-200 dark:hover:border-primary-700'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg text-white shadow-sm"
                                        style={{ backgroundColor: c.color }}
                                    >
                                        {c.icon}
                                    </div>
                                    <div>
                                        <p className="font-semibold">{c.name}</p>
                                        <p className="text-xs text-black/50 dark:text-white/50 capitalize">{t(`transactions.${c.type}`)}</p>
                                    </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                    c.isSavings ? 'bg-accent-500 text-white' : 'bg-gray-200 dark:bg-primary-800 text-transparent'
                                }`}>
                                    <Check size={14} />
                                </div>
                            </div>
                        ))}
                        {categories.length === 0 && (
                            <p className="text-center text-black/50 dark:text-white/50 col-span-2 py-8">
                                No tienes categorías creadas.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
