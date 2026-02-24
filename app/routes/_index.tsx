import { Form, Link, useLoaderData } from "react-router";
import { isParent } from "~/lib/auth";
import { db } from "~/db/index";
import { children, transactions } from "~/db/schema";
import { calculateBalance } from "~/lib/balance";

export async function loader({ request }: { request: Request; params: Record<string, string>; context: unknown }) {
  const allChildren = db.select().from(children).all();
  const allTransactions = db.select().from(transactions).all();

  const childrenWithBalance = allChildren.map((child) => ({
    ...child,
    balance: calculateBalance(
      child,
      allTransactions.filter((t) => t.childId === child.id)
    ),
  }));

  return Response.json({ children: childrenWithBalance, isParent: await isParent(request) });
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

export default function Index() {
  const { children, isParent } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Taschengeld</h1>
          <div className="flex items-center gap-3">
            {isParent ? (
              <>
                <Link
                  to="/kinder/neu"
                  className="text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 rounded-lg font-medium hover:opacity-80 transition-opacity"
                >
                  + Kind hinzufügen
                </Link>
                <Form method="post" action="/logout">
                  <button
                    type="submit"
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Ausloggen
                  </button>
                </Form>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Eltern-Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {children.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-12">
            Noch keine Kinder angelegt.{" "}
            <Link to="/kinder/neu" className="underline">
              Jetzt hinzufügen
            </Link>
          </p>
        )}
        {children.map((child) => (
          <Link
            key={child.id}
            to={`/kinder/${child.id}`}
            className="block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-4 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium text-gray-900 dark:text-white">{child.name}</span>
              <span
                className={`text-2xl font-bold tabular-nums ${
                  child.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatEuro(child.balance)}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {formatEuro(child.weeklyRate)} / Woche
            </p>
          </Link>
        ))}
      </main>
    </div>
  );
}
