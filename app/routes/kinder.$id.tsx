import { and, eq } from "drizzle-orm";
import { useEffect, useRef, useState } from "react";
import { Form, Link, useActionData, useLoaderData, useFetcher, useSubmit } from "react-router";
import { DeleteButton } from "~/components/DeleteButton";
import { isParent, requireParent } from "~/lib/auth";
import { db } from "~/db/index";
import { children, transactions } from "~/db/schema";
import { calculateBalance, generateRateEntries } from "~/lib/balance";

export async function loader({ params, request }: { params: { id: string }; request: Request; context: unknown }) {
  const id = Number(params.id);
  const child = db.select().from(children).where(eq(children.id, id)).get();

  if (!child) {
    return Response.json({ error: "Kind nicht gefunden" }, { status: 404 });
  }

  const childTransactions = db
    .select()
    .from(transactions)
    .where(eq(transactions.childId, id))
    .all();

  const allEntries = [...childTransactions, ...generateRateEntries(child)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return Response.json({ child, transactions: allEntries, childTransactions, isParent: await isParent(request) });
}

export async function action({ params, request }: { params: { id: string }; request: Request; context: unknown }) {
  const authRedirect = await requireParent(request);
  if (authRedirect) return authRedirect;

  const id = Number(params.id);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const amountRaw = formData.get("amount") as string;
  const note = (formData.get("note") as string | null) || null;
  const amount = parseFloat(amountRaw);

  if (intent === "withdraw") {
    if (isNaN(amount) || amount <= 0) {
      return Response.json({ error: "Betrag muss größer als 0 sein" }, { status: 422 });
    }

    const child = db.select().from(children).where(eq(children.id, id)).get();
    if (!child) {
      return Response.json({ error: "Kind nicht gefunden" }, { status: 404 });
    }

    const childTransactions = db.select().from(transactions).where(eq(transactions.childId, id)).all();
    const balance = calculateBalance(child, childTransactions);

    // Überziehung ist erlaubt, muss aber ausdrücklich bestätigt werden
    if (amount > balance && formData.get("confirmOverdraft") !== "true") {
      return Response.json({ error: "Überziehung muss bestätigt werden", needsConfirmation: true }, { status: 409 });
    }

    db.insert(transactions).values({ childId: id, amount: -amount, note }).run();
    return Response.json({ ok: true });
  }

  if (intent === "deposit") {
    if (isNaN(amount) || amount <= 0) {
      return Response.json({ error: "Betrag muss größer als 0 sein" }, { status: 422 });
    }

    db.insert(transactions).values({ childId: id, amount, note }).run();
    return Response.json({ ok: true });
  }

  if (intent === "deleteTransaction") {
    const txId = parseInt(formData.get("txId") as string, 10);
    if (isNaN(txId)) {
      return Response.json({ error: "Ungültige Transaktions-ID" }, { status: 422 });
    }
    db.delete(transactions).where(and(eq(transactions.id, txId), eq(transactions.childId, id))).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unbekannte Aktion" }, { status: 400 });
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function TransactionForm({ intent, label, balance }: { intent: "withdraw" | "deposit"; label: string; balance?: number }) {
  const submit = useSubmit();
  const [overdraft, setOverdraft] = useState<{ amount: number; newBalance: number } | null>(null);
  const actionData = useActionData<typeof action>();
  const error = actionData && "error" in actionData ? actionData.error : null;
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (actionData && "ok" in actionData) {
      formRef.current?.reset();
    }
  }, [actionData]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (intent !== "withdraw" || balance === undefined) return;
    const amount = parseFloat(new FormData(e.currentTarget).get("amount") as string);
    if (!isNaN(amount) && amount > balance) {
      e.preventDefault();
      setOverdraft({ amount, newBalance: balance - amount });
    }
  }

  function confirmOverdraft() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    data.set("confirmOverdraft", "true");
    setOverdraft(null);
    submit(data, { method: "post" });
  }

  return (
    <Form ref={formRef} method="post" onSubmit={handleSubmit} className="space-y-2">
      {overdraft && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="overdraft-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <h2 id="overdraft-title" className="text-lg font-semibold text-gray-900 dark:text-white">Konto überziehen?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Die Abbuchung von {formatEuro(overdraft.amount)} übersteigt das Guthaben. Der neue Kontostand wäre{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">{formatEuro(overdraft.newBalance)}</span>.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOverdraft(null)} className="px-4 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                Abbrechen
              </button>
              <button type="button" onClick={confirmOverdraft} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:opacity-80">
                Trotzdem überziehen
              </button>
            </div>
          </div>
        </div>
      )}
      <input type="hidden" name="intent" value={intent} />
      <div className="flex gap-2">
        <input
          type="number"
          name="amount"
          min="0.01"
          step="0.01"
          placeholder="Betrag in €"
          required
          className="w-28 shrink-0 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
        <input
          type="text"
          name="note"
          placeholder="Kommentar (optional)"
          className="flex-1 min-w-0 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
        <button
          type="submit"
          className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-80 ${
            intent === "withdraw" ? "bg-red-600" : "bg-green-600"
          }`}
        >
          {label}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Form>
  );
}

function DeleteTransactionButton({ txId }: { txId: number }) {
  const fetcher = useFetcher();
  return (
    <DeleteButton
      onConfirm={() =>
        fetcher.submit({ intent: "deleteTransaction", txId: String(txId) }, { method: "post" })
      }
    />
  );
}

export default function KindDetail() {
  const { child, transactions: txList, childTransactions, isParent } = useLoaderData<typeof loader>();
  const balance = calculateBalance(child, childTransactions);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            ← Zurück
          </Link>
          {isParent && (
            <Link
              to={`/kinder/${child.id}/bearbeiten`}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Bearbeiten
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Balance Card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{child.name}</p>
          <p
            className={`text-5xl font-bold tabular-nums ${
              balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatEuro(balance)}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">{formatEuro(child.weeklyRate)} / Woche</p>
        </div>

        {/* Aktionen — nur für Eltern */}
        {isParent && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-5 py-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Abbuchung</p>
              <TransactionForm intent="withdraw" label="Abbuchen" balance={balance} />
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Einzahlung</p>
              <TransactionForm intent="deposit" label="Einzahlen" />
            </div>
          </div>
        )}

        {/* Historie */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Verlauf</p>
          </div>
          {txList.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 px-5 py-6 text-center">Noch keine Transaktionen.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {txList.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white">{tx.note ?? (tx.amount < 0 ? "Abbuchung" : "Einzahlung")}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(tx.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {tx.amount !== 0 && (
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : ""}{formatEuro(tx.amount)}
                      </span>
                    )}
                    {isParent && typeof tx.id === "number" && tx.amount !== 0 && (
                      <DeleteTransactionButton txId={tx.id} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
