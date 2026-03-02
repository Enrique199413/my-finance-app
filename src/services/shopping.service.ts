import {
    collection,
    doc,
    setDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    deleteDoc,
    updateDoc,
    getDocs,
    where,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import type { ShoppingList, ShoppingListItem } from '../types';

export function subscribeToShoppingLists(familyId: string, callback: (lists: ShoppingList[]) => void) {
    const listsRef = collection(db, 'families', familyId, 'shoppingLists');
    const q = query(listsRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const lists = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            completedAt: doc.data().completedAt?.toDate(),
        })) as ShoppingList[];
        callback(lists);
    });
}

export function subscribeToShoppingListItems(familyId: string, listId: string, callback: (items: ShoppingListItem[]) => void) {
    const itemsRef = collection(db, 'families', familyId, 'shoppingLists', listId, 'items');
    const q = query(itemsRef, orderBy('createdAt', 'asc'));

    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            listId
        })) as ShoppingListItem[];
        callback(items);
    });
}

export async function createShoppingList(familyId: string, name: string): Promise<string> {
    const listRef = doc(collection(db, 'families', familyId, 'shoppingLists'));
    await setDoc(listRef, {
        familyId,
        name,
        status: 'pending',
        createdAt: serverTimestamp(),
    });
    return listRef.id;
}

export async function addShoppingListItem(familyId: string, listId: string, name: string, amount: number): Promise<string> {
    const itemRef = doc(collection(db, 'families', familyId, 'shoppingLists', listId, 'items'));
    await setDoc(itemRef, {
        name,
        amount,
        isChecked: false,
        createdAt: serverTimestamp(),
    });
    return itemRef.id;
}

export async function updateShoppingListItem(familyId: string, listId: string, itemId: string, data: Partial<ShoppingListItem>) {
    const itemRef = doc(db, 'families', familyId, 'shoppingLists', listId, 'items', itemId);
    const updateData = { ...data };
    delete updateData.id;
    delete updateData.listId;
    delete updateData.createdAt;

    await updateDoc(itemRef, updateData);
}

export async function deleteShoppingListItem(familyId: string, listId: string, itemId: string) {
    const itemRef = doc(db, 'families', familyId, 'shoppingLists', listId, 'items', itemId);
    await deleteDoc(itemRef);
}

export async function deleteShoppingList(familyId: string, listId: string) {
    // Note: Due to Firestore shallow deletes, we should batch delete items as well in a real prod app.
    // Setting up a batch here to cleanly delete items first.
    const batch = writeBatch(db);

    const itemsRef = collection(db, 'families', familyId, 'shoppingLists', listId, 'items');
    const itemsSnap = await getDocs(itemsRef);
    itemsSnap.docs.forEach(d => {
        batch.delete(d.ref);
    });

    const listRef = doc(db, 'families', familyId, 'shoppingLists', listId);
    batch.delete(listRef);

    await batch.commit();
}

/**
 * Completes a shopping list.
 * If there are unchecked items, it moves them a newly created sequential list.
 */
export async function completeShoppingList(familyId: string, listId: string, currentListName: string) {
    const itemsRef = collection(db, 'families', familyId, 'shoppingLists', listId, 'items');
    const itemsSnap = await getDocs(itemsRef);
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const uncheckedItems = items.filter(item => !item.isChecked);

    const batch = writeBatch(db);

    // If there are unchecked items, we create a new list and move them
    if (uncheckedItems.length > 0) {
        const newListRef = doc(collection(db, 'families', familyId, 'shoppingLists'));
        batch.set(newListRef, {
            familyId,
            name: `${currentListName} (Pendientes)`,
            status: 'pending',
            createdAt: serverTimestamp(),
        });

        uncheckedItems.forEach(item => {
            const newItemRef = doc(collection(db, 'families', familyId, 'shoppingLists', newListRef.id, 'items'));
            batch.set(newItemRef, {
                name: item.name,
                amount: item.amount,
                isChecked: false,
                createdAt: serverTimestamp(),
            });

            // Delete the old item from the completed list so it literally moves
            const oldItemRef = doc(db, 'families', familyId, 'shoppingLists', listId, 'items', item.id);
            batch.delete(oldItemRef);
        });
    }

    // Mark current list as completed
    const listRef = doc(db, 'families', familyId, 'shoppingLists', listId);
    batch.update(listRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
    });

    await batch.commit();
}

/**
 * Links a shopping list to a transaction or unlinks it if transactionId is null.
 */
export async function linkListToTransaction(familyId: string, listId: string, transactionId: string | null) {
    const listRef = doc(db, 'families', familyId, 'shoppingLists', listId);
    await updateDoc(listRef, {
        transactionId
    });
}
