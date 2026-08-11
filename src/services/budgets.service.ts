import {
    collection,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Budget } from '../types';

export const subscribeToBudgets = (familyId: string, callback: (budgets: Budget[]) => void) => {
    const q = query(
        collection(db, 'budgets'),
        where('familyId', '==', familyId)
    );

    return onSnapshot(q, (snapshot) => {
        const budgets = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as Budget[];
        
        // Sort by startMonth desc
        budgets.sort((a, b) => b.startMonth.localeCompare(a.startMonth));
        callback(budgets);
    });
};

export const createBudget = async (budget: Omit<Budget, 'id' | 'createdAt'>): Promise<string> => {
    const newDocRef = doc(collection(db, 'budgets'));
    const newBudget: Budget = {
        ...budget,
        id: newDocRef.id,
        createdAt: new Date(),
    };
    await setDoc(newDocRef, newBudget);
    return newDocRef.id;
};

export const updateBudget = async (id: string, data: Partial<Omit<Budget, 'id' | 'familyId' | 'createdAt'>>) => {
    const docRef = doc(db, 'budgets', id);
    await updateDoc(docRef, data);
};

export const deleteBudget = async (id: string) => {
    const docRef = doc(db, 'budgets', id);
    await deleteDoc(docRef);
};

// Helper: When updating a budget's amount or categories starting from a new month,
// we close the old budget and create a new one to preserve history.
export const rolloverBudget = async (
    oldBudget: Budget,
    newAmount: number,
    newCategoryIds: string[],
    newStartMonth: string // YYYY-MM
) => {
    // 1. Close old budget just before the new one starts
    const date = new Date(newStartMonth + '-01T00:00:00Z');
    date.setUTCMonth(date.getUTCMonth() - 1);
    const endMonth = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    
    await updateBudget(oldBudget.id, { endMonth });

    // 2. Create new budget
    return await createBudget({
        familyId: oldBudget.familyId,
        name: oldBudget.name,
        amount: newAmount,
        categoryIds: newCategoryIds,
        period: oldBudget.period,
        startMonth: newStartMonth,
        versionGroupId: oldBudget.versionGroupId || oldBudget.id,
    });
};
