import {
    collection,
    doc,
    query,
    where,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    onSnapshot,
    orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Debt } from '../types';
import { getMemoryVaultKey, encryptText, encryptAmount, decryptText, decryptAmount } from './crypto.service';

const COLLECTION = 'debts';

export function subscribeToDebts(
    familyId: string,
    callback: (debts: Debt[]) => void
) {
    const q = query(
        collection(db, COLLECTION),
        where('familyId', '==', familyId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, async (snapshot) => {
        const key = getMemoryVaultKey();

        const promises = snapshot.docs.map(async (d) => {
            const data = d.data();
            let name = data.name;
            let totalAmount = data.totalAmount;
            let paidAmount = data.paidAmount;
            let minimumPayment = data.minimumPayment;

            if (key) {
                if (typeof data.name === 'string' && data.name.includes(':')) {
                    name = await decryptText(data.name, key);
                }
                if (typeof data.totalAmount === 'string' && data.totalAmount.includes(':')) {
                    totalAmount = await decryptAmount(data.totalAmount, key);
                }
                if (typeof data.paidAmount === 'string' && data.paidAmount.includes(':')) {
                    paidAmount = await decryptAmount(data.paidAmount, key);
                }
                if (typeof data.minimumPayment === 'string' && data.minimumPayment.includes(':')) {
                    minimumPayment = await decryptAmount(data.minimumPayment, key);
                }
            }

            return {
                id: d.id,
                ...data,
                name,
                totalAmount,
                paidAmount,
                minimumPayment,
                createdAt: data.createdAt?.toDate?.() || new Date(),
                dueDate: data.dueDate?.toDate?.() || null,
            } as Debt;
        });

        const debts = await Promise.all(promises);
        callback(debts);
    });
}

export async function createDebt(
    data: Omit<Debt, 'id' | 'createdAt'>
): Promise<string> {
    const key = getMemoryVaultKey();
    let { name, totalAmount, paidAmount, minimumPayment, ...restData } = data as any;

    if (key) {
        name = await encryptText(data.name, key);
        totalAmount = await encryptAmount(data.totalAmount, key);
        paidAmount = await encryptAmount(data.paidAmount, key);
        minimumPayment = await encryptAmount(data.minimumPayment, key);
    }

    const docRef = await addDoc(collection(db, COLLECTION), {
        ...restData,
        name,
        totalAmount,
        paidAmount,
        minimumPayment,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function updateDebt(
    id: string,
    data: Partial<Omit<Debt, 'id' | 'createdAt'>>
): Promise<void> {
    const updateData: Record<string, unknown> = { ...data };
    const key = getMemoryVaultKey();

    if (key) {
        if (data.name !== undefined) updateData.name = await encryptText(data.name, key);
        if (data.totalAmount !== undefined) updateData.totalAmount = await encryptAmount(data.totalAmount, key);
        if (data.paidAmount !== undefined) updateData.paidAmount = await encryptAmount(data.paidAmount, key);
        if (data.minimumPayment !== undefined) updateData.minimumPayment = await encryptAmount(data.minimumPayment, key);
    }

    await updateDoc(doc(db, COLLECTION, id), updateData);
}

export async function deleteDebt(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
}

export async function addPayment(
    debtId: string,
    currentPaidAmount: number,
    paymentAmount: number
): Promise<void> {
    const newPaid = currentPaidAmount + paymentAmount;
    const key = getMemoryVaultKey();
    let updatedPaidAmount: number | string = newPaid;

    if (key) {
        updatedPaidAmount = await encryptAmount(newPaid, key);
    }

    await updateDoc(doc(db, COLLECTION, debtId), {
        paidAmount: updatedPaidAmount,
    });
}
