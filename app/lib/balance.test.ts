import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { calculateBalance } from "./balance";
import type { Child, Transaction } from "~/db/schema";

// Fixer Ankerpunkt: Montag, 08.01.2024
const MONDAY_JAN_08 = new Date("2024-01-08T12:00:00Z");

function makeChild(overrides: Partial<Child> = {}): Child {
  return {
    id: 1,
    name: "Testekind",
    weeklyRate: 10,
    startDate: "2024-01-01", // Montag — eine Woche vor MONDAY_JAN_08
    startBalance: 0,
    payoutDay: 1, // Montag
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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MONDAY_JAN_08);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gibt start_balance zurück wenn startDate heute ist (Auszahlungstag noch nicht erreicht)", () => {
    // now = Mo 08.01., startDate = Mo 08.01., payoutDay = Mo → daysToFirst = 7, daysDiff = 0
    const child = makeChild({ startBalance: 20, startDate: "2024-01-08" });
    expect(calculateBalance(child, [])).toBe(20);
  });

  it("addiert keine Rate wenn der Auszahlungstag noch nicht erreicht ist", () => {
    // now = So 07.01., startDate = Mo 01.01., payoutDay = Mo → daysToFirst = 7, daysDiff = 6
    vi.setSystemTime(new Date("2024-01-07T12:00:00Z"));
    const child = makeChild({ startDate: "2024-01-01", payoutDay: 1 });
    expect(calculateBalance(child, [])).toBe(0);
  });

  it("addiert eine Rate nach dem ersten Auszahlungstag", () => {
    // now = Mo 08.01., startDate = Mo 01.01., payoutDay = Mo → daysToFirst = 7, daysDiff = 7
    const child = makeChild({ startDate: "2024-01-01", weeklyRate: 10 });
    expect(calculateBalance(child, [])).toBe(10);
  });

  it("addiert n Raten nach n Auszahlungstagen", () => {
    // now = Mo 29.01. (4 Montage nach dem 01.01.), daysDiff = 28 → 4 Raten
    vi.setSystemTime(new Date("2024-01-29T12:00:00Z"));
    const child = makeChild({ startDate: "2024-01-01", weeklyRate: 5 });
    expect(calculateBalance(child, [])).toBe(20); // 4 × 5€
  });

  it("berücksichtigt start_balance korrekt", () => {
    const child = makeChild({ startBalance: 50, weeklyRate: 10, startDate: "2024-01-01" });
    expect(calculateBalance(child, [])).toBe(60); // 50 + 1×10
  });

  it("Auszahlungstag ≠ Startdatum-Wochentag: Rate wird am ersten Auftreten des Auszahlungstags gutgeschrieben", () => {
    // startDate = Mo 01.01., payoutDay = Fr (5) → daysToFirst = 4
    // now = Fr 05.01., daysDiff = 4 → weeksElapsed = 1
    vi.setSystemTime(new Date("2024-01-05T12:00:00Z"));
    const child = makeChild({ startDate: "2024-01-01", payoutDay: 5, weeklyRate: 10 });
    expect(calculateBalance(child, [])).toBe(10);
  });

  it("Auszahlungstag ≠ Startdatum-Wochentag: keine Rate vor dem ersten Auftreten des Auszahlungstags", () => {
    // startDate = Mo 01.01., payoutDay = Fr (5) → daysToFirst = 4
    // now = Do 04.01., daysDiff = 3 → 3 < 4 → 0
    vi.setSystemTime(new Date("2024-01-04T12:00:00Z"));
    const child = makeChild({ startDate: "2024-01-01", payoutDay: 5, weeklyRate: 10 });
    expect(calculateBalance(child, [])).toBe(0);
  });

  it("zieht Abbuchungen (negative amounts) vom Guthaben ab", () => {
    const child = makeChild({ startDate: "2024-01-01", weeklyRate: 10 });
    const transactions = [makeTransaction({ amount: -3 })];
    expect(calculateBalance(child, transactions)).toBe(7); // 10 - 3
  });

  it("addiert Einzahlungen (positive amounts) zum Guthaben", () => {
    const child = makeChild({ startDate: "2024-01-01", weeklyRate: 10 });
    const transactions = [makeTransaction({ amount: 20 })];
    expect(calculateBalance(child, transactions)).toBe(30); // 10 + 20
  });

  it("kombiniert: start_balance + Raten + Einzahlungen + Abbuchungen", () => {
    // now = Mo 15.01. → 2 Raten seit 01.01.
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
    const child = makeChild({ startBalance: 5, weeklyRate: 10, startDate: "2024-01-01" });
    const transactions = [
      makeTransaction({ amount: 15 }),
      makeTransaction({ amount: -8 }),
    ];
    // 5 + 2×10 + 15 - 8 = 32
    expect(calculateBalance(child, transactions)).toBe(32);
  });

  it("Abbuchungen werden von der Berechnung nicht begrenzt (das macht die Action)", () => {
    const child = makeChild({ startBalance: 0, weeklyRate: 0, startDate: "2024-01-08" });
    const transactions = [makeTransaction({ amount: -100 })];
    expect(calculateBalance(child, transactions)).toBe(-100);
  });
});
