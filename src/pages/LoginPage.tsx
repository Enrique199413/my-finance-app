import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Globe } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function LoginPage() {
    const { t, i18n } = useTranslation();
    const { signInWithGoogle } = useAuth();
    const { theme, setTheme } = useTheme();
    const [signingIn, setSigningIn] = useState(false);

    const handleGoogleSignIn = async () => {
        setSigningIn(true);
        try {
            await signInWithGoogle();
        } catch (err) {
            console.error('Sign in error:', err);
            setSigningIn(false);
        }
    };

    return (
        <div className="min-h-screen gradient-bg flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            {/* Top bar: theme + lang */}
            <div className="fixed top-4 right-4 flex gap-2 z-10">
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-2.5 rounded-xl glass hover:scale-105 transition-all duration-200"
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                    onClick={() => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')}
                    className="p-2.5 rounded-xl glass hover:scale-105 transition-all duration-200 flex items-center gap-1.5"
                >
                    <Globe size={18} />
                    <span className="text-xs font-medium uppercase">{i18n.language}</span>
                </button>
            </div>

            {/* Login card */}
            <div className="w-full max-w-md animate-slide-up">
                <div className="glass rounded-3xl p-8 shadow-xl shadow-primary-500/5">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/30">
                            <span className="text-white font-bold text-3xl">F</span>
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-bold text-center mb-2">
                        {t('auth.welcome')}
                    </h1>
                    <p className="text-center text-text-muted-light dark:text-text-muted-dark mb-8 text-sm">
                        {t('auth.subtitle')}
                    </p>

                    {/* Features preview */}
                    <div className="space-y-3 mb-8">
                        {[
                            { emoji: '👨‍👩‍👧‍👦', text: i18n.language === 'es' ? 'Finanzas familiares compartidas' : 'Shared family finances' },
                            { emoji: '📊', text: i18n.language === 'es' ? 'Análisis y gráficos inteligentes' : 'Smart analytics & charts' },
                            { emoji: '📁', text: i18n.language === 'es' ? 'Importa movimientos por CSV' : 'Import transactions via CSV' },
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 p-3 rounded-xl bg-primary-50/50 dark:bg-primary-900/20"
                                style={{ animationDelay: `${i * 100}ms` }}
                            >
                                <span className="text-xl">{feature.emoji}</span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {feature.text}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Google Sign In button */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={signingIn}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl
              bg-white dark:bg-surface-dark border-2 border-gray-200 dark:border-primary-700
              hover:border-primary-400 dark:hover:border-primary-500
              hover:shadow-lg hover:shadow-primary-500/10
              active:scale-[0.98] transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {/* Google icon SVG */}
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                            {signingIn ? t('auth.signingIn') : t('auth.signInWithGoogle')}
                        </span>
                    </button>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    FamFinance © {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
}
