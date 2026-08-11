import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
    searchTerms?: string[]; // Optional additional terms to search by (e.g. store name)
    render?: React.ReactNode; // Optional custom rendering for the dropdown item
}

interface SearchableSelectProps {
    options: SelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    renderValue?: (option: SelectOption) => React.ReactNode; // Custom render for the selected value trigger
    emptyText?: string;
    dropdownClassName?: string;
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Seleccionar...",
    className = "",
    renderValue,
    emptyText = "No se encontraron resultados",
    dropdownClassName = ""
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Find current option
    const currentOption = options.find(opt => opt.value === value);

    // Filter options based on search query
    const filteredOptions = options.filter(opt => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        if (opt.label.toLowerCase().includes(query)) return true;
        if (opt.searchTerms && opt.searchTerms.some(term => term.toLowerCase().includes(query))) return true;
        return false;
    });

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Focus search when opened
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        } else {
            setSearchQuery(''); // Reset search when closed
        }
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between text-left px-3 py-2 border border-primary-300 dark:border-primary-700 rounded-lg bg-white dark:bg-primary-900/20 focus:outline-none focus:ring-2 focus:ring-accent-500/50 hover:bg-gray-50 dark:hover:bg-primary-800/30 transition-colors"
            >
                <div className="truncate flex-1 text-sm text-text-primary-light dark:text-text-primary-dark">
                    {currentOption 
                        ? (renderValue ? renderValue(currentOption) : currentOption.label)
                        : <span className="text-gray-400">{placeholder}</span>}
                </div>
                <ChevronDown size={16} className={`ml-2 text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className={`absolute z-50 w-full mt-1 bg-white dark:bg-surface-card-dark border border-primary-200 dark:border-primary-800 rounded-lg shadow-xl overflow-hidden ${dropdownClassName}`}>
                    <div className="p-2 border-b border-primary-100 dark:border-primary-800/50">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-primary-900/50 border border-primary-200 dark:border-primary-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500/50 text-text-primary-light dark:text-text-primary-dark"
                                placeholder="Buscar..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <ul className="max-h-60 overflow-y-auto p-1">
                        {filteredOptions.length === 0 ? (
                            <li className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                {emptyText}
                            </li>
                        ) : (
                            filteredOptions.map((option) => (
                                <li
                                    key={option.value}
                                    className={`px-3 py-2 cursor-pointer rounded-md text-sm transition-colors flex items-center justify-between group ${
                                        value === option.value 
                                            ? 'bg-accent-50 dark:bg-accent-700/30 text-accent-700 dark:text-accent-300' 
                                            : 'hover:bg-primary-50 dark:hover:bg-primary-800/50 text-text-primary-light dark:text-text-primary-dark'
                                    }`}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                >
                                    <div className="flex-1 truncate">
                                        {option.render ? option.render : option.label}
                                    </div>
                                    {value === option.value && (
                                        <Check size={16} className="text-accent-600 dark:text-accent-400 ml-2 shrink-0" />
                                    )}
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
