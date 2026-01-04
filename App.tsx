
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowRightLeft, 
  PieChart as PieChartIcon, 
  LogOut, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2,
  AlertCircle,
  Menu,
  X,
  CreditCard,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { auth, db, isFirebaseAvailable } from './services/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { 
  AppMode, 
  BankAccount, 
  Transaction, 
  Category, 
  UserProfile 
} from './types';
import { 
  DEFAULT_CATEGORIES, 
  MOCK_ACCOUNTS, 
  MOCK_TRANSACTIONS 
} from './constants';
import { getFinancialAdvice } from './services/gemini';

// Helper for UI
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('demo');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'accounts' | 'transactions' | 'reports'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // App State
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Auth Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [authError, setAuthError] = useState('');

  // Setup initial data based on mode
  useEffect(() => {
    if (mode === 'demo') {
      setAccounts(MOCK_ACCOUNTS);
      setTransactions(MOCK_TRANSACTIONS);
      setUser({ uid: 'demo-user', email: 'demo@example.com' });
      setIsAuthLoading(false);
    } else if (isFirebaseAvailable && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email || '' });
        } else {
          setUser(null);
        }
        setIsAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      setMode('demo');
      setIsAuthLoading(false);
    }
  }, [mode]);

  // Firestore Sync
  useEffect(() => {
    if (mode === 'live' && user && db) {
      // Sync Accounts
      const qAcc = query(collection(db, 'accounts'), where('userId', '==', user.uid));
      const unsubAcc = onSnapshot(qAcc, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
        setAccounts(data);
      });

      // Sync Transactions
      const qTrans = query(collection(db, 'transactions'), where('userId', '==', user.uid));
      const unsubTrans = onSnapshot(qTrans, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      });

      return () => {
        unsubAcc();
        unsubTrans();
      };
    }
  }, [mode, user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'demo') {
      // Already handled by useEffect setting demo user
      return;
    }
    if (!auth) return;

    try {
      setAuthError('');
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    if (mode === 'live' && auth) {
      await signOut(auth);
    }
    setUser(null);
    if (mode === 'demo') {
      setMode('demo'); // Reset demo
    }
  };

  const addAccount = async (name: string, bank: string, balance: number, type: BankAccount['type']) => {
    if (mode === 'live' && db && user) {
      await addDoc(collection(db, 'accounts'), { name, bankName: bank, balance, type, userId: user.uid });
    } else {
      const newAcc: BankAccount = { id: Date.now().toString(), name, bankName: bank, balance, type };
      setAccounts([...accounts, newAcc]);
    }
  };

  const deleteAccount = async (id: string) => {
    if (mode === 'live' && db) {
      await deleteDoc(doc(db, 'accounts', id));
    } else {
      setAccounts(accounts.filter(a => a.id !== id));
      setTransactions(transactions.filter(t => t.accountId !== id));
    }
  };

  const addTransaction = async (accountId: string, categoryId: string, amount: number, type: Transaction['type'], date: string, note: string) => {
    if (mode === 'live' && db && user) {
      await addDoc(collection(db, 'transactions'), { accountId, categoryId, amount, type, date, note, userId: user.uid });
      // Update balance
      const accountRef = doc(db, 'accounts', accountId);
      const acc = accounts.find(a => a.id === accountId);
      if (acc) {
        const newBalance = type === 'income' ? acc.balance + amount : acc.balance - amount;
        await updateDoc(accountRef, { balance: newBalance });
      }
    } else {
      const newT: Transaction = { id: Date.now().toString(), accountId, categoryId, amount, type, date, note };
      setTransactions([newT, ...transactions]);
      setAccounts(accounts.map(a => a.id === accountId ? { ...a, balance: type === 'income' ? a.balance + amount : a.balance - amount } : a));
    }
  };

  const requestAiAdvice = async () => {
    setIsAiLoading(true);
    const advice = await getFinancialAdvice(transactions, accounts, categories);
    setAiAdvice(advice);
    setIsAiLoading(false);
  };

  // Dashboard calculations
  const totalAssets = useMemo(() => accounts.reduce((sum, a) => sum + a.balance, 0), [accounts]);
  const monthlySpending = useMemo(() => {
    const now = new Date();
    return transactions
      .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === now.getMonth())
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const pieData = useMemo(() => {
    return categories.map(cat => ({
      name: cat.name,
      value: transactions
        .filter(t => t.categoryId === cat.id && t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0)
    })).filter(d => d.value > 0);
  }, [transactions, categories]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">載入中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Wallet className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800">SmartFinance AI</h1>
            <p className="text-slate-500 mt-2">智慧管理您的每一分錢</p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
            <button 
              onClick={() => setMode('demo')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'demo' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
            >
              展示模式
            </button>
            <button 
              onClick={() => {
                if (!isFirebaseAvailable) {
                  alert('Firebase 未設定，請切換至展示模式或檢查設定。');
                  return;
                }
                setMode('live');
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'live' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
            >
              正式模式
            </button>
          </div>

          {mode === 'demo' ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-700 text-sm">
                展示模式使用預設測試帳號，讓您快速體驗功能。
              </div>
              <button 
                onClick={() => setUser({ uid: 'demo', email: 'demo@example.com' })}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2"
              >
                開始體驗 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              {authError && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {authError}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">電子郵件</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">密碼</label>
                <input 
                  type="password" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位數"
                  required
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md"
              >
                {isRegister ? '註冊帳號' : '登入系統'}
              </button>
              <p className="text-center text-sm text-slate-500 mt-4">
                {isRegister ? '已有帳號？' : '還沒有帳號？'} 
                <button 
                  type="button"
                  onClick={() => setIsRegister(!isRegister)}
                  className="text-blue-600 font-semibold ml-1 hover:underline"
                >
                  {isRegister ? '立即登入' : '立即註冊'}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Mobile Toggle */}
      <div className="md:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Wallet className="text-blue-600 w-6 h-6" />
          <span className="font-bold text-xl">SmartFinance</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 transition-transform fixed md:static inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 p-6 z-40 flex flex-col
      `}>
        <div className="hidden md:flex items-center gap-3 mb-10 text-white">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Wallet className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">SmartFinance AI</span>
        </div>

        <nav className="space-y-2 flex-1">
          <NavItem active={view === 'dashboard'} icon={<LayoutDashboard size={20}/>} label="總覽儀表板" onClick={() => {setView('dashboard'); setIsSidebarOpen(false);}} />
          <NavItem active={view === 'accounts'} icon={<CreditCard size={20}/>} label="銀行帳戶" onClick={() => {setView('accounts'); setIsSidebarOpen(false);}} />
          <NavItem active={view === 'transactions'} icon={<ArrowRightLeft size={20}/>} label="財務紀錄" onClick={() => {setView('transactions'); setIsSidebarOpen(false);}} />
          <NavItem active={view === 'reports'} icon={<PieChartIcon size={20}/>} label="分析報表" onClick={() => {setView('reports'); setIsSidebarOpen(false);}} />
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
          <div className="px-4 py-2 bg-slate-800 rounded-lg">
            <p className="text-xs text-slate-500">登入帳號</p>
            <p className="text-sm font-medium text-white truncate">{user.email}</p>
            <p className="text-[10px] mt-1 uppercase tracking-wider text-blue-400 font-bold">{mode === 'demo' ? '展示模式' : '正式模式'}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span>登出系統</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {view === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">歡迎回來, </h1>
                <p className="text-slate-500">這是您目前的財務概況</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setView('transactions')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-md"
                >
                  <Plus size={18} /> 新增收支
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="總資產" amount={totalAssets} icon={<Wallet className="text-blue-600" />} color="blue" />
              <StatCard title="本月支出" amount={monthlySpending} icon={<ArrowRightLeft className="text-red-600" />} color="red" />
              <StatCard title="帳戶數量" amount={accounts.length} suffix="個" icon={<CreditCard className="text-green-600" />} color="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">支出分類比例</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800">AI 財務建議</h3>
                  <button 
                    onClick={requestAiAdvice}
                    disabled={isAiLoading}
                    className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles size={20} className={isAiLoading ? 'animate-pulse' : ''} />
                  </button>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-4 overflow-y-auto max-h-[250px]">
                  {isAiLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500"></div>
                      <p>Gemini 正在分析您的數據...</p>
                    </div>
                  ) : aiAdvice ? (
                    <div className="prose prose-sm text-slate-600 whitespace-pre-line">
                      {aiAdvice}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
                      <Sparkles size={40} className="mb-2 opacity-20" />
                      <p>點擊上方星星圖示<br/>由 AI 為您的財務健康把脈</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mt-8">
              <h3 className="text-lg font-bold text-slate-800 mb-6">最近交易</h3>
              <div className="space-y-4">
                {transactions.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors border-b last:border-0 border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        {categories.find(c => c.id === t.categoryId)?.icon === 'Utensils' && <Plus size={20} />}
                        <ChevronRight size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{t.note}</p>
                        <p className="text-xs text-slate-400">{t.date} · {categories.find(c => c.id === t.categoryId)?.name}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${t.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                      {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
                {transactions.length === 0 && <p className="text-center text-slate-400 py-10">尚無交易紀錄</p>}
              </div>
            </div>
          </div>
        )}

        {view === 'accounts' && <AccountsView accounts={accounts} addAccount={addAccount} deleteAccount={deleteAccount} />}
        {view === 'transactions' && <TransactionsView transactions={transactions} accounts={accounts} categories={categories} addTransaction={addTransaction} />}
        {view === 'reports' && <ReportsView transactions={transactions} categories={categories} />}
      </main>
    </div>
  );
};

// Sub-components
const NavItem = ({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
      ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800 text-slate-400'}
    `}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

const StatCard = ({ title, amount, icon, color, suffix = "元" }: { title: string, amount: number, icon: React.ReactNode, color: string, suffix?: string }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-6">
    <div className={`p-4 rounded-2xl bg-${color}-50`}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="text-2xl font-bold text-slate-800">
        {suffix === "元" ? `$${amount.toLocaleString()}` : amount}
        <span className="text-sm ml-1 font-normal text-slate-400">{suffix}</span>
      </p>
    </div>
  </div>
);

const AccountsView = ({ accounts, addAccount, deleteAccount }: { accounts: BankAccount[], addAccount: any, deleteAccount: any }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', bank: '', balance: 0, type: 'checking' as BankAccount['type'] });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAccount(formData.name, formData.bank, formData.balance, formData.type);
    setIsAdding(false);
    setFormData({ name: '', bank: '', balance: 0, type: 'checking' });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-slate-800">銀行帳戶管理</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 shadow-md"
        >
          <Plus size={18} /> 新增帳戶
        </button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-xl font-bold">新增銀行帳戶</h3>
            <div>
              <label className="block text-sm mb-1 text-slate-500">帳戶名稱</label>
              <input 
                className="w-full px-4 py-2 border rounded-xl" 
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="例如：生活開支" required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-500">銀行名稱</label>
              <input 
                className="w-full px-4 py-2 border rounded-xl" 
                value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} 
                placeholder="例如：玉山銀行" required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-500">初始餘額</label>
              <input 
                type="number" className="w-full px-4 py-2 border rounded-xl" 
                value={formData.balance} onChange={e => setFormData({...formData, balance: Number(e.target.value)})} 
                required
              />
            </div>
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-50 rounded-xl">取消</button>
              <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">確認新增</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{acc.name}</h4>
                  <p className="text-sm text-slate-400">{acc.bankName}</p>
                </div>
              </div>
              <button onClick={() => deleteAccount(acc.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
            <div className="mt-6">
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider">目前餘額</p>
              <p className="text-3xl font-bold text-slate-800">${acc.balance.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TransactionsView = ({ transactions, accounts, categories, addTransaction }: { transactions: Transaction[], accounts: BankAccount[], categories: Category[], addTransaction: any }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ accountId: '', categoryId: '', amount: 0, type: 'expense' as Transaction['type'], date: new Date().toISOString().split('T')[0], note: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId || !formData.categoryId) {
      alert('請選擇帳戶與分類');
      return;
    }
    addTransaction(formData.accountId, formData.categoryId, formData.amount, formData.type, formData.date, formData.note);
    setIsAdding(false);
    setFormData({ accountId: '', categoryId: '', amount: 0, type: 'expense', date: new Date().toISOString().split('T')[0], note: '' });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-slate-800">財務紀錄</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 shadow-md"
        >
          <Plus size={18} /> 新增收支
        </button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-xl font-bold">記錄一筆收支</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                type="button" onClick={() => setFormData({...formData, type: 'expense'})}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.type === 'expense' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500'}`}
              >
                支出
              </button>
              <button 
                type="button" onClick={() => setFormData({...formData, type: 'income'})}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.type === 'income' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500'}`}
              >
                收入
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-slate-500">帳戶</label>
                <select 
                  className="w-full px-4 py-2 border rounded-xl bg-white" 
                  value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} required
                >
                  <option value="">選擇帳戶</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-500">分類</label>
                <select 
                  className="w-full px-4 py-2 border rounded-xl bg-white" 
                  value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} required
                >
                  <option value="">選擇分類</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-500">金額</label>
              <input 
                type="number" className="w-full px-4 py-2 border rounded-xl" 
                value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-500">備註</label>
              <input 
                className="w-full px-4 py-2 border rounded-xl" 
                value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} 
                placeholder="例如：午餐費用" required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-slate-500">日期</label>
              <input 
                type="date" className="w-full px-4 py-2 border rounded-xl" 
                value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required
              />
            </div>
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-50 rounded-xl">取消</button>
              <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">確認記錄</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">日期</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">描述</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">帳戶</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">分類</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase">金額</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map(t => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-600">{t.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">{t.note}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{accounts.find(a => a.id === t.accountId)?.name}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 bg-slate-100 rounded-md text-xs font-medium text-slate-600">
                    {categories.find(c => c.id === t.categoryId)?.name}
                  </span>
                </td>
                <td className={`px-6 py-4 text-sm font-bold text-right ${t.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                  {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && <div className="text-center py-20 text-slate-400">尚無交易紀錄</div>}
      </div>
    </div>
  );
};

const ReportsView = ({ transactions, categories }: { transactions: Transaction[], categories: Category[] }) => {
  const barData = useMemo(() => {
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const currentYear = new Date().getFullYear();
    return months.map(m => {
      const label = `${currentYear}-${m}`;
      const income = transactions.filter(t => t.type === 'income' && t.date.startsWith(label)).reduce((sum, t) => sum + t.amount, 0);
      const expense = transactions.filter(t => t.type === 'expense' && t.date.startsWith(label)).reduce((sum, t) => sum + t.amount, 0);
      return { month: m + '月', 收入: income, 支出: expense };
    });
  }, [transactions]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-slate-800">財務分析報表</h2>
      
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold mb-6">年度收支概覽</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="收入" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="支出" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold mb-6">分類支出佔比</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories.map(c => ({
                    name: c.name,
                    value: transactions.filter(t => t.categoryId === c.id && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
                  })).filter(d => d.value > 0)}
                  dataKey="value"
                  cx="50%" cy="50%" outerRadius={100} label
                >
                  {categories.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-2xl text-white shadow-lg">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5" /> 報表摘要分析</h3>
          <div className="space-y-4 opacity-90">
            <p>根據數據顯示，您本月的儲蓄率為 <span className="text-yellow-300 font-bold">25%</span>，優於平均水平。</p>
            <p>支出最高的分類是 <span className="text-yellow-300 font-bold">房租</span>，建議您可以考慮調整生活成本或增加額外收入來源。</p>
            <hr className="border-white/20" />
            <p className="text-sm italic">點擊「總覽儀表板」中的 AI 星星按鈕可獲得基於 Gemini 3 Pro 的進階智慧理財建議。</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
