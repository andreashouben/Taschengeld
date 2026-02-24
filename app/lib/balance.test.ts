import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { calculateBalance } from "./balance";
import type { Child, Transaction } from "~/db/schema";

// Hilfsfunktion: Datum n Tage in der Vergangenheit als ISO-String
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function makeChild(overrides: Partial<Child> = {}): Child {
  return {
    id: 1,
    name: "Testekind",
    weeklyRate: 10,
    startDate: daysAgo(0),
    startBalance: 0,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    childId: 1,
    amount: -5,
    note: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("calculateBalance()", () => {
  it("gibt start_balance zurück wenn start_date heute ist (0 Wochen)", () => {
    const child = makeChild({ startBalance: 20, startDate: daysAgo(0) });
    expect(calculateBalance(child, [])).toBe(20);
  });

  it("addiert noch keine Wochenrate vor Ablauf einer vollen Woche", () => {
    const child = makeChild({ startBalance: 0, weeklyRate: 10, startDate: daysAgo(6) });
    expect(calculateBalance(child, [])).toBe(0);
  });

  it("addiert eine Wochenrate nach genau 7 Tagen", () => {
    const child = makeChild({ startBalance: 0, weeklyRate: 10, startDate: daysAgo(7) });
    expect(calculateBalance(child, [])).toBe(10);
  });

  it("addiert n Wochenraten nach n×7 Tagen", () => {
    const child = makeChild({ startBalance: 0, weeklyRate: 5, startDate: daysAgo(21) });
    expect(calculateBalance(child, [])).toBe(15); // 3 Wochen × 5€
  });

  it("berücksichtigt start_balance korrekt", () => {
    const child = makeChild({ startBalance: 50, weeklyRate: 10, startDate: daysAgo(7) });
    expect(calculateBalance(child, [])).toBe(60); // 50 + 1×10
  });

  it("zieht Abbuchungen (negative amounts) vom Guthaben ab", () => {
    const child = makeChild({ startBalance: 0, weeklyRate: 10, startDate: daysAgo(7) });
    const transactions = [makeTransaction({ amount: -3 })];
    expect(calculateBalance(child, transactions)).toBe(7); // 10 - 3
  });

  it("addiert Einzahlungen (positive amounts) zum Guthaben", () => {
    const child = makeChild({ startBalance: 0, weeklyRate: 10, startDate: daysAgo(7) });
    const transactions = [makeTransaction({ amount: 20 })]; // Geburtstagsgeschenk
    expect(calculateBalance(child, transactions)).toBe(30); // 10 + 20
  });

  it("kombiniert: start_balance + Rate + Einzahlungen + Abbuchungen", () => {
    const child = makeChild({ startBalance: 5, weeklyRate: 10, startDate: daysAgo(14) });
    const transactions = [
      makeTransaction({ amount: 15 }), // +15 Geschenk
      makeTransaction({ amount: -8 }), // -8 Abbuchung
    ];
    // 5 + 2×10 + 15 - 8 = 32
    expect(calculateBalance(child, transactions)).toBe(32);
  });

  it("erlaubt negativen Kontostand durch Einzahlungen nicht zu unterschreiten — Abbuchungen werden von der Logik nicht begrenzt", () => {
    const child = makeChild({ startBalance: 0, weeklyRate: 0, startDate: daysAgo(0) });
    const transactions = [makeTransaction({ amount: -100 })];
    // Die Berechnung selbst begrenzt nicht — das macht die Action
    expect(calculateBalance(child, transactions)).toBe(-100);
  });
});
