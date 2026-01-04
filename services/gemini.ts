
import { GoogleGenAI } from "@google/genai";
import { Transaction, BankAccount, Category } from "../types";

export async function getFinancialAdvice(
  transactions: Transaction[],
  accounts: BankAccount[],
  categories: Category[]
): Promise<string> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return "AI 建議目前不可用（缺少 API Key）。請確認環境變數已正確設定。";
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Prepare a summary for AI
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const currentBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  
  const categorySummary = categories.map(cat => {
    const amount = transactions
      .filter(t => t.categoryId === cat.id && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return amount > 0 ? `${cat.name}: ${amount}元` : null;
  }).filter(Boolean).join(', ');

  const prompt = `
    你是一位專業的個人財務顧問。請根據以下財務數據提供具體的分析與建議。
    當前總資產：${currentBalance}元
    本期總收入：${totalIncome}元
    本期總支出：${totalExpense}元
    支出分類統計：${categorySummary}
    
    請提供：
    1. 支出結構的評價（是否過高，哪些部分可以節省）。
    2. 給予 3 個具體的理財行動建議。
    3. 基於收支平衡狀況的財務健康評分（0-100）。
    
    請用親切且專業的繁體中文回答。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text || "無法生成建議，請稍後再試。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 分析過程中發生錯誤。";
  }
}
