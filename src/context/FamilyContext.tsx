import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
    collection,
    doc,
    query,
    where,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';
import type { Family, FamilyMember } from '../types';
import {
    generateMasterVaultKey,
    createEscrowPayload,
    setMemoryVaultKey,
    generateRSAKeyPair
} from '../services/crypto.service';

interface FamilyContextType {
    family: Family | null;
    families: Family[];
    members: FamilyMember[];
    loading: boolean;
    isNewUser: boolean;
    createFamily: (name: string, currency?: string) => Promise<void>;
    joinFamily: (inviteCode: string) => Promise<void>;
    switchFamily: (familyId: string) => void;
    enableFamilyVault: (pin: string) => Promise<void>;
    removeMember: (memberId: string) => Promise<void>;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

const ACTIVE_FAMILY_KEY = 'famfinance_active_family';

function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export function FamilyProvider({ children }: { children: ReactNode }) {
    const { user, appUser } = useAuth();
    const [families, setFamilies] = useState<Family[]>([]);
    const [family, setFamily] = useState<Family | null>(null);
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [isNewUser, setIsNewUser] = useState(false);

    // Listen to all family memberships for the user
    useEffect(() => {
        if (!user) {
            setFamilies([]);
            setFamily(null);
            setMembers([]);
            setLoading(false);
            return;
        }

        const membershipsQuery = query(
            collection(db, 'familyMembers'),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(membershipsQuery, async (snapshot) => {
            if (snapshot.empty) {
                setFamilies([]);
                setFamily(null);
                setMembers([]);
                setIsNewUser(true);
                setLoading(false);
                return;
            }

            setIsNewUser(false);

            // Fetch all families the user belongs to
            const memberDocs = snapshot.docs.map((d) => d.data() as FamilyMember & { familyId: string });
            const familyIds = memberDocs.map((m) => m.familyId);

            const familyPromises = familyIds.map(async (fid) => {
                const familyRef = doc(db, 'families', fid);
                const familySnap = await getDoc(familyRef);
                if (familySnap.exists()) {
                    return { id: familySnap.id, ...familySnap.data() } as Family;
                }
                return null;
            });

            const allFamilies = (await Promise.all(familyPromises)).filter(Boolean) as Family[];
            setFamilies(allFamilies);

            // Determine active family
            const storedId = localStorage.getItem(ACTIVE_FAMILY_KEY);
            const activeFamily = allFamilies.find((f) => f.id === storedId) || allFamilies[0] || null;
            setFamily(activeFamily);

            if (activeFamily) {
                localStorage.setItem(ACTIVE_FAMILY_KEY, activeFamily.id);

                // Load members for active family
                const membersQuery = query(
                    collection(db, 'familyMembers'),
                    where('familyId', '==', activeFamily.id)
                );
                const membersSnap = await getDocs(membersQuery);
                const membersData = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember);
                setMembers(membersData);

                // Handle RSA Key Generation for current user if missing
                const myMemberRecord = membersData.find(m => m.userId === user.uid);
                if (myMemberRecord && !myMemberRecord.publicKey) {
                    try {
                        console.log("Generating RSA Key Pair for Vault Sync...");
                        const keyPair = await generateRSAKeyPair();
                        // Save Private Key locally (in localStorage for now, ideally IndexedDB with PIN)
                        localStorage.setItem(`rsa_private_${user.uid}`, keyPair.privateKey);

                        // Upload Public Key to Firestore Profile
                        await updateDoc(doc(db, 'familyMembers', myMemberRecord.id), {
                            publicKey: keyPair.publicKey
                        });
                        console.log("Uploaded Public Key successfully.");
                    } catch (e) {
                        console.error("Error generating/uploading RSA key:", e);
                    }
                }
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const switchFamily = useCallback((familyId: string) => {
        const target = families.find((f) => f.id === familyId);
        if (target) {
            setFamily(target);
            localStorage.setItem(ACTIVE_FAMILY_KEY, familyId);
            // Reload members for new family
            const membersQuery = query(
                collection(db, 'familyMembers'),
                where('familyId', '==', familyId)
            );
            getDocs(membersQuery).then((snap) => {
                setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember));
            });
        }
    }, [families]);

    const createFamily = useCallback(async (name: string, currency: string = 'EUR') => {
        if (!user || !appUser) return;

        const familyRef = doc(collection(db, 'families'));
        const familyData = {
            name,
            ownerId: user.uid,
            inviteCode: generateInviteCode(),
            currency,
            isVaultEnabled: false,
            createdAt: serverTimestamp(),
        };

        await setDoc(familyRef, familyData);

        // Add owner as first member
        const memberRef = doc(collection(db, 'familyMembers'));
        await setDoc(memberRef, {
            familyId: familyRef.id,
            userId: user.uid,
            displayName: appUser.displayName,
            photoURL: appUser.photoURL || null,
            role: 'owner',
            joinedAt: serverTimestamp(),
        });

        // Switch to new family
        localStorage.setItem(ACTIVE_FAMILY_KEY, familyRef.id);
    }, [user, appUser]);

    const joinFamily = useCallback(async (inviteCode: string) => {
        if (!user || !appUser) return;

        const familiesQuery = query(
            collection(db, 'families'),
            where('inviteCode', '==', inviteCode.toUpperCase().trim())
        );
        const familiesSnap = await getDocs(familiesQuery);

        if (familiesSnap.empty) {
            throw new Error('Invalid invite code');
        }

        const familyDoc = familiesSnap.docs[0];

        // Check if already a member
        const existingQuery = query(
            collection(db, 'familyMembers'),
            where('familyId', '==', familyDoc.id),
            where('userId', '==', user.uid)
        );
        const existingSnap = await getDocs(existingQuery);
        if (!existingSnap.empty) {
            throw new Error('Already a member');
        }

        const memberRef = doc(collection(db, 'familyMembers'));
        await setDoc(memberRef, {
            familyId: familyDoc.id,
            userId: user.uid,
            displayName: appUser.displayName,
            photoURL: appUser.photoURL || null,
            role: 'member',
            joinedAt: serverTimestamp(),
        });

        localStorage.setItem(ACTIVE_FAMILY_KEY, familyDoc.id);
    }, [user, appUser]);

    const enableFamilyVault = useCallback(async (pin: string) => {
        if (!user || !family) throw new Error('No active user or family');
        if (family.isVaultEnabled) throw new Error('Vault is already enabled for this family');

        try {
            // 1. Generate the Master Vault Key
            const masterKey = await generateMasterVaultKey();

            // 2. Encrypt it with the PIN
            const escrowPayload = await createEscrowPayload(masterKey, pin);

            // 3. Save the Escrow document
            const escrowRef = doc(db, 'families', family.id, 'escrow', user.uid);
            await setDoc(escrowRef, {
                familyId: family.id,
                userId: user.uid,
                salt: escrowPayload.salt,
                encryptedKey: escrowPayload.encryptedKey,
                updatedAt: serverTimestamp(),
            } as any);

            // 4. Update the Family document to indicate E2EE is active
            const familyRef = doc(db, 'families', family.id);
            await setDoc(familyRef, { isVaultEnabled: true }, { merge: true });

            // 5. Keep it in RAM for the current session
            setMemoryVaultKey(masterKey);

            // Update local state temporarily until snapshot catches it
            setFamily({ ...family, isVaultEnabled: true });
        } catch (err) {
            console.error('Failed to enable E2EE vault:', err);
            throw err;
        }
    }, [user, family]);

    const removeMember = useCallback(async (memberId: string) => {
        if (!user || !family) throw new Error('No active user or family');
        if (family.ownerId !== user.uid) throw new Error('Only the owner can remove members');
        if (memberId === user.uid) throw new Error('Cannot remove yourself');

        const memberRecord = members.find(m => m.userId === memberId);
        if (!memberRecord) throw new Error('Member not found');

        try {
            await deleteDoc(doc(db, 'familyMembers', memberRecord.id));
            await deleteDoc(doc(db, 'families', family.id, 'escrow', memberId));
        } catch (err) {
            console.error('Failed to remove member:', err);
            throw err;
        }
    }, [user, family, members]);

    return (
        <FamilyContext.Provider value={{ family, families, members, loading, isNewUser, createFamily, joinFamily, switchFamily, enableFamilyVault, removeMember }}>
            {children}
        </FamilyContext.Provider>
    );
}

export function useFamily() {
    const context = useContext(FamilyContext);
    if (!context) throw new Error('useFamily must be used within FamilyProvider');
    return context;
}
