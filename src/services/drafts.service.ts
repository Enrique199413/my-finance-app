import {
    collection,
    doc,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    orderBy,
    writeBatch,
    Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { getTransactionsByFamily } from './transactions.service';
import type { DraftBatch, DraftTransaction } from '../types';
import { getMemoryVaultKey, encryptText, encryptAmount, decryptText, decryptAmount } from './crypto.service';

const BATCHES_COL = 'draft_batches';
const TXS_COL = 'draft_transactions';

export async function createDraftBatch(
    familyId: string,
    accountId: string,
    fileName: string,
    totalRows: number
): Promise<string> {
    const docRef = await addDoc(collection(db, BATCHES_COL), {
        familyId,
        accountId,
        fileName,
        status: 'uploading',
        totalRows,
        processedRows: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
}

export async function updateDraftBatchStatus(
    batchId: string,
    status: DraftBatch['status'],
    processedRows?: number
) {
    const updates: any = { status, updatedAt: serverTimestamp() };
    if (processedRows !== undefined) {
        updates.processedRows = processedRows;
    }
    await updateDoc(doc(db, BATCHES_COL, batchId), updates);
}

export function subscribeToFamilyDrafts(
    familyId: string,
    callback: (batches: DraftBatch[]) => void
) {
    const q = query(
        collection(db, BATCHES_COL),
        where('familyId', '==', familyId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const batches = snapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || new Date(),
                updatedAt: data.updatedAt?.toDate?.() || new Date(),
            } as DraftBatch;
        });
        callback(batches);
    });
}

export async function getDraftTransactions(batchId: string): Promise<DraftTransaction[]> {
    const q = query(collection(db, TXS_COL), where('importBatch', '==', batchId));
    const snapshot = await getDocs(q);
    const key = getMemoryVaultKey();

    const txPromises = snapshot.docs.map(async (d) => {
        const data = d.data();
        let amount = data.amount;
        let description = data.description;
        let originalDescription = data.originalDescription;

        if (key) {
            if (typeof data.amount === 'string' && data.amount.includes(':')) {
                amount = await decryptAmount(data.amount, key);
            }
            if (data.description && typeof data.description === 'string' && data.description.includes(':')) {
                description = await decryptText(data.description, key);
            }
            if (data.originalDescription && typeof data.originalDescription === 'string' && data.originalDescription.includes(':')) {
                originalDescription = await decryptText(data.originalDescription, key);
            }
        }

        return {
            id: d.id,
            ...data,
            amount,
            description,
            originalDescription,
            date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
            createdAt: data.createdAt?.toDate?.() || new Date(),
        } as DraftTransaction;
    });

    return Promise.all(txPromises);
}

export function subscribeToDraftTransactions(
    batchId: string,
    callback: (txs: DraftTransaction[]) => void
) {
    const q = query(collection(db, TXS_COL), where('importBatch', '==', batchId));
    return onSnapshot(q, async (snapshot) => {
        const key = getMemoryVaultKey();

        const txPromises = snapshot.docs.map(async (d) => {
            const data = d.data();
            let amount = data.amount;
            let description = data.description;
            let originalDescription = data.originalDescription;

            if (key) {
                if (typeof data.amount === 'string' && data.amount.includes(':')) {
                    amount = await decryptAmount(data.amount, key);
                }
                if (data.description && typeof data.description === 'string' && data.description.includes(':')) {
                    description = await decryptText(data.description, key);
                }
                if (data.originalDescription && typeof data.originalDescription === 'string' && data.originalDescription.includes(':')) {
                    originalDescription = await decryptText(data.originalDescription, key);
                }
            }

            return {
                id: d.id,
                ...data,
                amount,
                description,
                originalDescription,
                date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
                createdAt: data.createdAt?.toDate?.() || new Date(),
            } as DraftTransaction;
        });

        const txs = await Promise.all(txPromises);
        callback(txs);
    });
}

export async function saveDraftTransactions(
    batchId: string,
    transactions: Omit<DraftTransaction, 'id' | 'createdAt'>[]
) {
    const batch = writeBatch(db);
    const key = getMemoryVaultKey();

    // Process in chunks of 400 (Firestore limit is 500)
    for (const tx of transactions) {
        const ref = doc(collection(db, TXS_COL));

        let amount = tx.amount as any;
        let description = tx.description;
        let originalDescription = tx.originalDescription;

        if (key) {
            amount = await encryptAmount(tx.amount, key);
            description = await encryptText(tx.description, key);
            originalDescription = await encryptText(tx.originalDescription, key);
        }

        batch.set(ref, {
            ...tx,
            amount,
            description,
            originalDescription,
            importBatch: batchId,
            date: Timestamp.fromDate(tx.date instanceof Date ? tx.date : new Date(tx.date)),
            createdAt: serverTimestamp(),
        });
    }

    await batch.commit();
}

/**
 * Attempts to automatically categorize pending draft transactions based on the family's transaction history.
 */
export async function autoCategorizeDrafts(familyId: string, batchId: string): Promise<number> {
    const [draftTxs, historyTxs] = await Promise.all([
        getDraftTransactions(batchId),
        getTransactionsByFamily(familyId, 1000) // Look at the last 1000 txs for learning
    ]);

    const pendingDrafts = draftTxs.filter(tx => tx.status === 'pending');
    if (pendingDrafts.length === 0) return 0;

    // Create a learning map: normalized description -> categoryId
    // We count frequencies to pick the most common category for a description pattern
    const categoryFreqMap = new Map<string, Map<string, number>>();

    const normalize = (desc: string) => {
        return desc.toLowerCase()
            .replace(/[0-9]/g, '') // remove numbers
            .replace(/[^a-zñáéíóú\s]/g, ' ') // keep only letters
            .replace(/\s+/g, ' ')
            .trim();
    };

    historyTxs.forEach(tx => {
        if (!tx.categoryId || !tx.description) return;
        const normDesc = normalize(tx.description);
        if (!normDesc) return;

        if (!categoryFreqMap.has(normDesc)) {
            categoryFreqMap.set(normDesc, new Map<string, number>());
        }
        const freqMap = categoryFreqMap.get(normDesc)!;
        freqMap.set(tx.categoryId, (freqMap.get(tx.categoryId) || 0) + 1);
    });

    // Resolve the best category for each normalized description
    const bestCategoryMap = new Map<string, string>();
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
            bestCategoryMap.set(normDesc, bestCategory);
        }
    });

    let matchedCount = 0;
    const batch = writeBatch(db);
    // Write batch limit is 500, we assume pendingDrafts is usually < 400 for a single CSV
    // if larger, we'd need pagination here too.
    for (const draft of pendingDrafts) {
        const normDraftDesc = normalize(draft.originalDescription);
        const suggestedCategoryId = bestCategoryMap.get(normDraftDesc);

        if (suggestedCategoryId) {
            batch.update(doc(db, TXS_COL, draft.id), {
                status: 'categorized',
                categoryId: suggestedCategoryId,
                suggestedCategoryId,
                confidence: 'high'
            });
            matchedCount++;
        }
    }

    if (matchedCount > 0) {
        await batch.commit();
    }

    return matchedCount;
}

export async function updateDraftTransaction(
    id: string,
    updates: Partial<DraftTransaction>
) {
    const data: any = { ...updates };
    const key = getMemoryVaultKey();

    if (key) {
        if (data.amount !== undefined) data.amount = await encryptAmount(data.amount, key);
        if (data.description !== undefined) data.description = await encryptText(data.description, key);
        if (data.originalDescription !== undefined) data.originalDescription = await encryptText(data.originalDescription, key);
    }

    if (data.date) {
        data.date = Timestamp.fromDate(data.date instanceof Date ? data.date : new Date(data.date));
    }

    await updateDoc(doc(db, TXS_COL, id), data);
}

export async function deleteDraftBatch(batchId: string) {
    // 1. Delete all draft transactions for this batch
    const q = query(collection(db, TXS_COL), where('importBatch', '==', batchId));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    // Be careful with large batches, might need pagination but 500 is usually fine for manual CSVs
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    // 2. Delete the batch document
    batch.delete(doc(db, BATCHES_COL, batchId));

    await batch.commit();
}
