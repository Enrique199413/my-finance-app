import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useFamily } from '../../context/FamilyContext';
import {
    LayoutDashboard,
    ArrowLeftRight,
    Wallet,
    Tags,
    CreditCard,
    Users,
    Settings,
    LogOut,
    Sun,
    Moon,
    Monitor,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    Globe,
    ChevronDown,
    Plus,
    ShoppingCart
} from 'lucide-react';

const navItems = [
    { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { path: '/transactions', icon: ArrowLeftRight, labelKey: 'nav.transactions' },
    { path: '/shopping', icon: ShoppingCart, labelKey: 'Súper' },
    { path: '/accounts', icon: Wallet, labelKey: 'nav.accounts' },
    { path: '/categories', icon: Tags, labelKey: 'nav.categories' },
    { path: '/debts', icon: CreditCard, labelKey: 'nav.debts' },
    { path: '/family', icon: Users, labelKey: 'nav.family' },
    { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function Sidebar() {
    const { t, i18n } = useTranslation();
    const { signOut, appUser } = useAuth();
    const { theme, setTheme } = useTheme();
    const { family, families, switchFamily } = useFamily();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [familyDropdownOpen, setFamilyDropdownOpen] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const toggleLang = () => {
        i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
    };

    const cycleTheme = () => {
        const next: Record<string, 'light' | 'dark' | 'system'> = {
            light: 'dark',
            dark: 'system',
            system: 'light',
        };
        setTheme(next[theme]);
    };

    const themeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
    const ThemeIcon = themeIcon;

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Logo + Family switcher */}
            <div className="px-3 py-4 border-b border-gray-100 dark:border-primary-800/30">
                <div className="flex items-center gap-3 px-1 mb-2">
                    <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-lg">F</span>
                    </div>
                    {!collapsed && (
                        <span className="text-lg font-bold text-gradient animate-fade-in">
                            FamFinance
                        </span>
                    )}
                </div>

                {/* Family switcher */}
                {!collapsed && family && (
                    <div className="relative mt-2">
                        <button
                            onClick={() => setFamilyDropdownOpen(!familyDropdownOpen)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors text-sm cursor-pointer"
                        >
                            <Users size={14} className="text-primary-500 shrink-0" />
                            <span className="font-medium truncate flex-1 text-left">{family.name}</span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${familyDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {familyDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-light dark:bg-surface-card-dark rounded-xl shadow-lg border border-gray-100 dark:border-primary-800/30 z-50 overflow-hidden animate-scale-in">
                                {families.map((f) => (
                                    <button
                                        key={f.id}
                                        onClick={() => { switchFamily(f.id); setFamilyDropdownOpen(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-primary-900/20 transition-colors cursor-pointer flex items-center gap-2 ${f.id === family.id ? 'text-primary-600 dark:text-primary-400 font-medium bg-primary-50/50 dark:bg-primary-900/10' : ''
                                            }`}
                                    >
                                        {f.id === family.id && <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
                                        <span className="truncate">{f.name}</span>
                                    </button>
                                ))}
                                <div className="border-t border-gray-100 dark:border-primary-800/30">
                                    <button
                                        onClick={() => { setFamilyDropdownOpen(false); navigate('/family'); }}
                                        className="w-full text-left px-3 py-2 text-sm text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors cursor-pointer flex items-center gap-2"
                                    >
                                        <Plus size={14} />
                                        Nueva familia
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map(({ path, icon: Icon, labelKey }) => (
                    <NavLink
                        key={path}
                        to={path}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-primary-900/30 hover:text-gray-900 dark:hover:text-gray-200'
                            }`
                        }
                    >
                        <Icon
                            size={20}
                            className="shrink-0 group-hover:scale-110 transition-transform duration-200"
                        />
                        {!collapsed && (
                            <span className="animate-fade-in text-sm">{t(labelKey)}</span>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom actions */}
            <div className="px-3 py-4 border-t border-gray-100 dark:border-primary-800/30 space-y-1">
                {/* Theme toggle */}
                <button
                    onClick={cycleTheme}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-primary-900/30 transition-all duration-200 cursor-pointer"
                >
                    <ThemeIcon size={20} className="shrink-0" />
                    {!collapsed && (
                        <span className="text-sm animate-fade-in">
                            {t(`settings.${theme}`)}
                        </span>
                    )}
                </button>

                {/* Language toggle */}
                <button
                    onClick={toggleLang}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-primary-900/30 transition-all duration-200 cursor-pointer"
                >
                    <Globe size={20} className="shrink-0" />
                    {!collapsed && (
                        <span className="text-sm animate-fade-in uppercase">
                            {i18n.language}
                        </span>
                    )}
                </button>

                {/* User + signout */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                    {appUser?.photoURL ? (
                        <img
                            src={appUser.photoURL}
                            alt=""
                            className="w-8 h-8 rounded-full shrink-0 ring-2 ring-primary-200 dark:ring-primary-700"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-bold">
                                {appUser?.displayName?.charAt(0) || '?'}
                            </span>
                        </div>
                    )}
                    {!collapsed && (
                        <div className="flex-1 min-w-0 animate-fade-in">
                            <p className="text-sm font-medium truncate dark:text-gray-200">
                                {appUser?.displayName}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{appUser?.email}</p>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-danger-500 hover:bg-danger-500/10 transition-all duration-200 cursor-pointer"
                >
                    <LogOut size={20} className="shrink-0" />
                    {!collapsed && (
                        <span className="text-sm animate-fade-in">{t('auth.signOut')}</span>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile hamburger */}
            <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-surface-light dark:bg-surface-dark shadow-lg cursor-pointer"
            >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    onClick={() => setMobileOpen(false)}
                    className="lg:hidden fixed inset-0 bg-black/40 z-30 animate-fade-in"
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed lg:sticky top-0 left-0 h-screen z-40
          bg-surface-light dark:bg-surface-dark
          border-r border-gray-100 dark:border-primary-800/30
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[72px]' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
            >
                {sidebarContent}

                {/* Collapse toggle (desktop only) */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="hidden lg:flex absolute -right-3 top-8 w-6 h-6 rounded-full bg-primary-500 text-white items-center justify-center shadow-md hover:bg-primary-600 transition-colors cursor-pointer"
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </aside>
        </>
    );
}
