
export type TransactionType = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface BankAccount {
  id: string;
  name: string;
  balance: number;
  bankName: string;
  type: 'checking' | 'savings' | 'credit';
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  date: string;
  note: string;
}

export interface UserProfile {
  uid: string;
  email: string;
}

export type AppMode = 'demo' | 'live';
