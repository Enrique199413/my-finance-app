import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { ThemePreferences } from '../types';
import { generatePalette } from '../utils/colors';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    previewTheme: Partial<ThemePreferences> | null;
    setTheme: (theme: Theme) => void;
    setPreviewTheme: (theme: Partial<ThemePreferences> | null) => void;
    updateThemePreferences: (prefs: Partial<ThemePreferences>) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const { appUser } = useAuth();
    const [theme, setThemeState] = useState<Theme>(() => {
        return (localStorage.getItem('theme') as Theme) || 'system';
    });
    
    const [previewTheme, setPreviewTheme] = useState<Partial<ThemePreferences> | null>(null);

    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const updateResolved = () => {
            const resolved =
                theme === 'system'
                    ? mediaQuery.matches
                        ? 'dark'
                        : 'light'
                    : theme;
            setResolvedTheme(resolved);

            if (resolved === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        };

        updateResolved();
        mediaQuery.addEventListener('change', updateResolved);
        return () => mediaQuery.removeEventListener('change', updateResolved);
    }, [theme]);

    // Apply custom theme from user preferences or live preview
    useEffect(() => {
        const preferences = previewTheme || appUser?.preferences?.theme;
        const root = document.documentElement;
        
        if (preferences?.primaryColor) {
            const palette = generatePalette(preferences.primaryColor);
            Object.entries(palette).forEach(([shade, colorHex]) => {
                root.style.setProperty(`--color-primary-${shade}`, colorHex);
            });
        } else {
            [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach(shade => {
                root.style.removeProperty(`--color-primary-${shade}`);
            });
        }

        if (preferences?.accentColor) {
            const palette = generatePalette(preferences.accentColor);
            Object.entries(palette).forEach(([shade, colorHex]) => {
                root.style.setProperty(`--color-accent-${shade}`, colorHex);
            });
        } else {
            [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach(shade => {
                root.style.removeProperty(`--color-accent-${shade}`);
            });
        }

        if (preferences?.navbarColor) {
            root.style.setProperty('--color-surface-dark', preferences.navbarColor); // Often used for top bars
        } else {
            root.style.removeProperty('--color-surface-dark');
        }

        if (preferences?.backgroundColorLight) {
            root.style.setProperty('--color-bg-light', preferences.backgroundColorLight);
        } else {
            root.style.removeProperty('--color-bg-light');
        }

        if (preferences?.backgroundColorDark) {
            root.style.setProperty('--color-bg-dark', preferences.backgroundColorDark);
        } else {
            root.style.removeProperty('--color-bg-dark');
        }
    }, [appUser?.preferences?.theme, previewTheme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const updateThemePreferences = async (prefs: Partial<ThemePreferences>) => {
        if (!appUser?.uid) return;
        
        const userRef = doc(db, 'users', appUser.uid);
        const currentPrefs = appUser.preferences?.theme || {};
        
        await updateDoc(userRef, {
            'preferences.theme': {
                ...currentPrefs,
                ...prefs
            }
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, previewTheme, setTheme, setPreviewTheme, updateThemePreferences }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within ThemeProvider');
    return context;
}

