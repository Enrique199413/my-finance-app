import type { Category } from '../types';

export const sortCategoriesHierarchically = (categories: Category[]): Category[] => {
    const sorted: Category[] = [];
    const parents = categories.filter(c => !c.parentId);
    parents.forEach(p => {
        sorted.push(p);
        sorted.push(...categories.filter(c => c.parentId === p.id));
    });
    return sorted;
};
