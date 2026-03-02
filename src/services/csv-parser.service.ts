import Papa from 'papaparse';
import type { Transaction, DraftTransaction, TransactionType, CSVColumnMapping } from '../types';

// ===== BANK PRESETS =====
export interface BankPreset {
    name: string;
    delimiter?: string;
    mapping: CSVColumnMapping;
    dateFormat: string; // 'DD/MM/YYYY', 'YYYY-MM-DD', etc.
    amountParser?: (value: string) => { amount: number; type: TransactionType };
    skipRows?: number;
}

export const BANK_PRESETS: Record<string, BankPreset> = {
    revolut: {
        name: 'Revolut',
        mapping: {
            date: 'Started Date',
            amount: 'Amount',
            description: 'Description',
            type: 'Type',
        },
        dateFormat: 'YYYY-MM-DD',
        amountParser: (value: string) => {
            const num = parseFloat(value.replace(',', '.'));
            return {
                amount: Math.abs(num),
                type: num >= 0 ? 'income' : 'expense',
            };
        },
    },
    bbva: {
        name: 'BBVA España',
        delimiter: ';',
        mapping: {
            date: 'Fecha',
            amount: 'Importe',
            description: 'Concepto',
        },
        dateFormat: 'DD/MM/YYYY',
        amountParser: (value: string) => {
            const num = parseFloat(value.replace('.', '').replace(',', '.'));
            return {
                amount: Math.abs(num),
                type: num >= 0 ? 'income' : 'expense',
            };
        },
    },
    bbva_mexico: {
        name: 'BBVA México',
        mapping: {
            date: 'Fecha',
            amount: 'Cargo/Abono',
            description: 'Descripción',
        },
        dateFormat: 'DD/MM/YYYY',
        amountParser: (value: string) => {
            const num = parseFloat(value.replace(',', ''));
            return {
                amount: Math.abs(num),
                type: num >= 0 ? 'income' : 'expense',
            };
        },
    },
    banamex: {
        name: 'Banamex / Citibanamex',
        mapping: {
            date: 'Fecha',
            amount: 'Importe',
            description: 'Descripcion',
        },
        dateFormat: 'DD/MM/YYYY',
        amountParser: (value: string) => {
            const num = parseFloat(value.replace(',', ''));
            return {
                amount: Math.abs(num),
                type: num >= 0 ? 'income' : 'expense',
            };
        },
    },
    custom: {
        name: 'Manual',
        mapping: {
            date: '',
            amount: '',
            description: '',
        },
        dateFormat: 'YYYY-MM-DD',
    },
};

// ===== PARSING =====

function parseDate(value: string, fmt: string): Date {
    const cleaned = value.trim();

    if (fmt === 'DD/MM/YYYY') {
        const [d, m, y] = cleaned.split('/');
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }

    if (fmt === 'MM/DD/YYYY') {
        const [m, d, y] = cleaned.split('/');
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }

    // Default: ISO / YYYY-MM-DD or any parsable format
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) {
        // Try removing time part if present (Revolut: "2024-01-15 10:30:00")
        return new Date(cleaned.split(' ')[0]);
    }
    return date;
}

export function parseCSV(
    file: File,
    preset: BankPreset
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            delimiter: preset.delimiter || ',',
            skipEmptyLines: true,
            encoding: 'UTF-8',
            complete: (result) => {
                const headers = result.meta.fields || [];
                resolve({
                    headers,
                    rows: result.data as Record<string, string>[],
                });
            },
            error: (err) => reject(err),
        });
    });
}

export function mapRowsToTransactions(
    rows: Record<string, string>[],
    preset: BankPreset,
    customMapping: CSVColumnMapping | undefined,
    familyId: string,
    accountId: string
): Omit<Transaction, 'id' | 'createdAt'>[] {
    const mapping = customMapping || preset.mapping;
    const batchId = Date.now().toString(36);

    return rows
        .map((row) => {
            const dateStr = row[mapping.date];
            const amountStr = row[mapping.amount];
            const desc = row[mapping.description];

            if (!dateStr || !amountStr || !desc) return null;

            const date = parseDate(dateStr, preset.dateFormat);
            if (isNaN(date.getTime())) return null;

            let amount: number;
            let type: TransactionType;

            if (preset.amountParser) {
                const parsed = preset.amountParser(amountStr);
                amount = parsed.amount;
                type = parsed.type;
            } else {
                const num = parseFloat(amountStr.replace(',', '.'));
                amount = Math.abs(num);
                type = num >= 0 ? 'income' : 'expense';
            }

            if (amount === 0) return null;

            return {
                familyId,
                accountId,
                amount,
                type,
                description: desc.trim(),
                date,
                importBatch: batchId,
            } as Omit<Transaction, 'id' | 'createdAt'>;
        })
        .filter(Boolean) as Omit<Transaction, 'id' | 'createdAt'>[];
}

export function mapRowsToDraftTransactions(
    rows: Record<string, string>[],
    preset: BankPreset,
    customMapping: CSVColumnMapping | undefined,
    familyId: string,
    accountId: string
): Omit<DraftTransaction, 'id' | 'createdAt'>[] {
    const transactions = mapRowsToTransactions(rows, preset, customMapping, familyId, accountId);

    return transactions.map(tx => ({
        ...tx,
        status: 'pending',
        originalDescription: tx.description,
        confidence: 'low',
    } as Omit<DraftTransaction, 'id' | 'createdAt'>));
}
