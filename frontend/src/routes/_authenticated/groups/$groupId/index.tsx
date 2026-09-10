import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Archive, ArrowRight, Copy, Globe, HandCoins, Lock, LogOut, Plus, Settings2, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, formatDate, Money } from "@/components/Money";
import { EmptyState, PageHeader, StatCard } from "@/components/PageHeader";
import { GroupFormDialog } from "@/features/groups/GroupFormDialog";
import { SettleDialog } from "@/features/settlements/SettleDialog";
import { formatMoney } from "@/lib/money";
import { api } from "@/services/api";
import {
  balancesQuery,
  errorMessage,
  expensesQuery,
  groupQuery,
  settlementsQuery,
  suggestionsQuery,
  useArchiveGroup,
  useLeaveGroup,
  useRemoveMember,
  useUpdateGroup,
} from "@/services/queries";
import { Route as AuthedRoute } from "../../../_authenticated";

export const Route = createFileRoute("/_authenticated/groups/$groupId/")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(groupQuery(params.groupId)),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Group"} — ShareBucks` },
      { name: "description", content: "Expenses, balances and settlements for this group." },
      { property: "og:title", content: `${loaderData?.name ?? "Group"} — ShareBucks` },
      { property: "og:description", content: "Expenses, balances and settlements for this group." },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { groupId } = Route.useParams();
  const { user } = AuthedRoute.useRouteContext();
  const { data: group } = useSuspenseQuery(groupQuery(groupId));
  const expenses = useQuery(expensesQuery(groupId));
  const balances = useQuery(balancesQuery(groupId));
  const suggestions = useQuery(suggestionsQuery(groupId));
  const settlements = useQuery(settlementsQuery(groupId));
  const update = useUpdateGroup(groupId);
  const archive = useArchiveGroup(groupId);
  const leave = useLeaveGroup(groupId);
  const removeMember = useRemoveMember(groupId);
  const navigate = useNavigate();
  const [invite, setInvite] = useState<string | null>(null);

  const isAdmin = group.role === "admin";
  const myBalance = balances.data?.find((b) => b.user_id === user.id)?.net ?? 0;
  const total = expenses.data?.reduce((a, e) => a + e.amount, 0) ?? 0;
  const activeMembers = group.members.filter((m) => m.status === "active");
  const canWrite = !group.is_archived;

  async function makeInvite() {
    try {
      const i = await api.groups.createInvite(groupId);
      setInvite(i.code);
      const url = `${window.location.origin}/join?code=${i.code}`;
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast.success(`Invite code ${i.code} copied to clipboard`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1">
            {group.visibility === "public" ? <Globe className="size-3" /> : <Lock className="size-3" />} {group.visibility} · {group.currency}
            {group.is_archived && " · archived"}
          </span>
        }
        title={group.name}
        description={group.description}
        actions={
          <>
            {canWrite && (
              <Button variant="outline" onClick={makeInvite}>
                <Copy /> {invite ? invite : "Invite"}
              </Button>
            )}
            {isAdmin && canWrite && (
              <GroupFormDialog
                title="Edit group"
                initial={group}
                pending={update.isPending}
                onSubmit={(input) => update.mutateAsync(input)}
                trigger={
                  <Button variant="outline" size="icon" aria-label="Group settings">
                    <Settings2 />
                  </Button>
                }
              />
            )}
            {canWrite && (
              <Button asChild>
                <Link to="/groups/$groupId/expenses/new" params={{ groupId }}>
                  <Plus /> Add expense
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Your balance"
          value={formatMoney(myBalance, group.currency, { signed: true })}
          tone={myBalance > 0 ? "positive" : myBalance < 0 ? "negative" : "neutral"}
          hint={myBalance > 0 ? "You are owed" : myBalance < 0 ? "You owe" : "You're settled"}
        />
        <StatCard label="Total spent" value={formatMoney(total, group.currency)} hint={`${expenses.data?.length ?? 0} expenses`} />
        <StatCard label="Members" value={activeMembers.length} hint={isAdmin ? "You are the administrator" : "You are a member"} />
      </div>

      <Tabs defaultValue="expenses" className="mt-8">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="settlements">Settle up</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-4">
          {expenses.data?.length === 0 ? (
            <EmptyState title="No expenses yet" description="Add the first expense and it'll be split among members." />
          ) : (
            <ul className="divide-y rounded-xl border bg-card shadow-xs">
              {expenses.data?.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/groups/$groupId/expenses/$expenseId"
                    params={{ groupId, expenseId: e.id }}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <Avatar name={e.payer.display_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.payer.display_name} paid · {formatDate(e.expense_date)} · {e.shares.length} people
                      </p>
                    </div>
                    <Badge variant="secondary" className="hidden sm:inline-flex">{e.category.name}</Badge>
                    <Money amount={e.amount} currency={group.currency} className="text-sm font-semibold" />
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="balances" className="mt-4">
          <ul className="divide-y rounded-xl border bg-card shadow-xs">
            {balances.data?.map((b) => (
              <li key={b.user_id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={b.user.display_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {b.user.display_name}
                    {b.user_id === user.id && <span className="text-muted-foreground"> (you)</span>}
                    {b.status === "inactive" && <Badge variant="outline" className="ml-2">left</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    paid {formatMoney(b.paid, group.currency)} · owes {formatMoney(b.owed, group.currency)}
                  </p>
                </div>
                <div className="text-right">
                  <Money amount={b.net} currency={group.currency} signed colored className="text-sm font-semibold" />
                  <p className="text-[11px] text-muted-foreground">{b.net > 0 ? "gets back" : b.net < 0 ? "owes" : "settled"}</p>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="settlements" className="mt-4 space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-semibold">Suggested payments</h3>
              {canWrite && balances.data && (
                <SettleDialog
                  groupId={groupId}
                  currency={group.currency}
                  balances={balances.data}
                  trigger={
                    <Button size="sm" variant="outline">
                      <HandCoins /> Record settlement
                    </Button>
                  }
                />
              )}
            </div>
            {suggestions.data?.length === 0 ? (
              <EmptyState title="Everyone is settled up" description="No outstanding balances in this group." />
            ) : (
              <ul className="divide-y rounded-xl border bg-card shadow-xs">
                {suggestions.data?.map((s, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Avatar name={s.payer.display_name} size="sm" />
                    <p className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{s.payer.display_name}</span> pays{" "}
                      <span className="font-medium">{s.recipient.display_name}</span>
                    </p>
                    <Money amount={s.amount} currency={group.currency} className="text-sm font-semibold" />
                    {canWrite && balances.data && (
                      <SettleDialog
                        groupId={groupId}
                        currency={group.currency}
                        balances={balances.data}
                        defaultPayer={s.payer_id}
                        defaultRecipient={s.recipient_id}
                        defaultAmount={s.amount}
                        trigger={<Button size="sm">Settle</Button>}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="font-display mb-3 font-semibold">Settlement history</h3>
            {settlements.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No settlements recorded yet.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card shadow-xs">
                {settlements.data?.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={s.payer.display_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{s.payer.display_name}</span> paid{" "}
                        <span className="font-medium">{s.recipient.display_name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(s.settlement_date)}
                        {s.note && ` · ${s.note}`}
                      </p>
                    </div>
                    <Money amount={s.amount} currency={group.currency} className="text-sm font-semibold text-positive" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="members" className="mt-4 space-y-6">
          <ul className="divide-y rounded-xl border bg-card shadow-xs">
            {group.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.user.display_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {m.user.display_name}
                    {m.user_id === user.id && <span className="text-muted-foreground"> (you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.status === "active" ? `joined ${formatDate(m.joined_at)}` : `left ${m.left_at ? formatDate(m.left_at) : ""}`}
                  </p>
                </div>
                {m.role === "admin" && <Badge>Admin</Badge>}
                {m.status === "inactive" && <Badge variant="outline">Inactive</Badge>}
                {isAdmin && canWrite && m.status === "active" && m.user_id !== user.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeMember.mutate(m.user_id)}
                    disabled={removeMember.isPending}
                  >
                    <UserMinus /> Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              {isAdmin ? (
                <Button
                  variant="outline"
                  className="text-destructive"
                  disabled={archive.isPending}
                  onClick={() => {
                    if (confirm("Archive this group? It will keep its history but accept no new expenses or members.")) archive.mutate();
                  }}
                >
                  <Archive /> Archive group
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="text-destructive"
                  disabled={leave.isPending}
                  onClick={() =>
                    leave.mutate(undefined, {
                      onSuccess: () => {
                        toast.success(`You left ${group.name}`);
                        navigate({ to: "/groups" });
                      },
                    })
                  }
                >
                  <LogOut /> Leave group
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
