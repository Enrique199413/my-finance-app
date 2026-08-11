import { getTransactionsByDateRange } from './transactions.service';
import type { BankAccount, Category } from '../types';

export async function getCalculatedBalances(
    familyId: string,
    accounts: BankAccount[],
    categories: Category[],
    endDate?: Date
): Promise<Record<string, number>> {
    const balances: Record<string, number> = {};
    const cashFlowCategoryIds = new Set(categories.filter(c => c.isCashFlow !== false).map(c => c.id));

    if (accounts.length === 0) return balances;

    let earliestDate = new Date();
    for (const acc of accounts) {
        balances[acc.id] = acc.initialBalance ?? acc.balance ?? 0;
        const d = acc.balanceStartDate || acc.createdAt;
        if (d && d < earliestDate) {
            earliestDate = d;
        }
    }

    const txs = await getTransactionsByDateRange(familyId, earliestDate, endDate || new Date(8640000000000000));

    for (const tx of txs) {
        // If not a cash flow category, ignore (unless uncategorized? the user said edit them. We treat them as affecting balance or not?)
        // Wait, earlier I said "Dado que los movimientos sin categoría NO afectarán el balance..."
        if (!tx.categoryId) continue; 
        if (!cashFlowCategoryIds.has(tx.categoryId)) continue;
        
        const acc = accounts.find(a => a.id === tx.accountId);
        if (!acc) continue;

        const startDate = acc.balanceStartDate || acc.createdAt;
        // tx.date is a Date object, startDate is a Date object.
        if (tx.date < startDate) continue;

        if (tx.type === 'income') {
            balances[tx.accountId] += tx.amount;
        } else {
            balances[tx.accountId] -= tx.amount;
        }
    }

    return balances;
}
