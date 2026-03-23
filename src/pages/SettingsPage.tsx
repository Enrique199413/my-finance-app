import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Palette, Save, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { generatePalette } from '../utils/colors';
import { clearVaultKeyFromStorage } from '../services/crypto.service';

export default function SettingsPage() {
    const { t } = useTranslation();
    const { updateThemePreferences, setPreviewTheme } = useTheme();
    const { appUser, updateUserPreferences } = useAuth();
    
    const [loading, setLoading] = useState(false);
    
    // Security state
    const [keepVaultUnlocked, setKeepVaultUnlocked] = useState(false);
    
    // Theme state
    const [primaryColor, setPrimaryColor] = useState('#6366f1');
    const [accentColor, setAccentColor] = useState('#10b981');
    const [navbarColor, setNavbarColor] = useState('#1e1b4b');
    const [backgroundColorDark, setBackgroundColorDark] = useState('#0f0d2e');

    // Initialize from user preferences
    useEffect(() => {
        if (appUser?.preferences?.theme) {
            const theme = appUser.preferences.theme;
            if (theme.primaryColor) setPrimaryColor(theme.primaryColor);
            if (theme.accentColor) setAccentColor(theme.accentColor);
            if (theme.navbarColor) setNavbarColor(theme.navbarColor);
            if (theme.backgroundColorDark) setBackgroundColorDark(theme.backgroundColorDark);
        }
        if (appUser?.preferences?.keepVaultUnlocked !== undefined) {
            setKeepVaultUnlocked(appUser.preferences.keepVaultUnlocked);
        }
    }, [appUser]);

    // Live preview effect
    useEffect(() => {
        setPreviewTheme({
            primaryColor,
            accentColor,
            navbarColor,
            backgroundColorDark,
        });
        
        // Cleanup preview on unmount
        return () => setPreviewTheme(null);
    }, [primaryColor, accentColor, navbarColor, backgroundColorDark, setPreviewTheme]);

    const handleSaveTheme = async () => {
        setLoading(true);
        try {
            await updateThemePreferences({
                primaryColor,
                accentColor,
                navbarColor,
                backgroundColorDark,
            });
            await updateUserPreferences({ keepVaultUnlocked });
            
            if (!keepVaultUnlocked && appUser?.uid) {
                clearVaultKeyFromStorage(appUser.uid);
            }
            
            toast.success(t('common.save') + ' OK');
        } catch (error) {
            console.error('Failed to save theme preferences:', error);
            toast.error(String(error));
        } finally {
            setLoading(false);
        }
    };

    const handleResetTheme = async () => {
        if (!confirm('¿Deseas restaurar los colores por defecto?')) return;
        setLoading(true);
        try {
            // Revert local state to defaults visually before saving
            setPrimaryColor('#6366f1');
            setAccentColor('#10b981');
            setNavbarColor('#1e1b4b');
            setBackgroundColorDark('#0f0d2e');

            await updateThemePreferences({
                primaryColor: '',
                accentColor: '',
                navbarColor: '',
                backgroundColorDark: '',
            });
            toast.success('Restaurado');
        } catch (error) {
            console.error('Failed to reset theme:', error);
            toast.error(String(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white shadow-lg">
                    <Palette size={20} />
                </div>
                <h1 className="text-2xl font-bold">Personalización & Ajustes</h1>
            </div>

            <div className="card space-y-6">
                <div className="border-b border-gray-100 dark:border-primary-800/30 pb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        Colores de la Aplicación
                    </h2>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">
                        Personaliza los colores principales para todas tus interfaces. Al guardar, se aplicarán en todos tus dispositivos.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Primary Color */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">Color Primario (Botones, Acentos)</label>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-gray-200 dark:border-gray-700">
                                <input
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-[150%] h-[150%] -ml-[25%] -mt-[25%] cursor-pointer"
                                />
                            </div>
                            <input
                                type="text"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="input-field font-mono text-sm uppercase"
                                placeholder="#000000"
                            />
                        </div>
                        <div className="flex gap-1 mt-2">
                           {Object.entries(generatePalette(primaryColor)).map(([shade, hex]) => (
                               <div key={shade} className="flex-1 text-center">
                                   <div className="h-6 rounded-sm w-full" style={{ backgroundColor: hex }} title={`${shade}: ${hex}`}></div>
                                   <span className="text-[10px] text-gray-500 mt-1 block">{shade}</span>
                               </div>
                           ))}
                        </div>
                    </div>

                    {/* Accent Color */}
                    <div className="space-y-4">
                        <label className="block text-sm font-medium">Color de Acento (Secundario)</label>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-gray-200 dark:border-gray-700">
                                <input
                                    type="color"
                                    value={accentColor}
                                    onChange={(e) => setAccentColor(e.target.value)}
                                    className="w-[150%] h-[150%] -ml-[25%] -mt-[25%] cursor-pointer"
                                />
                            </div>
                            <input
                                type="text"
                                value={accentColor}
                                onChange={(e) => setAccentColor(e.target.value)}
                                className="input-field font-mono text-sm uppercase"
                                placeholder="#000000"
                            />
                        </div>
                        <div className="flex gap-1 mt-2">
                           {Object.entries(generatePalette(accentColor)).map(([shade, hex]) => (
                               <div key={shade} className="flex-1 text-center">
                                   <div className="h-6 rounded-sm w-full" style={{ backgroundColor: hex }} title={`${shade}: ${hex}`}></div>
                                   <span className="text-[10px] text-gray-500 mt-1 block">{shade}</span>
                               </div>
                           ))}
                        </div>
                    </div>

                    {/* Navbar Color */}
                    <div className="space-y-4">
                        <label className="block text-sm font-medium">Color de Navbar (Modo Oscuro)</label>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-gray-200 dark:border-gray-700">
                                <input
                                    type="color"
                                    value={navbarColor}
                                    onChange={(e) => setNavbarColor(e.target.value)}
                                    className="w-[150%] h-[150%] -ml-[25%] -mt-[25%] cursor-pointer"
                                />
                            </div>
                            <input
                                type="text"
                                value={navbarColor}
                                onChange={(e) => setNavbarColor(e.target.value)}
                                className="input-field font-mono text-sm uppercase"
                                placeholder="#000000"
                            />
                        </div>
                    </div>

                    {/* Background Color */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">Fondo (Modo Oscuro)</label>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-gray-200 dark:border-gray-700">
                                <input
                                    type="color"
                                    value={backgroundColorDark}
                                    onChange={(e) => setBackgroundColorDark(e.target.value)}
                                    className="w-[150%] h-[150%] -ml-[25%] -mt-[25%] cursor-pointer"
                                />
                            </div>
                            <input
                                type="text"
                                value={backgroundColorDark}
                                onChange={(e) => setBackgroundColorDark(e.target.value)}
                                className="input-field font-mono text-sm uppercase"
                                placeholder="#000000"
                            />
                        </div>
                    </div>
                </div>

                {/* Security Section */}
                <div className="pt-6 border-t border-gray-100 dark:border-primary-800/30">
                    <div className="pb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <ShieldCheck size={20} className="text-primary-500" />
                            Seguridad
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                            <div>
                                <p className="font-medium">Mantener Bóveda Desbloqueada</p>
                                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                    Guarda el acceso por 1 mes en este dispositivo
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={keepVaultUnlocked}
                                    onChange={(e) => setKeepVaultUnlocked(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-between gap-4 border-t border-gray-100 dark:border-primary-800/30">
                    <button
                        onClick={handleResetTheme}
                        disabled={loading}
                        className="btn-secondary text-sm"
                    >
                        Restaurar
                    </button>
                    <button
                        onClick={handleSaveTheme}
                        disabled={loading}
                        className="btn-primary flex items-center gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        Guardar Preferencias
                    </button>
                </div>
            </div>
        </div>
    );
}
