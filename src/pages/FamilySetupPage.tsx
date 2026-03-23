import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { createAccount } from '../services/accounts.service';
import { seedDefaultCategories } from '../services/categories.service';
import type { AccountType } from '../types';
import {
    Users, UserPlus, ArrowRight, ArrowLeft, Sun, Moon, Globe, LogOut,
    Check, ChevronRight, Lock, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 'choose' | 'create-family' | 'join-family' | 'setup-vault' | 'add-account' | 'waiting-approval' | 'done';

const BANKS = ['BBVA', 'Revolut', 'Santander', 'CaixaBank', 'Banamex', 'Banorte', 'HSBC', 'Otro'];
const CURRENCIES = ['EUR', 'MXN', 'USD', 'GBP'];

export default function FamilySetupPage({ onComplete }: { onComplete?: () => void }) {
    const { t, i18n } = useTranslation();
    const { family, createFamily, joinFamily } = useFamily();
    const { user, signOut } = useAuth();
    const { theme, setTheme } = useTheme();
    const [step, setStep] = useState<Step>('choose');
    const [loading, setLoading] = useState(false);

    // Family form
    const [familyName, setFamilyName] = useState('');
    const [currency, setCurrency] = useState('EUR');
    const [inviteCode, setInviteCode] = useState('');

    // Vault form
    const [vaultPin, setVaultPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const { enableFamilyVault } = useFamily();

    // Account form
    const [accountName, setAccountName] = useState('');
    const [bank, setBank] = useState('');
    const [accountType, setAccountType] = useState<AccountType>('checking');
    const [accountCurrency, setAccountCurrency] = useState('EUR');

    // When family is created/joined, move to setup-vault step
    useEffect(() => {
        if (family && (step === 'create-family' || step === 'join-family' || step === 'choose')) {
            const isOwner = family.ownerId === user?.uid;
            // Check if vault is enabled to see which step to fall on next if we refresh the page mid-setup.
            setAccountCurrency(family.currency || 'EUR');
            if (isOwner) {
                if (family.isVaultEnabled) {
                    setStep('add-account');
                } else {
                    setStep('setup-vault');
                }
            } else {
                setStep('waiting-approval');
            }
        }
    }, [family, step, user?.uid]);

    const handleCreateFamily = async () => {
        if (!familyName.trim()) return;
        setLoading(true);
        try {
            await createFamily(familyName.trim(), currency);
            toast.success('🎉');
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    const handleJoinFamily = async () => {
        if (!inviteCode.trim()) return;
        setLoading(true);
        try {
            await joinFamily(inviteCode.trim());
            toast.success('🎉');
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    const handleSetupVault = async () => {
        if (vaultPin.length < 6 || vaultPin !== confirmPin) {
            toast.error('El PIN debe tener al menos 6 dígitos y coincidir.');
            return;
        }
        setLoading(true);
        try {
            await enableFamilyVault(vaultPin);
            toast.success('Bóveda de Seguridad Activada 🔒');
            setStep('add-account');
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    const handleAddAccount = async () => {
        if (!accountName.trim() || !bank.trim() || !family || !user) return;
        setLoading(true);
        try {
            await createAccount({
                familyId: family.id,
                name: accountName.trim(),
                bank: bank.trim(),
                type: accountType,
                currency: accountCurrency,
                balance: 0,
                ownerId: user.uid,
            });
            // Also seed categories
            await seedDefaultCategories(family.id);
            toast.success('✅');
            setStep('done');
            setTimeout(() => { if (onComplete) onComplete() }, 1500);
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    const stepIndex = ['choose', 'create-family', 'join-family', 'setup-vault', 'add-account', 'waiting-approval', 'done'].indexOf(step);
    const progressSteps = [
        { label: 'Familia', done: stepIndex > 2 || (step === 'join-family' && !!family) },
        { label: 'Seguridad', done: stepIndex > 3 || family?.isVaultEnabled },
        { label: 'Cuenta', done: step === 'done' },
        { label: '¡Listo!', done: step === 'done' },
    ];

    return (
        <div className="min-h-screen gradient-bg flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            {/* Top bar */}
            <div className="fixed top-4 right-4 flex gap-2 z-10">
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2.5 rounded-xl glass hover:scale-105 transition-all cursor-pointer">
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button onClick={() => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')} className="p-2.5 rounded-xl glass hover:scale-105 transition-all flex items-center gap-1.5 cursor-pointer">
                    <Globe size={18} /><span className="text-xs font-medium uppercase">{i18n.language}</span>
                </button>
                <button onClick={signOut} className="p-2.5 rounded-xl glass hover:scale-105 transition-all cursor-pointer" title="Sign out">
                    <LogOut size={18} />
                </button>
            </div>

            <div className="w-full max-w-md animate-slide-up">
                <div className="glass rounded-3xl p-8 shadow-xl shadow-primary-500/5">
                    {/* Logo */}
                    <div className="flex justify-center mb-4">
                        <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary-500/30">
                            <span className="text-white font-bold text-2xl">F</span>
                        </div>
                    </div>

                    {/* Progress indicator */}
                    {step !== 'choose' && step !== 'done' && (
                        <div className="flex items-center justify-center gap-2 mb-6">
                            {progressSteps.map((s, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${s.done ? 'bg-accent-500 text-white' :
                                        (i === 0 && (step === 'create-family' || step === 'join-family')) || (i === 1 && step === 'add-account')
                                            ? 'gradient-primary text-white' : 'bg-gray-200 dark:bg-primary-800 text-gray-500'
                                        }`}>
                                        {s.done ? <Check size={12} /> : i + 1}
                                    </div>
                                    <span className="text-[10px] font-medium text-text-muted-light dark:text-text-muted-dark">{s.label}</span>
                                    {i < 2 && <div className={`w-6 h-0.5 ${s.done ? 'bg-accent-500' : 'bg-gray-200 dark:bg-primary-800'}`} />}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* STEP: Choose create/join */}
                    {step === 'choose' && (
                        <div className="animate-fade-in">
                            <h1 className="text-xl font-bold text-center mb-1">
                                ¡Hola, {user?.displayName?.split(' ')[0]}!
                            </h1>
                            <p className="text-center text-text-muted-light dark:text-text-muted-dark text-sm mb-6">
                                Para empezar, crea tu familia o únete a una existente.
                            </p>
                            <div className="space-y-3">
                                <button onClick={() => setStep('create-family')} className="w-full flex items-center gap-4 p-4 rounded-xl bg-primary-50/50 dark:bg-primary-900/20 hover:bg-primary-100/70 dark:hover:bg-primary-900/40 transition-all cursor-pointer group">
                                    <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md shadow-primary-500/20">
                                        <Users size={22} className="text-white" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-semibold">{t('family.createFamily')}</p>
                                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark">Crea una nueva familia e invita a tu pareja</p>
                                    </div>
                                    <ChevronRight size={18} className="text-gray-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                                </button>

                                <button onClick={() => setStep('join-family')} className="w-full flex items-center gap-4 p-4 rounded-xl bg-accent-50/50 dark:bg-accent-900/10 hover:bg-accent-100/70 dark:hover:bg-accent-900/20 transition-all cursor-pointer group">
                                    <div className="w-11 h-11 rounded-xl gradient-accent flex items-center justify-center shadow-md shadow-accent-500/20">
                                        <UserPlus size={22} className="text-white" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-semibold">{t('family.joinFamily')}</p>
                                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark">Únete con un código de invitación</p>
                                    </div>
                                    <ChevronRight size={18} className="text-gray-400 group-hover:text-accent-500 group-hover:translate-x-1 transition-all" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: Create family */}
                    {step === 'create-family' && (
                        <div className="space-y-4 animate-fade-in">
                            <h2 className="text-lg font-bold text-center">{t('family.createFamily')}</h2>
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('family.familyName')}</label>
                                <input type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="Los García" className="input-field" autoFocus />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('common.currency')}</label>
                                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field">
                                    <option value="EUR">EUR (€)</option>
                                    <option value="MXN">MXN ($)</option>
                                    <option value="USD">USD ($)</option>
                                    <option value="GBP">GBP (£)</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setStep('choose')} className="btn-secondary flex-1 flex items-center justify-center gap-1">
                                    <ArrowLeft size={16} />{t('common.back')}
                                </button>
                                <button onClick={handleCreateFamily} disabled={loading || !familyName.trim()} className="btn-primary flex-1 flex items-center justify-center gap-1 disabled:opacity-50">
                                    {loading ? '...' : <>{t('common.create')} <ArrowRight size={16} /></>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: Join family */}
                    {step === 'join-family' && (
                        <div className="space-y-4 animate-fade-in">
                            <h2 className="text-lg font-bold text-center">{t('family.joinFamily')}</h2>
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('family.inviteCode')}</label>
                                <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="ABC12345" className="input-field text-center text-lg font-mono tracking-widest" maxLength={8} autoFocus />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setStep('choose')} className="btn-secondary flex-1 flex items-center justify-center gap-1">
                                    <ArrowLeft size={16} />{t('common.back')}
                                </button>
                                <button onClick={handleJoinFamily} disabled={loading || !inviteCode.trim()} className="btn-primary flex-1 flex items-center justify-center gap-1 disabled:opacity-50">
                                    {loading ? '...' : <>{t('family.joinFamily')} <ArrowRight size={16} /></>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: Setup Vault */}
                    {step === 'setup-vault' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="text-center">
                                <div className="w-12 h-12 mx-auto bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-3">
                                    <ShieldCheck size={24} className="text-primary-600 dark:text-primary-400" />
                                </div>
                                <h2 className="text-lg font-bold">Bóveda de Seguridad</h2>
                                <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
                                    Tus datos financieros son privados. Crea un PIN de 6 dígitos para encriptarlos localmente antes de guardarlos en la nube. **No lo olvides, no se puede recuperar.**
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1">PIN Segura (min 6 dígitos)</label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="password"
                                            maxLength={6}
                                            value={vaultPin}
                                            onChange={(e) => setVaultPin(e.target.value.replace(/\D/g, ''))}
                                            placeholder="••••••"
                                            className="input-field pl-10 text-center tracking-widest text-lg font-mono"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Confirmar PIN</label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="password"
                                            maxLength={6}
                                            value={confirmPin}
                                            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                                            placeholder="••••••"
                                            className="input-field pl-10 text-center tracking-widest text-lg font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSetupVault}
                                disabled={loading || vaultPin.length < 6 || confirmPin.length < 6 || vaultPin !== confirmPin}
                                className="btn-primary w-full flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                            >
                                {loading ? '...' : <>Activar Encriptación <ArrowRight size={16} /></>}
                            </button>
                        </div>
                    )}

                    {/* STEP: Add first account */}
                    {step === 'add-account' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="text-center">
                                <h2 className="text-lg font-bold">🏦 Añade tu primera cuenta</h2>
                                <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
                                    Añade la cuenta bancaria desde la que importarás movimientos.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre de la cuenta</label>
                                <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Cuenta principal" className="input-field" autoFocus />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Banco</label>
                                    <select value={bank} onChange={(e) => setBank(e.target.value)} className="input-field">
                                        <option value="">---</option>
                                        {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Tipo</label>
                                    <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} className="input-field">
                                        <option value="checking">Corriente</option>
                                        <option value="savings">Ahorro</option>
                                        <option value="credit">Crédito</option>
                                        <option value="cash">Efectivo</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Moneda</label>
                                <select value={accountCurrency} onChange={(e) => setAccountCurrency(e.target.value)} className="input-field">
                                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={handleAddAccount}
                                disabled={loading || !accountName.trim() || !bank.trim()}
                                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? '...' : <>Crear cuenta y continuar <ArrowRight size={16} /></>}
                            </button>
                            <button onClick={() => { setStep('done'); if (onComplete) onComplete(); }} className="w-full text-center text-xs text-text-muted-light dark:text-text-muted-dark hover:text-primary-500 transition-colors cursor-pointer py-1">
                                Saltar por ahora →
                            </button>
                        </div>
                    )}

                    {/* STEP: Waiting Approval */}
                    {step === 'waiting-approval' && (
                        <div className="text-center animate-fade-in space-y-4">
                            <div className="w-16 h-16 mx-auto bg-accent-100 dark:bg-accent-900/30 rounded-full flex items-center justify-center mb-3">
                                <ShieldCheck size={32} className="text-accent-600 dark:text-accent-400" />
                            </div>
                            <h2 className="text-xl font-bold">¡Bienvenido a {family?.name}!</h2>
                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                Te has unido correctamente a la familia. Sin embargo, para poder ver la información financiera necesitas acceso a la Bóveda de Seguridad.
                            </p>
                            <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mt-2">
                                Por favor, pídele al administrador de la familia que apruebe tu acceso desde la sección "Miembros".
                            </p>
                            <button onClick={() => { setStep('done'); if (onComplete) onComplete(); }} className="btn-primary w-full flex items-center justify-center gap-2 mt-6">
                                Ir al Inicio <ArrowRight size={16} />
                            </button>
                        </div>
                    )}

                    {/* STEP: Done */}
                    {step === 'done' && (
                        <div className="text-center animate-fade-in space-y-4">
                            <div className="text-5xl">🎉</div>
                            <h2 className="text-xl font-bold">¡Todo listo!</h2>
                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                Tu familia y cuenta están configuradas. Ya puedes empezar a gestionar tus finanzas.
                            </p>
                            <div className="pt-2">
                                {/* This will trigger FamilyGuard to pass because family now exists,
                    and the onSnapshot will re-fire, setting family state */}
                                <p className="text-xs text-text-muted-light dark:text-text-muted-dark animate-pulse">
                                    Cargando dashboard...
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                    FamFinance © {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
}
