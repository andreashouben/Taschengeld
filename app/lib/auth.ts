import { getSession, commitSession } from "~/lib/session";

/** Prüft ob die Session als Elternteil markiert ist. */
export async function isParent(request: Request): Promise<boolean> {
  const session = await getSession(request.headers.get("Cookie"));
  return session.get("isParent") === true;
}

/**
 * Stellt sicher dass der Request von einem eingeloggten Elternteil kommt.
 * Gibt null zurück wenn ok, gibt eine Redirect-Response zu /login zurück wenn nicht.
 */
export async function requireParent(request: Request): Promise<Response | null> {
  if (await isParent(request)) return null;
  return new Response(null, { status: 302, headers: { Location: "/login" } });
}

/**
 * Erstellt eine Session für Eltern und gibt den Set-Cookie-Header-Wert zurück.
 * Wird nach erfolgreichem Login aufgerufen.
 */
export async function createParentSession(redirectTo: string): Promise<string> {
  const session = await getSession();
  session.set("isParent", true);
  return commitSession(session);
}
