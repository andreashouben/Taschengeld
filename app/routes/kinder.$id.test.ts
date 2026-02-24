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
      expect(data.transactions).toHaveLength(2);
      // Neueste zuerst
      expect(data.transactions[0].note).toBe("Geburtstag");
      expect(data.transactions[1].note).toBe("Eis");
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
