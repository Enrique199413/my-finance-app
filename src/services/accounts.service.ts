import {
    collection,
    doc,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { BankAccount } from '../types';

const COLLECTION = 'accounts';


export async function createAccount(
    data: Omit<BankAccount, 'id' | 'createdAt'>
): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function updateAccount(
    id: string,
    data: Partial<Omit<BankAccount, 'id' | 'createdAt'>>
): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), data);
}

export async function deleteAccount(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
}

export async function getAccountsByFamily(familyId: string): Promise<BankAccount[]> {
    const q = query(
        collection(db, COLLECTION),
        where('familyId', '==', familyId),
        orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
    })) as BankAccount[];
}
