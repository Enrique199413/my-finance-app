import { useState, useEffect } from 'react';
import { ShieldCheck, Lock, ArrowRight, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { getMemoryVaultKey, setMemoryVaultKey, unlockEscrowPayload, type EscrowPayload } from '../../services/crypto.service';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function VaultUnlockGuard({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { family } = useFamily();
    const [isLocked, setIsLocked] = useState(false);
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [escrowPayload, setEscrowPayload] = useState<EscrowPayload | null>(null);

    useEffect(() => {
        // If no user/family, or vault is not enabled for this family, do nothing.
        if (!user || !family || !family.isVaultEnabled) {
            setIsLocked(false);
            return;
        }

        // If the vault is enabled, check if we have the key in RAM
        const memKey = getMemoryVaultKey();
        if (memKey) {
            setIsLocked(false);
            return;
        }

        // Key is NOT in RAM but vault is enabled. We need to lock the app and fetch the Escrow
        setIsLocked(true);
        fetchEscrow();

        async function fetchEscrow() {
            try {
                const escrowRef = doc(db, 'families', family!.id, 'escrow', user!.uid);
                const escrowSnap = await getDoc(escrowRef);
                if (escrowSnap.exists()) {
                    setEscrowPayload(escrowSnap.data() as EscrowPayload);
                } else {
                    toast.error('No se encontró llave de recuperación para esta Bóveda. Contacte soporte.');
                }
            } catch (err) {
                console.error("Error fetching escrow:", err);
                toast.error("Error al obtener datos de la Bóveda");
            }
        }
    }, [user, family]);

    const handleUnlock = async () => {
        if (!escrowPayload) return;
        if (pin.length < 6) return;

        setLoading(true);
        try {
            // Attempt to derive KEK from entered PIN and decrypt the Escrow Payload
            const unlockedMasterKey = await unlockEscrowPayload(escrowPayload, pin);

            // If we succeed, save it back to RAM
            setMemoryVaultKey(unlockedMasterKey);

            toast.success('Bóveda Desbloqueada 🔓');
            setIsLocked(false);
            setPin('');
        } catch (err) {
            console.error("Failed to unlock vault:", err);
            toast.error('PIN incorrecto. No se pudo desbloquear la Bóveda.');
            setPin(''); // Clear input on failure for security
        }
        setLoading(false);
    };

    if (!isLocked) {
        return <>{children}</>;
    }

    // App is locked because it needs the PIN to get the memory key
    return (
        <div className="min-h-screen flex items-center justify-center gradient-bg p-4 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="w-full max-w-md animate-slide-up z-10">
                <div className="glass rounded-3xl p-8 shadow-xl shadow-primary-500/5 text-center">
                    <div className="w-16 h-16 mx-auto bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                        <ShieldCheck size={32} className="text-primary-600 dark:text-primary-400" />
                    </div>

                    <h1 className="text-2xl font-bold mb-2">Bóveda Bloqueada</h1>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-8 leading-relaxed">
                        Esta familia tiene cifrado de extremo a extremo activado.
                        Ingresa tu PIN de seguridad para descifrar la llave maestra en tu navegador.
                    </p>

                    {!escrowPayload ? (
                        <div className="flex flex-col items-center justify-center py-4 text-primary-500 animate-pulse">
                            <Loader size={24} className="animate-spin mb-2" />
                            <span className="text-sm">Obteniendo credenciales seguras...</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <div className="relative max-w-xs mx-auto">
                                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="password"
                                        maxLength={6}
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                                        placeholder="••••••"
                                        className="input-field pl-12 text-center tracking-[0.5em] text-xl font-mono py-3"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleUnlock}
                                disabled={loading || pin.length < 6}
                                className="btn-primary w-full max-w-xs mx-auto flex items-center justify-center gap-2 py-3 disabled:opacity-50 mt-4"
                            >
                                {loading ? 'Descifrando...' : <>Desbloquear <ArrowRight size={18} /></>}
                            </button>
                        </div>
                    )}
                </div>

                <p className="text-center text-xs text-text-muted-light dark:text-text-muted-dark mt-6 flex items-center justify-center gap-1 opacity-70">
                    <Lock size={10} /> Tus datos nunca tocan nuestros servidores sin cifrar
                </p>
            </div>
        </div>
    );
}
