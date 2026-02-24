import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, daysAgo } from "~/lib/test-db";

describe("Dashboard Loader (_index)", () => {
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    vi.resetModules();
    vi.doMock("~/db/index", () => testDb);
  });

  it("gibt alle Kinder zurück", async () => {
    const { db } = testDb;
    const { children } = await import("~/db/schema");

    await db.insert(children).values([
      { name: "Anna", weeklyRate: 5, startDate: daysAgo(0), startBalance: 0 },
      { name: "Ben", weeklyRate: 7, startDate: daysAgo(0), startBalance: 0 },
    ]);

    const { loader } = await import("~/routes/_index");
    const request = new Request("http://localhost/");
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    expect(data.children).toHaveLength(2);
    expect(data.children.map((c: { name: string }) => c.name)).toEqual(["Anna", "Ben"]);
  });

  it("gibt das berechnete Guthaben pro Kind zurück", async () => {
    const { db } = testDb;
    const { children } = await import("~/db/schema");

    await db.insert(children).values([
      { name: "Anna", weeklyRate: 10, startDate: daysAgo(7), startBalance: 5 },
    ]);

    const { loader } = await import("~/routes/_index");
    const request = new Request("http://localhost/");
    const response = await loader({ request, params: {}, context: {} });
    const data = await response.json();

    // 5 startBalance + 1 Woche × 10 = 15
    expect(data.children[0].balance).toBe(15);
  });
});
