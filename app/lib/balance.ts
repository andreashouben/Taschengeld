import type { Child, Transaction } from "~/db/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculateBalance(child: Child, transactions: Transaction[]): number {
  const now = new Date();
  const start = new Date(child.startDate);
  const daysDiff = Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY);

  // Tage bis zum ersten Auftreten des Auszahlungstags nach dem Startdatum
  let daysToFirst = (child.payoutDay - start.getDay() + 7) % 7;
  if (daysToFirst === 0) daysToFirst = 7; // Startdatum = Auszahlungstag → erste Zahlung in 7 Tagen

  const weeksElapsed = daysDiff >= daysToFirst
    ? 1 + Math.floor((daysDiff - daysToFirst) / 7)
    : 0;

  const earned = child.startBalance + weeksElapsed * child.weeklyRate;
  const transactionSum = transactions.reduce((sum, t) => sum + t.amount, 0);
  return earned + transactionSum;
}
