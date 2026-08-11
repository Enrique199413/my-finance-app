import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import type { CategorizationRule, Category } from '../types';
import { getTransactionsByFamily } from './transactions.service';

const RULES_COL = 'categorization_rules';

export function subscribeToRules(
    familyId: string,
    callback: (rules: CategorizationRule[]) => void
) {
    const q = query(collection(db, RULES_COL), where('familyId', '==', familyId));
    return onSnapshot(q, (snapshot) => {
        const rules: CategorizationRule[] = [];
        snapshot.forEach((doc) => {
            rules.push({
                ...doc.data(),
                id: doc.id,
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            } as CategorizationRule);
        });
        callback(rules);
    });
}

export async function getRulesByFamily(familyId: string): Promise<CategorizationRule[]> {
    const q = query(collection(db, RULES_COL), where('familyId', '==', familyId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
    } as CategorizationRule));
}

export async function createRule(
    familyId: string,
    pattern: string,
    matchType: 'exact' | 'contains' | 'startsWith',
    categoryId: string
) {
    const ref = doc(collection(db, RULES_COL));
    await setDoc(ref, {
        familyId,
        pattern,
        matchType,
        categoryId,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export async function updateRule(
    ruleId: string,
    data: Partial<Omit<CategorizationRule, 'id' | 'familyId' | 'createdAt'>>
) {
    const ref = doc(db, RULES_COL, ruleId);
    await setDoc(ref, data, { merge: true });
}

export async function deleteRule(ruleId: string) {
    const ref = doc(db, RULES_COL, ruleId);
    await deleteDoc(ref);
}

/**
 * Dynamically infers categorization rules based on the family's transaction history.
 * Ensures that the inferred category actually exists in the provided categories list.
 */
export async function getInferredRules(familyId: string, currentCategories: Category[]): Promise<CategorizationRule[]> {
    if (!currentCategories || currentCategories.length === 0) return [];
    
    const historyTxs = await getTransactionsByFamily(familyId, 1000);
    const categoryFreqMap = new Map<string, Map<string, number>>();

    const normalize = (desc: string) => {
        return desc.toLowerCase()
            .replace(/[0-9]/g, '') // remove numbers
            .replace(/[^a-zñáéíóú\s]/g, ' ') // keep only letters
            .replace(/\s+/g, ' ')
            .trim();
    };

    const validCategoryIds = new Set(currentCategories.map(c => c.id));

    historyTxs.forEach(tx => {
        if (!tx.categoryId || !tx.description) return;
        // Skip if the assigned category no longer exists
        if (!validCategoryIds.has(tx.categoryId)) return;

        const normDesc = normalize(tx.description);
        if (!normDesc) return;

        if (!categoryFreqMap.has(normDesc)) {
            categoryFreqMap.set(normDesc, new Map<string, number>());
        }
        const freqMap = categoryFreqMap.get(normDesc)!;
        freqMap.set(tx.categoryId, (freqMap.get(tx.categoryId) || 0) + 1);
    });

    const inferredRules: CategorizationRule[] = [];
    let idCounter = 1;

    categoryFreqMap.forEach((freqMap, normDesc) => {
        let bestCategory = '';
        let maxCount = 0;
        freqMap.forEach((count, categoryId) => {
            if (count > maxCount) {
                maxCount = count;
                bestCategory = categoryId;
            }
        });

        if (bestCategory) {
            inferredRules.push({
                id: `inferred-${idCounter++}`,
                familyId,
                pattern: normDesc,
                matchType: 'contains', // Inferred rules generally match if the description contains the words
                categoryId: bestCategory,
                createdAt: new Date(),
                inferred: true
            });
        }
    });

    return inferredRules;
}
