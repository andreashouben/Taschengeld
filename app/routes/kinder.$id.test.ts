import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, daysAgo } from "~/lib/test-db";

vi.stubEnv("ADMIN_PASSWORD", "testpass");
vi.stubEnv("SESSION_SECRET", "test-secret");

describe("Kinder-Detail Route (kinder.$id)", () => {
  let testDb: ReturnType<typeof createTestDb>;
  let childId: number;

  beforeEach(async () => {
    testDb = createTestDb();
    vi.resetModules();
    vi.doMock("~/db/index", () => testDb);
    // Auth für Geschäftslogik-Tests bypassen
    vi.doMock("~/lib/auth", () => ({
      requireParent: async () => null,
      isParent: async () => true,
      createParentSession: async () => "",
    }));

    const { db } = testDb;
    const { children } = await import("~/db/schema");

    const result = db
      .insert(children)
      .values({ name: "Lena", weeklyRate: 10, startDate: daysAgo(14), startBalance: 0 })
      .run();
    childId = Number(result.lastInsertRowid);
  });

  // --- LOADER ---

  describe("loader()", () => {
    it("gibt das Kind mit Transaktionshistorie zurück (neueste zuerst)", async () => {
      const { db } = testDb;
      const { transactions } = await import("~/db/schema");

      const past = new Date(Date.now() - 60_000).toISOString();
      const now = new Date().toISOString();

      await db.insert(transactions).values([
        { childId, amount: -3, note: "Eis", createdAt: past },
        { childId, amount: 10, note: "Geburtstag", createdAt: now },
      ]);

      const { loader } = await import("~/routes/kinder.$id");
      const request = new Request(`http://localhost/kinder/${childId}`);
      const response = await loader({ request, params: { id: String(childId) }, context: {} });
      const data = await response.json();

      expect(data.child.name).toBe("Lena");
      // Neueste zuerst — manuelle Transaktionen sind aktueller als synthetische Rate-Einträge
      expect(data.transactions[0].note).toBe("Geburtstag");
      expect(data.transactions[1].note).toBe("Eis");
      // Rate-Einträge (2 Wochen) sind ebenfalls enthalten
      expect(data.transactions.length).toBeGreaterThanOrEqual(2);
    });

    it("wirft 404 bei unbekannter id", async () => {
      const { loader } = await import("~/routes/kinder.$id");
      const request = new Request("http://localhost/kinder/9999");
      const response = await loader({ request, params: { id: "9999" }, context: {} });
      expect(response.status).toBe(404);
    });
  });

  // --- ACTION: Abbuchung ---

  describe("action() — Abbuchung", () => {
    it("erstellt Transaktion mit negativem Betrag", async () => {
      const { action } = await import("~/routes/kinder.$id");
      const body = new FormData();
      body.set("intent", "withdraw");
      body.set("amount", "5");

      const request = new Request(`http://localhost/kinder/${childId}`, {
        method: "POST",
        body,
      });
      const response = await action({ request, params: { id: String(childId) }, context: {} });
      expect(response.status).toBe(200);

      const { db } = testDb;
      const { transactions } = await import("~/db/schema");
      const { eq } = await import("drizzle-orm");
      const rows = db.select().from(transactions).where(eq(transactions.childId, childId)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].amount).toBe(-5);
    });

    it("speichert optionalen Kommentar bei Abbuchung", async () => {
      const { action } = await import("~/routes/kinder.$id");
      const body = new FormData();
      body.set("intent", "withdraw");
      body.set("amount", "3");
      body.set("note", "Minecraft");

      const request = new Request(`http://localhost/kinder/${childId}`, {
        method: "POST",
        body,
      });
      await action({ request, params: { id: String(childId) }, context: {} });

      const { db } = testDb;
      const { transactions } = await import("~/db/schema");
      const { eq } = await import("drizzle-orm");
      const rows = db.select().from(transactions).where(eq(transactions.childId, childId)).all();
      expect(rows[0].note).toBe("Minecraft");
    });

    it("schlägt fehl wenn Abbuchung das Guthaben übersteigt", async () => {
      // Lena hat 2 Wochen × 10€ = 20€
      const { action } = await import("~/routes/kinder.$id");
      const body = new FormData();
      body.set("intent", "withdraw");
      body.set("amount", "25"); // mehr als 20€

      const request = new Request(`http://localhost/kinder/${childId}`, {
        method: "POST",
        body,
      });
      const response = await action({ request, params: { id: String(childId) }, context: {} });
      expect(response.status).toBe(422);
    });

    it("schlägt fehl bei amount ≤ 0", async () => {
      const { action } = await import("~/routes/kinder.$id");
      const body = new FormData();
      body.set("intent", "withdraw");
      body.set("amount", "0");

      const request = new Request(`http://localhost/kinder/${childId}`, {
        method: "POST",
        body,
      });
      const response = await action({ request, params: { id: String(childId) }, context: {} });
      expect(response.status).toBe(422);
    });
  });

  // --- createdAt Timestamp ---

  describe("createdAt Timestamp", () => {
    it("verwendet die aktuelle Uhrzeit zum Zeitpunkt des Inserts (nicht den Serverstart)", async () => {
      vi.useFakeTimers();

      try {
        const T1 = new Date("2024-06-01T10:00:00.000Z");
        const T2 = new Date("2024-06-01T10:05:00.000Z");

        vi.setSystemTime(T1);
        const { action } = await import("~/routes/kinder.$id");

        const body1 = new FormData();
        body1.set("intent", "deposit");
        body1.set("amount", "5");
        await action({
          request: new Request(`http://localhost/kinder/${childId}`, { method: "POST", body: body1 }),
          params: { id: String(childId) },
          context: {},
        });

        vi.setSystemTime(T2);

        const body2 = new FormData();
        body2.set("intent", "deposit");
        body2.set("amount", "3");
        await action({
          request: new Request(`http://localhost/kinder/${childId}`, { method: "POST", body: body2 }),
          params: { id: String(childId) },
          context: {},
        });
      } finally {
        vi.useRealTimers();
      }

      const { db } = testDb;
      const { transactions } = await import("~/db/schema");
      const { eq } = await import("drizzle-orm");
      const rows = db.select().from(transactions).where(eq(transactions.childId, childId)).all();

      expect(rows).toHaveLength(2);
      expect(rows[0].createdAt).not.toBe(rows[1].createdAt);
      expect(rows[0].createdAt).toContain("2024-06-01T10:00");
      expect(rows[1].createdAt).toContain("2024-06-01T10:05");
    });
  });

  // --- ACTION: Transaktion löschen ---

  describe("action() — Transaktion löschen", () => {
    it("löscht eine vorhandene Transaktion", async () => {
      const { db } = testDb;
      const { transactions } = await import("~/db/schema");
      const result = db.insert(transactions).values({ childId, amount: 5, note: "Test" }).run();
      const txId = Number(result.lastInsertRowid);

      const { action } = await import("~/routes/kinder.$id");
      const body = new FormData();
      body.set("intent", "deleteTransaction");
      body.set("txId", String(txId));

      const request = new Request(`http://localhost/kinder/${childId}`, { method: "POST", body });
      const response = await action({ request, params: { id: String(childId) }, context: {} });
      expect(response.status).toBe(200);

      const { eq } = await import("drizzle-orm");
      const rows = db.select().from(transactions).where(eq(transactions.childId, childId)).all();
      expect(rows).toHaveLength(0);
    });

    it("gibt 422 bei nicht-numerischer txId zurück", async () => {
      const { action } = await import("~/routes/kinder.$id");
      const body = new FormData();
      body.set("intent", "deleteTransaction");
      body.set("txId", "abc");

      const request = new Request(`http://localhost/kinder/${childId}`, { method: "POST", body });
      const response = await action({ request, params: { id: String(childId) }, context: {} });
      expect(response.status).toBe(422);
    });

    it("löscht keine Transaktion eines anderen Kindes", async () => {
      const { db } = testDb;
      const { children, transactions } = await import("~/db/schema");

      const result2 = db
        .insert(children)
        .values({ name: "Max", weeklyRate: 5, startDate: daysAgo(7), startBalance: 0 })
        .run();
      const otherId = Number(result2.lastInsertRowid);

      const txResult = db
        .insert(transactions)
        .values({ childId: otherId, amount: 10, note: "fremde Buchung" })
        .run();
      const txId = Number(txResult.lastInsertRowid);

      const { action } = await import("~/routes/kinder.$id");
      const body = new FormData();
      body.set("intent", "deleteTransaction");
      body.set("txId", String(txId));

      // Versuche über childId die Transaktion von otherId zu löschen
      const request = new Request(`http://localhost/kinder/${childId}`, { method: "POST", body });
      await action({ request, params: { id: String(childId) }, context: {} });

      const { eq } = await import("drizzle-orm");
      const rows = db.select().from(transactions).where(eq(transactions.childId, otherId)).all();
      expect(rows).toHaveLength(1); // Transaktion unberührt
    });
  });

  // --- ACTION: Einzahlung ---

  describe("action() — Einzahlung", () => {
    it("erstellt Transaktion mit positivem Betrag", async () => {
      const { action } = await import("~/routes/kinder.$id");
      const body = new FormData();
      body.set("intent", "deposit");
      body.set("amount", "20");

      const request = new Request(`http://localhost/kinder/${childId}`, {
        method: "POST",
        body,
      });
      const response = await action({ request, params: { id: String(childId) }, context: {} });
      expect(response.status).toBe(200);

      const { db } = testDb;
      const { transactions } = await import("~/db/schema");
      const { eq } = await import("drizzle-orm");
      const rows = db.select().from(transactions).where(eq(transactions.childId, childId)).all();
      expect(rows[0].amount).toBe(20);
    });

    it("speichert optionalen Kommentar bei Einzahlung", async () => {
      const { action } = await import("~/routes/kinder.$id");
      const body = new FormData();
      body.set("intent", "deposit");
      body.set("amount", "15");
      body.set("note", "Oma und Opa");

      const request = new Request(`http://localhost/kinder/${childId}`, {
        method: "POST",
        body,
      });
      await action({ request, params: { id: String(childId) }, context: {} });

      const { db } = testDb;
      const { transactions } = await import("~/db/schema");
      const { eq } = await import("drizzle-orm");
      const rows = db.select().from(transactions).where(eq(transactions.childId, childId)).all();
      expect(rows[0].note).toBe("Oma und Opa");
    });

    it("schlägt fehl bei amount ≤ 0", async () => {
      const { action } = await import("~/routes/kinder.$id");
      const body = new FormData();
      body.set("intent", "deposit");
      body.set("amount", "-5");

      const request = new Request(`http://localhost/kinder/${childId}`, {
        method: "POST",
        body,
      });
      const response = await action({ request, params: { id: String(childId) }, context: {} });
      expect(response.status).toBe(422);
    });
  });
});

describe("Kinder-Detail Route — Auth-Schutz", () => {
  it("leitet zu /login um wenn nicht eingeloggt", async () => {
    vi.resetModules();
    // Echte Auth-Implementierung explizit wiederherstellen
    vi.doMock("~/lib/auth", async () => vi.importActual("~/lib/auth"));
    const { action } = await import("~/routes/kinder.$id");
    const body = new FormData();
    body.set("intent", "withdraw");
    body.set("amount", "5");

    const request = new Request("http://localhost/kinder/1", { method: "POST", body });
    const response = await action({ request, params: { id: "1" }, context: {} });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
  });
});
