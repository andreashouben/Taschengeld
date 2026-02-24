import type { Child, Transaction } from "~/db/schema";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function calculateBalance(child: Child, transactions: Transaction[]): number {
  const now = new Date();
  const start = new Date(child.startDate);
  const weeksElapsed = Math.floor((now.getTime() - start.getTime()) / MS_PER_WEEK);
  const earned = child.startBalance + weeksElapsed * child.weeklyRate;
  const transactionSum = transactions.reduce((sum, t) => sum + t.amount, 0);
  return earned + transactionSum;
}
