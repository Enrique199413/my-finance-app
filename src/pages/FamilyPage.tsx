import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamily } from '../context/FamilyContext';
import { Users, UserPlus, Copy, Check, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FamilyPage() {
    const { t } = useTranslation();
    const { family, members, createFamily, joinFamily } = useFamily();
    const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
    const [familyName, setFamilyName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCreate = async () => {
        if (!familyName.trim()) return;
        setLoading(true);
        try {
            await createFamily(familyName.trim());
            toast.success(t('family.title') + ' ✨');
        } catch (err) {
            toast.error(String(err));
        }
        setLoading(false);
    };

    const handleJoin = async () => {
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

    const copyCode = async () => {
        if (!family) return;
        await navigator.clipboard.writeText(family.inviteCode);
        setCopied(true);
        toast.success(t('family.codeCopied'));
        setTimeout(() => setCopied(false), 2000);
    };

    // Family exists — show family view
    if (family) {
        return (
            <div className="space-y-6 animate-fade-in">
                <h1 className="text-2xl font-bold">{t('family.title')}</h1>

                {/* Family card */}
                <div className="card">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                                <Users size={24} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{family.name}</h2>
                                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                    {members.length} {t('family.members').toLowerCase()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Invite code */}
                    <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 mb-6">
                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark mb-2">
                            {t('family.shareCode')}
                        </p>
                        <div className="flex items-center gap-3">
                            <code className="flex-1 text-xl font-mono font-bold tracking-[0.3em] text-primary-600 dark:text-primary-400">
                                {family.inviteCode}
                            </code>
                            <button
                                onClick={copyCode}
                                className="p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-800/30 transition-colors"
                            >
                                {copied ? (
                                    <Check size={20} className="text-accent-500" />
                                ) : (
                                    <Copy size={20} className="text-primary-500" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Members list */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">
                            {t('family.members')}
                        </h3>
                        {members.map((member) => (
                            <div
                                key={member.id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-primary-900/10 hover:bg-gray-100 dark:hover:bg-primary-900/20 transition-colors"
                            >
                                {member.photoURL ? (
                                    <img
                                        src={member.photoURL}
                                        alt=""
                                        className="w-10 h-10 rounded-full ring-2 ring-primary-200 dark:ring-primary-700"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">
                                            {member.displayName?.charAt(0) || '?'}
                                        </span>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <p className="font-medium">{member.displayName}</p>
                                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                                        {t(`family.${member.role}`)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // No family — onboarding
    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <div className="w-full max-w-md animate-slide-up">
                {mode === 'choose' && (
                    <div className="text-center space-y-6">
                        <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-lg shadow-primary-500/30">
                            <Users size={36} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold mb-2">{t('family.noFamily')}</h1>
                            <p className="text-text-muted-light dark:text-text-muted-dark">
                                {t('family.noFamilyDesc')}
                            </p>
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={() => setMode('create')}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                <Users size={18} />
                                {t('family.createFamily')}
                                <ArrowRight size={16} />
                            </button>
                            <button
                                onClick={() => setMode('join')}
                                className="btn-secondary w-full flex items-center justify-center gap-2"
                            >
                                <UserPlus size={18} />
                                {t('family.joinFamily')}
                            </button>
                        </div>
                    </div>
                )}

                {mode === 'create' && (
                    <div className="card space-y-5">
                        <h2 className="text-xl font-bold">{t('family.createFamily')}</h2>
                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                {t('family.familyName')}
                            </label>
                            <input
                                type="text"
                                value={familyName}
                                onChange={(e) => setFamilyName(e.target.value)}
                                placeholder={t('family.familyNamePlaceholder')}
                                className="input-field"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setMode('choose')}
                                className="btn-secondary flex-1"
                            >
                                {t('common.back')}
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={loading || !familyName.trim()}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {loading ? t('family.creating') : t('common.create')}
                            </button>
                        </div>
                    </div>
                )}

                {mode === 'join' && (
                    <div className="card space-y-5">
                        <h2 className="text-xl font-bold">{t('family.joinFamily')}</h2>
                        <div>
                            <label className="block text-sm font-medium mb-1.5">
                                {t('family.inviteCode')}
                            </label>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                placeholder={t('family.inviteCodePlaceholder')}
                                className="input-field text-center font-mono text-lg tracking-[0.2em] uppercase"
                                maxLength={8}
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setMode('choose')}
                                className="btn-secondary flex-1"
                            >
                                {t('common.back')}
                            </button>
                            <button
                                onClick={handleJoin}
                                disabled={loading || !inviteCode.trim()}
                                className="btn-primary flex-1 disabled:opacity-50"
                            >
                                {loading ? t('family.joining') : t('family.joinFamily')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
