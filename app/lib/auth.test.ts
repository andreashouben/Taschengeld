import { describe, it, expect, vi, beforeEach } from "vitest";

// Passwort und Session-Secret über env steuern
vi.stubEnv("ADMIN_PASSWORD", "testpass123");
vi.stubEnv("SESSION_SECRET", "test-secret");

describe("requireParent()", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("leitet zu /login um wenn keine Session vorhanden", async () => {
    const { requireParent } = await import("~/lib/auth");
    const request = new Request("http://localhost/kinder/1", { method: "POST" });
    const result = await requireParent(request);
    expect(result).toBeDefined();
    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toBe("/login");
  });

  it("gibt null zurück wenn Session gültig ist", async () => {
    const { requireParent, createParentSession } = await import("~/lib/auth");
    const cookie = await createParentSession("/");
    const request = new Request("http://localhost/kinder/1", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    const result = await requireParent(request);
    expect(result).toBeNull();
  });
});

describe("isParent()", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("gibt false zurück ohne Session", async () => {
    const { isParent } = await import("~/lib/auth");
    const request = new Request("http://localhost/");
    expect(await isParent(request)).toBe(false);
  });

  it("gibt true zurück mit gültiger Session", async () => {
    const { isParent, createParentSession } = await import("~/lib/auth");
    const cookie = await createParentSession("/");
    const request = new Request("http://localhost/", {
      headers: { Cookie: cookie },
    });
    expect(await isParent(request)).toBe(true);
  });
});
