import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const children = sqliteTable("children", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  weeklyRate: real("weekly_rate").notNull(),
  startDate: text("start_date").notNull(), // ISO date YYYY-MM-DD
  startBalance: real("start_balance").notNull().default(0),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  childId: integer("child_id")
    .notNull()
    .references(() => children.id),
  amount: real("amount").notNull(), // positiv = Einzahlung, negativ = Abbuchung
  note: text("note"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export type Child = typeof children.$inferSelect;
export type NewChild = typeof children.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
