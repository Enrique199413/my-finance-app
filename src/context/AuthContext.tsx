import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
import type { AppUser } from '../types';

interface AuthContextType {
    user: User | null;
    appUser: AppUser | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                // Get or create user doc in Firestore
                const userRef = doc(db, 'users', firebaseUser.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    setAppUser({ ...userSnap.data(), uid: firebaseUser.uid } as AppUser);
                } else {
                    const newUser: Omit<AppUser, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email || '',
                        displayName: firebaseUser.displayName || '',
                        photoURL: firebaseUser.photoURL || undefined,
                        createdAt: serverTimestamp(),
                    };
                    await setDoc(userRef, newUser);
                    setAppUser({
                        ...newUser,
                        createdAt: new Date(),
                    } as AppUser);
                }
            } else {
                setAppUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        await signInWithPopup(auth, googleProvider);
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
        setAppUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, appUser, loading, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
