import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestDb } from "~/lib/test-db";

vi.stubEnv("ADMIN_PASSWORD", "testpass");
vi.stubEnv("SESSION_SECRET", "test-secret");

// Fixpunkt: Montag 15.01.2024 → startDate = 01.01.2024 (Montag) → 2 Auszahlungen (08.01, 15.01)
const NOW = new Date("2024-01-15T12:00:00Z");
const START_DATE = "2024-01-01";
const WEEKLY_RATE = 10;

describe("Kinder-Bearbeiten Route (kinder.$id_.bearbeiten)", () => {
  let testDb: ReturnType<typeof createTestDb>;
  let childId: number;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    testDb = createTestDb();
    vi.resetModules();
    vi.doMock("~/db/index", () => testDb);
    vi.doMock("~/lib/auth", () => ({
      requireParent: async () => null,
    }));

    const { db } = testDb;
    const { children } = await import("~/db/schema");

    const result = db
      .insert(children)
      .values({ name: "Lena", weeklyRate: WEEKLY_RATE, startDate: START_DATE, startBalance: 0, payoutDay: 1 })
      .run();
    childId = Number(result.lastInsertRowid);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function callAction(overrides: Record<string, string> = {}) {
    const { action } = await import("~/routes/kinder.$id_.bearbeiten");
    const body = new FormData();
    body.set("name", "Lena");
    body.set("weeklyRate", String(WEEKLY_RATE));
    body.set("startBalance", "0");
    body.set("startDate", START_DATE);
    body.set("payoutDay", "1");
    for (const [k, v] of Object.entries(overrides)) body.set(k, v);

    const request = new Request(`http://localhost/kinder/${childId}/bearbeiten`, {
      method: "POST",
      body,
    });

    try {
      return await action({ request, params: { id: String(childId) }, context: {} });
    } catch {
      // redirect() wirft in React Router — das ist OK
      return null;
    }
  }

  describe("action() — Rate-Änderung", () => {
    it("legt einen Verlaufseintrag an wenn die Rate sich ändert", async () => {
      await callAction({ weeklyRate: "15" });

      const { db } = testDb;
      const { transactions } = await import("~/db/schema");
      const { eq } = await import("drizzle-orm");
      const rows = db.select().from(transactions).where(eq(transactions.childId, childId)).all();

      expect(rows).toHaveLength(1);
      expect(rows[0].amount).toBe(0);
    });

    it("Note des Verlaufseintrags enthält alte und neue Rate", async () => {
      await callAction({ weeklyRate: "15" });

      const { db } = testDb;
      const { transactions } = await import("~/db/schema");
      const { eq } = await import("drizzle-orm");
      const rows = db.select().from(transactions).where(eq(transactions.childId, childId)).all();

      expect(rows[0].note).toContain("10");
      expect(rows[0].note).toContain("15");
    });

    it("legt keinen Verlaufseintrag an wenn die Rate gleich bleibt", async () => {
      await callAction({ weeklyRate: "10" }); // unverändert

      const { db } = testDb;
      const { transactions } = await import("~/db/schema");
      const { eq } = await import("drizzle-orm");
      const rows = db.select().from(transactions).where(eq(transactions.childId, childId)).all();

      expect(rows).toHaveLength(0);
    });

    it("friert bisherige Raten korrekt in startBalance ein (2 Wochen × 10€ = 20€)", async () => {
      // now = Mo 15.01., startDate = Mo 01.01., payoutDay = Mo → 2 Auszahlungen à 10€
      await callAction({ weeklyRate: "15" });

      const { db } = testDb;
      const { children } = await import("~/db/schema");
      const { eq } = await import("drizzle-orm");
      const updated = db.select().from(children).where(eq(children.id, childId)).get();

      expect(updated!.startBalance).toBe(20); // 2 × 10€
    });

    it("setzt startDate auf heute bei Rate-Änderung", async () => {
      await callAction({ weeklyRate: "15" });

      const { db } = testDb;
      const { children } = await import("~/db/schema");
      const { eq } = await import("drizzle-orm");
      const updated = db.select().from(children).where(eq(children.id, childId)).get();

      expect(updated!.startDate).toBe("2024-01-15");
    });

    it("übernimmt die neue Rate korrekt", async () => {
      await callAction({ weeklyRate: "15" });

      const { db } = testDb;
      const { children } = await import("~/db/schema");
      const { eq } = await import("drizzle-orm");
      const updated = db.select().from(children).where(eq(children.id, childId)).get();

      expect(updated!.weeklyRate).toBe(15);
    });

    it("bestehende manuelle Transaktionen bleiben bei Rate-Änderung erhalten", async () => {
      const { db } = testDb;
      const { transactions } = await import("~/db/schema");
      db.insert(transactions).values({ childId, amount: -5, note: "Eis" }).run();

      await callAction({ weeklyRate: "15" });

      const { eq } = await import("drizzle-orm");
      const rows = db.select().from(transactions).where(eq(transactions.childId, childId)).all();
      // Eis-Buchung + Rate-Änderungs-Eintrag
      expect(rows).toHaveLength(2);
      expect(rows.some((r) => r.note === "Eis")).toBe(true);
    });
  });
});
