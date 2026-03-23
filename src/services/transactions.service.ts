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
    limit,
    orderBy,
    writeBatch,
    Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction } from '../types';
import { getMemoryVaultKey, encryptText, encryptAmount, decryptText, decryptAmount } from './crypto.service';

const COLLECTION = 'transactions';


export async function createTransaction(
    data: Omit<Transaction, 'id' | 'createdAt'>
): Promise<string> {
    const key = getMemoryVaultKey();
    let { amount, description, ...restData } = data as any;

    if (key) {
        amount = await encryptAmount(data.amount, key);
        description = await encryptText(data.description, key);
    }

    const docRef = await addDoc(collection(db, COLLECTION), {
        ...restData,
        amount,
        description,
        date: Timestamp.fromDate(data.date instanceof Date ? data.date : new Date(data.date)),
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function updateTransaction(
    id: string,
    data: Partial<Omit<Transaction, 'id' | 'createdAt'>>
): Promise<void> {
    const updateData: Record<string, unknown> = { ...data };
    const key = getMemoryVaultKey();

    if (key) {
        if (data.amount !== undefined) updateData.amount = await encryptAmount(data.amount, key);
        if (data.description !== undefined) updateData.description = await encryptText(data.description, key);
    }

    if (data.date) {
        updateData.date = Timestamp.fromDate(
            data.date instanceof Date ? data.date : new Date(data.date)
        );
    }
    await updateDoc(doc(db, COLLECTION, id), updateData);
}

export async function deleteTransaction(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
}

export async function importTransactions(
    transactions: Omit<Transaction, 'id' | 'createdAt'>[]
): Promise<number> {
    // Firestore batch limit is 500
    const batchSize = 400;
    let imported = 0;
    const key = getMemoryVaultKey();

    for (let i = 0; i < transactions.length; i += batchSize) {
        const chunk = transactions.slice(i, i + batchSize);
        const batch = writeBatch(db);

        for (const tx of chunk) {
            const ref = doc(collection(db, COLLECTION));

            let amount = tx.amount as any;
            let description = tx.description;

            if (key) {
                amount = await encryptAmount(tx.amount, key);
                description = await encryptText(tx.description, key);
            }

            batch.set(ref, {
                ...tx,
                amount,
                description,
                date: Timestamp.fromDate(tx.date instanceof Date ? tx.date : new Date(tx.date)),
                createdAt: serverTimestamp(),
            });
        }

        await batch.commit();
        imported += chunk.length;
    }

    return imported;
}

export async function getTransactionsByFamily(
    familyId: string,
    limitCount: number = 500
): Promise<Transaction[]> {
    const q = query(
        collection(db, COLLECTION),
        where('familyId', '==', familyId),
        orderBy('date', 'desc'),
        limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const key = getMemoryVaultKey();

    const txPromises = snapshot.docs.map(async (d) => {
        const data = d.data();

        let amount = data.amount;
        let description = data.description;

        if (key) {
            if (typeof data.amount === 'string' && data.amount.includes(':')) {
                amount = await decryptAmount(data.amount, key);
            }
            if (data.description && typeof data.description === 'string' && data.description.includes(':')) {
                description = await decryptText(data.description, key);
            }
        }

        return {
            id: d.id,
            ...data,
            amount,
            description,
            date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
            createdAt: data.createdAt?.toDate?.() || new Date(),
        } as Transaction;
    });

    return Promise.all(txPromises);
}

export async function deleteTransactionsByDateRange(
    familyId: string,
    startDate: Date,
    endDate: Date
): Promise<number> {
    const q = query(
        collection(db, COLLECTION),
        where('familyId', '==', familyId),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;

    let deleted = 0;
    const batchSize = 400;

    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const chunk = snapshot.docs.slice(i, i + batchSize);
        const batch = writeBatch(db);

        for (const docSnap of chunk) {
            batch.delete(docSnap.ref);
        }

        await batch.commit();
        deleted += chunk.length;
    }

    return deleted;
}
