import { Form, redirect, useActionData } from "react-router";
import { createParentSession } from "~/lib/auth";

export async function action({ request }: { request: Request; params: Record<string, string>; context: unknown }) {
  const formData = await request.formData();
  const password = formData.get("password") as string;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Falsches Passwort" }, { status: 401 });
  }

  const cookie = await createParentSession("/");
  return redirect("/", { headers: { "Set-Cookie": cookie } });
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const error = actionData && "error" in actionData ? actionData.error : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-6 py-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 text-center">Eltern-Login</h1>
        <Form method="post" className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-2.5 rounded-lg font-medium hover:opacity-80 transition-opacity"
          >
            Einloggen
          </button>
        </Form>
      </div>
    </div>
  );
}
