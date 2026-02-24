import { redirect } from "react-router";
import { destroySession, getSession } from "~/lib/session";

export async function action({ request }: { request: Request; params: Record<string, string>; context: unknown }) {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/", { headers: { "Set-Cookie": await destroySession(session) } });
}
