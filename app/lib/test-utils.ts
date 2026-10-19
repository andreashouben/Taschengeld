import type { UNSAFE_DataWithResponseInit } from "react-router";

/**
 * Vereinheitlicht Loader-/Action-Ergebnisse (Response, data() oder einfaches Objekt)
 * zu { status, body, headers }.
 */
export async function unwrap(result: unknown): Promise<{ status: number; body: any; headers: Headers }> {
  if (result instanceof Response) {
    const text = await result.text();
    return { status: result.status, body: text ? JSON.parse(text) : null, headers: result.headers };
  }
  if (result && typeof result === "object" && "type" in result && result.type === "DataWithResponseInit") {
    const r = result as UNSAFE_DataWithResponseInit<unknown>;
    return { status: r.init?.status ?? 200, body: r.data, headers: new Headers(r.init?.headers) };
  }
  return { status: 200, body: result, headers: new Headers() };
}
