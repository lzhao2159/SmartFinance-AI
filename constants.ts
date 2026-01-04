
import { Category, BankAccount, Transaction } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: '飲食', icon: 'Utensils', color: '#EF4444' },
  { id: 'cat-2', name: '交通', icon: 'Car', color: '#3B82F6' },
  { id: 'cat-3', name: '薪資', icon: 'Banknote', color: '#10B981' },
  { id: 'cat-4', name: '購物', icon: 'ShoppingBag', color: '#F59E0B' },
  { id: 'cat-5', name: '娛樂', icon: 'Gamepad2', color: '#8B5CF6' },
  { id: 'cat-6', name: '房租', icon: 'Home', color: '#6B7280' },
  { id: 'cat-7', name: '投資', icon: 'TrendingUp', color: '#EC4899' },
];

export const MOCK_ACCOUNTS: BankAccount[] = [
  { id: 'acc-1', name: '主要帳戶', bankName: '國泰世華', balance: 50000, type: 'checking' },
  { id: 'acc-2', name: '儲蓄基金', bankName: '玉山銀行', balance: 120000, type: 'savings' },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 't-1', accountId: 'acc-1', categoryId: 'cat-3', amount: 45000, type: 'income', date: '2024-03-01', note: '3月薪資' },
  { id: 't-2', accountId: 'acc-1', categoryId: 'cat-1', amount: 150, type: 'expense', date: '2024-03-02', note: '午餐' },
  { id: 't-3', accountId: 'acc-1', categoryId: 'cat-2', amount: 1200, type: 'expense', date: '2024-03-05', note: '悠遊卡儲值' },
  { id: 't-4', accountId: 'acc-2', categoryId: 'cat-7', amount: 5000, type: 'income', date: '2024-03-10', note: '股息收入' },
];
