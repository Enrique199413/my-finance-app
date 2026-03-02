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
    onSnapshot,
    orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Category } from '../types';

const COLLECTION = 'categories';

// Default categories to seed when a family is created
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'familyId'>[] = [
    // Expenses
    { name: 'Supermercado', icon: '🛒', color: '#10b981', type: 'expense' },
    { name: 'Restaurantes', icon: '🍽️', color: '#f59e0b', type: 'expense' },
    { name: 'Transporte', icon: '🚗', color: '#6366f1', type: 'expense' },
    { name: 'Hogar', icon: '🏠', color: '#8b5cf6', type: 'expense' },
    { name: 'Salud', icon: '🏥', color: '#ef4444', type: 'expense' },
    { name: 'Ocio', icon: '🎬', color: '#ec4899', type: 'expense' },
    { name: 'Ropa', icon: '👕', color: '#14b8a6', type: 'expense' },
    { name: 'Suscripciones', icon: '📱', color: '#f97316', type: 'expense' },
    { name: 'Educación', icon: '📚', color: '#3b82f6', type: 'expense' },
    { name: 'Mascotas', icon: '🐾', color: '#a855f7', type: 'expense' },
    { name: 'Otros', icon: '📦', color: '#64748b', type: 'expense' },
    // Income
    { name: 'Nómina', icon: '💰', color: '#10b981', type: 'income' },
    { name: 'Freelance', icon: '💻', color: '#6366f1', type: 'income' },
    { name: 'Inversiones', icon: '📈', color: '#f59e0b', type: 'income' },
    { name: 'Otros Ingresos', icon: '💵', color: '#64748b', type: 'income' },
];

export function subscribeToCategories(
    familyId: string,
    callback: (categories: Category[]) => void
) {
    const q = query(
        collection(db, COLLECTION),
        where('familyId', '==', familyId),
        orderBy('type'),
        orderBy('name')
    );

    return onSnapshot(q, (snapshot) => {
        const categories = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        })) as Category[];
        callback(categories);
    });
}

export async function createCategory(
    data: Omit<Category, 'id'>
): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION), data);
    return docRef.id;
}

export async function updateCategory(
    id: string,
    data: Partial<Omit<Category, 'id'>>
): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), data);
}

export async function deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
}

export async function seedDefaultCategories(familyId: string): Promise<void> {
    // Check if categories already exist
    const q = query(
        collection(db, COLLECTION),
        where('familyId', '==', familyId)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return; // Already seeded

    const batch = DEFAULT_CATEGORIES.map((cat) =>
        addDoc(collection(db, COLLECTION), { ...cat, familyId })
    );
    await Promise.all(batch);
}

export async function getCategoriesByFamily(familyId: string): Promise<Category[]> {
    const q = query(
        collection(db, COLLECTION),
        where('familyId', '==', familyId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as Category[];
}
