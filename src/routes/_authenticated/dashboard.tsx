import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, formatDate, Money } from "@/frontend/components/Money";
import { EmptyState, PageHeader, StatCard } from "@/frontend/components/PageHeader";
import { formatMoney } from "@/frontend/lib/money";
import { dashboardQuery } from "@/frontend/services/queries";
import { Route as AuthedRoute } from "../_authenticated";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  head: () => ({
    meta: [
      { title: "Dashboard — ShareBucks" },
      { name: "description", content: "Your balances, recent activity and spending at a glance." },
      { property: "og:title", content: "Dashboard — ShareBucks" },
      { property: "og:description", content: "Your balances, recent activity and spending at a glance." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = AuthedRoute.useRouteContext();
  const { data } = useSuspenseQuery(dashboardQuery);
  const { totals, spending } = data;
  const activeGroups = data.groups.filter((g) => !g.is_archived);
  // The mock aggregates across groups at face value; surface the most common currency for display.
  const currency = mostCommon(activeGroups.map((g) => g.currency)) ?? "USD";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const maxCat = spending.by_category[0]?.amount ?? 1;

  return (
    <>
      <PageHeader
        eyebrow={greeting}
        title={user.display_name.split(" ")[0] ?? user.display_name}
        description="Here's where things stand across your groups."
        actions={
          <Button asChild>
            <Link to="/groups">
              Go to groups <ArrowRight />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net balance"
          value={formatMoney(totals.net, currency, { signed: true })}
          tone={totals.net > 0 ? "positive" : totals.net < 0 ? "negative" : "neutral"}
          hint={totals.net === 0 ? "All settled" : totals.net > 0 ? "Overall, you are owed" : "Overall, you owe"}
        />
        <StatCard label="You owe" value={formatMoney(totals.owed, currency)} tone={totals.owed > 0 ? "negative" : "neutral"} />
        <StatCard
          label="Owed to you"
          value={formatMoney(totals.receivable, currency)}
          tone={totals.receivable > 0 ? "positive" : "neutral"}
        />
        <StatCard
          label="Outstanding settlements"
          value={totals.outstanding_settlements}
          hint="Suggested payments involving you"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border bg-card p-5 shadow-xs lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-semibold">Your groups</h2>
            <Link to="/groups" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          {data.groups.length === 0 ? (
            <EmptyState title="No groups yet" description="Create or join a group to get started." />
          ) : (
            <ul className="divide-y">
              {data.groups.map((g) => (
                <li key={g.id}>
                  <Link
                    to="/groups/$groupId"
                    params={{ groupId: g.id }}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.member_count} members · {g.role}
                        {g.is_archived && " · archived"}
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {g.currency}
                    </Badge>
                    <Money amount={g.my_balance} currency={g.currency} signed colored className="w-24 text-right text-sm font-semibold" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="font-display font-semibold">Your spending</h2>
          <p className="mt-1 text-xs text-muted-foreground">Your share of expenses, last 6 months</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tabular-nums">{formatMoney(spending.this_month, currency)}</span>
            <span className="text-xs text-muted-foreground">this month</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMoney(spending.last_month, currency)} last month · {formatMoney(spending.total, currency)} all time
          </p>
          <div className="mt-4 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spending.by_month.map((m) => ({ ...m, label: monthLabel(m.month) }))}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  formatter={(v) => [formatMoney(Number(v), currency), "Spent"]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {spending.by_category.slice(0, 5).map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-xs">
                  <span>{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatMoney(c.amount, currency)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="font-display mb-3 font-semibold">Recent expenses</h2>
          {data.recent_expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y">
              {data.recent_expenses.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/groups/$groupId/expenses/$expenseId"
                    params={{ groupId: e.group_id, expenseId: e.id }}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60"
                  >
                    <Avatar name={e.payer.display_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.payer.display_name} paid · {e.group.name} · {e.category.name} · {formatDate(e.expense_date)}
                      </p>
                    </div>
                    <Money amount={e.amount} currency={e.group.currency} className="text-sm font-semibold" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5 shadow-xs">
          <h2 className="font-display mb-3 font-semibold">Recent settlements</h2>
          {data.recent_settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No settlements recorded yet.</p>
          ) : (
            <ul className="divide-y">
              {data.recent_settlements.map((s) => {
                const g = data.groups.find((x) => x.id === s.group_id);
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={s.payer.display_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <span className="font-medium">{s.payer.display_name}</span> paid{" "}
                        <span className="font-medium">{s.recipient.display_name}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.group.name} · {formatDate(s.settlement_date)}
                        {g && g.my_balance !== 0 && ` · ${formatMoney(Math.abs(g.my_balance), s.group.currency)} still outstanding for you`}
                      </p>
                    </div>
                    <Money amount={s.amount} currency={s.group.currency} className="text-sm font-semibold text-positive" />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function mostCommon(list: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const x of list) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function monthLabel(key: string): string {
  const [y = 0, m = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}
