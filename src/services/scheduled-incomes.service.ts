import {
    collection,
    doc,
    query,
    where,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ScheduledIncome } from '../types';
import { getMemoryVaultKey, encryptText, encryptAmount, decryptText, decryptAmount } from './crypto.service';

const COLLECTION = 'scheduled_incomes';

export function subscribeToScheduledIncomes(
    familyId: string,
    callback: (incomes: ScheduledIncome[]) => void
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
            let estimatedAmount = data.estimatedAmount;

            if (key) {
                if (typeof data.name === 'string' && data.name.includes(':')) {
                    try {
                        name = await decryptText(data.name, key);
                    } catch (e) {
                        console.error('Failed to decrypt scheduled income name');
                    }
                }
                if (typeof data.estimatedAmount === 'string' && data.estimatedAmount.includes(':')) {
                    try {
                        estimatedAmount = await decryptAmount(data.estimatedAmount, key);
                    } catch (e) {
                        console.error('Failed to decrypt scheduled income amount');
                    }
                }
            }

            return {
                id: d.id,
                familyId: data.familyId,
                name,
                estimatedAmount,
                categoryId: data.categoryId,
                accountId: data.accountId,
                createdAt: data.createdAt?.toDate() || new Date(),
            } as ScheduledIncome;
        });

        const incomes = await Promise.all(promises);
        callback(incomes);
    });
}

export async function createScheduledIncome(
    data: Omit<ScheduledIncome, 'id' | 'createdAt'>
): Promise<string> {
    const key = getMemoryVaultKey();
    let nameToSave = data.name;
    let amountToSave: number | string = data.estimatedAmount;

    if (key) {
        nameToSave = await encryptText(data.name, key);
        amountToSave = await encryptAmount(data.estimatedAmount, key);
    }

    const docRef = await addDoc(collection(db, COLLECTION), {
        familyId: data.familyId,
        name: nameToSave,
        estimatedAmount: amountToSave,
        categoryId: data.categoryId,
        accountId: data.accountId,
        createdAt: new Date(),
    });
    return docRef.id;
}

export async function updateScheduledIncome(
    id: string,
    data: Partial<Omit<ScheduledIncome, 'id' | 'familyId' | 'createdAt'>>
): Promise<void> {
    const key = getMemoryVaultKey();
    const updateData: any = { ...data };

    if (key) {
        if (data.name !== undefined) {
            updateData.name = await encryptText(data.name, key);
        }
        if (data.estimatedAmount !== undefined) {
            updateData.estimatedAmount = await encryptAmount(data.estimatedAmount, key);
        }
    }

    await updateDoc(doc(db, COLLECTION, id), updateData);
}

export async function deleteScheduledIncome(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
}
