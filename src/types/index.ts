// ===== USER =====
export interface AppUser {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    createdAt: Date;
}

// ===== FAMILY =====
export interface Family {
    id: string;
    name: string;
    ownerId: string;
    inviteCode: string;
    currency: string;
    isVaultEnabled?: boolean; // Indicates if E2EE has been turned on for this family
    createdAt: Date;
}

export interface FamilyEscrow {
    familyId: string;
    userId: string;
    salt: string;
    encryptedKey: string;
    updatedAt: Date;
}

export interface FamilyMember {
    id: string;
    familyId: string;
    userId: string;
    displayName: string;
    photoURL?: string;
    role: 'owner' | 'member';
    joinedAt: Date;
}

// ===== ACCOUNTS =====
export type AccountType = 'checking' | 'savings' | 'credit' | 'cash';

export interface BankAccount {
    id: string;
    familyId: string;
    name: string;
    bank: string;
    type: AccountType;
    currency: string;
    ownerId: string;
    balance: number;
    createdAt: Date;
}

// ===== TRANSACTIONS =====
export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
    id: string;
    accountId: string;
    familyId: string;
    amount: number;
    type: TransactionType;
    description: string;
    categoryId?: string;
    date: Date;
    importBatch?: string;
    createdAt: Date;
}

export interface DraftTransaction extends Transaction {
    status: 'pending' | 'categorized' | 'ignored';
    originalDescription: string;
    suggestedCategoryId?: string;
    confidence?: 'high' | 'medium' | 'low';
}

// ===== CATEGORIES =====
export interface Category {
    id: string;
    familyId: string;
    name: string;
    icon: string;
    color: string;
    type: 'income' | 'expense';
}

// ===== DEBTS =====
export interface Debt {
    id: string;
    familyId: string;
    name: string;
    totalAmount: number;
    paidAmount: number;
    interestRate: number;
    minimumPayment: number;
    dueDate?: Date | null;
    paymentType: 'manual' | 'auto';
    autoPaymentDay?: number;
    autoPaymentAccountId?: string;
    currency: string;
    ownerId: string;
    createdAt: Date;
}

// ===== CSV IMPORT =====
export interface CSVColumnMapping {
    date: string;
    amount: string;
    description: string;
    type?: string;
    category?: string;
}

export interface ImportBatch {
    id: string;
    familyId: string;
    accountId: string;
    fileName: string;
    rowCount: number;
    importedAt: Date;
    importedBy: string;
}
export interface DraftBatch {
    id: string;
    familyId: string;
    accountId: string;
    fileName: string;
    status: 'uploading' | 'categorizing' | 'reviewing' | 'completed';
    totalRows: number;
    processedRows: number;
    createdAt: Date;
    updatedAt: Date;
}

// ===== SHOPPING LISTS =====
export interface ShoppingList {
    id: string;
    familyId: string;
    name: string;
    status: 'pending' | 'completed';
    budget?: number;
    storeName?: string;
    transactionId?: string;
    createdAt: Date;
    completedAt?: Date;
}

export interface ShoppingListItem {
    id: string;
    listId: string;
    name: string;
    amount: number;
    isChecked: boolean;
    createdAt: Date;
}
