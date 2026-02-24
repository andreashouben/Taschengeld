import { eq } from "drizzle-orm";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { requireParent } from "~/lib/auth";
import { db } from "~/db/index";
import { children } from "~/db/schema";

export async function loader({ params, request }: { params: { id: string }; request: Request; context: unknown }) {
  const authRedirect = await requireParent(request);
  if (authRedirect) return authRedirect;

  const id = Number(params.id);
  const child = db.select().from(children).where(eq(children.id, id)).get();
  if (!child) return Response.json({ error: "Kind nicht gefunden" }, { status: 404 });
  return Response.json({ child });
}

export async function action({ params, request }: { params: { id: string }; request: Request; context: unknown }) {
  const authRedirect = await requireParent(request);
  if (authRedirect) return authRedirect;

  const id = Number(params.id);
  const formData = await request.formData();
  const name = (formData.get("name") as string).trim();
  const weeklyRate = parseFloat(formData.get("weeklyRate") as string);
  const startBalance = parseFloat((formData.get("startBalance") as string) || "0");
  const startDate = formData.get("startDate") as string;
  const payoutDay = parseInt(formData.get("payoutDay") as string, 10);

  if (!name) return Response.json({ error: "Name ist erforderlich" }, { status: 422 });
  if (isNaN(weeklyRate) || weeklyRate <= 0) return Response.json({ error: "Wochenrate muss größer als 0 sein" }, { status: 422 });
  if (!startDate) return Response.json({ error: "Startdatum ist erforderlich" }, { status: 422 });

  db.update(children)
    .set({ name, weeklyRate, startBalance: isNaN(startBalance) ? 0 : startBalance, startDate, payoutDay: isNaN(payoutDay) ? 1 : payoutDay })
    .where(eq(children.id, id))
    .run();

  return redirect(`/kinder/${id}`);
}

export default function KindBearbeiten() {
  const { child } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const error = actionData && "error" in actionData ? actionData.error : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link
            to={`/kinder/${child.id}`}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            ← Zurück
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">{child.name} bearbeiten</h2>

          <Form method="post" className="space-y-4">
            <Field label="Name" id="name">
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={child.name}
                className={inputClass}
              />
            </Field>

            <Field label="Wöchentliche Rate (€)" id="weeklyRate">
              <input
                id="weeklyRate"
                name="weeklyRate"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={child.weeklyRate}
                className={inputClass}
              />
            </Field>

            <Field label="Startguthaben (€)" id="startBalance">
              <input
                id="startBalance"
                name="startBalance"
                type="number"
                min="0"
                step="0.01"
                defaultValue={child.startBalance}
                className={inputClass}
              />
            </Field>

            <Field label="Startdatum" id="startDate">
              <input
                id="startDate"
                name="startDate"
                type="date"
                required
                defaultValue={child.startDate}
                className={inputClass}
              />
            </Field>

            <Field label="Auszahlungstag" id="payoutDay">
              <select id="payoutDay" name="payoutDay" defaultValue={String(child.payoutDay)} className={inputClass}>
                <option value="1">Montag</option>
                <option value="2">Dienstag</option>
                <option value="3">Mittwoch</option>
                <option value="4">Donnerstag</option>
                <option value="5">Freitag</option>
                <option value="6">Samstag</option>
                <option value="0">Sonntag</option>
              </select>
            </Field>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-2.5 rounded-lg font-medium hover:opacity-80 transition-opacity"
            >
              Speichern
            </button>
          </Form>
        </div>
      </main>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400";
