import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("ADMIN_PASSWORD", "geheim123");
vi.stubEnv("SESSION_SECRET", "test-secret");

describe("Login Action", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("setzt Session-Cookie und leitet weiter bei korrektem Passwort", async () => {
    const { action } = await import("~/routes/login");
    const body = new FormData();
    body.set("password", "geheim123");

    const request = new Request("http://localhost/login", { method: "POST", body });
    const response = await action({ request, params: {}, context: {} });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.get("Set-Cookie")).toContain("taschengeld_session");
  });

  it("gibt Fehlermeldung bei falschem Passwort zurück", async () => {
    const { action } = await import("~/routes/login");
    const body = new FormData();
    body.set("password", "falsch");

    const request = new Request("http://localhost/login", { method: "POST", body });
    const response = await action({ request, params: {}, context: {} });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("gibt Fehlermeldung bei leerem Passwort zurück", async () => {
    const { action } = await import("~/routes/login");
    const body = new FormData();
    body.set("password", "");

    const request = new Request("http://localhost/login", { method: "POST", body });
    const response = await action({ request, params: {}, context: {} });

    expect(response.status).toBe(401);
  });
});
