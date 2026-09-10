import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, formatDate, Money } from "@/frontend/components/Money";
import { PageHeader } from "@/frontend/components/PageHeader";
import { expenseQuery, groupQuery, useDeleteExpense } from "@/frontend/services/queries";
import { Route as AuthedRoute } from "../../../../../_authenticated";

export const Route = createFileRoute("/_authenticated/groups/$groupId/expenses/$expenseId/")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(groupQuery(params.groupId)),
      context.queryClient.ensureQueryData(expenseQuery(params.groupId, params.expenseId)),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Expense — ShareBucks" },
      { name: "description", content: "Expense details and how it was split." },
      { property: "og:title", content: "Expense — ShareBucks" },
      { property: "og:description", content: "Expense details and how it was split." },
    ],
  }),
  component: ExpenseDetailPage,
});

function ExpenseDetailPage() {
  const { groupId, expenseId } = Route.useParams();
  const { user } = AuthedRoute.useRouteContext();
  const { data: group } = useSuspenseQuery(groupQuery(groupId));
  const { data: expense } = useSuspenseQuery(expenseQuery(groupId, expenseId));
  const del = useDeleteExpense(groupId);
  const navigate = useNavigate();
  const isCreator = expense.created_by === user.id;
  const memberName = (id: string) => group.members.find((m) => m.user_id === id)?.user.display_name ?? "Unknown";

  return (
    <div className="max-w-2xl">
      <Link to="/groups/$groupId" params={{ groupId }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {group.name}
      </Link>
      <PageHeader
        eyebrow={expense.category.name}
        title={expense.title}
        description={`${formatDate(expense.expense_date)} · paid by ${expense.payer.display_name}`}
        actions={
          isCreator && !group.is_archived ? (
            <>
              <Button asChild variant="outline">
                <Link to="/groups/$groupId/expenses/$expenseId/edit" params={{ groupId, expenseId }}>
                  <Pencil /> Edit
                </Link>
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                disabled={del.isPending}
                onClick={() => {
                  if (confirm("Delete this expense? Balances will be recalculated."))
                    del.mutate(expenseId, { onSuccess: () => navigate({ to: "/groups/$groupId", params: { groupId } }) });
                }}
              >
                <Trash2 /> Delete
              </Button>
            </>
          ) : undefined
        }
      />
      <div className="rounded-xl border bg-card p-6 shadow-xs">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
        <Money amount={expense.amount} currency={group.currency} className="font-display text-3xl font-semibold" />
        {expense.notes && <p className="mt-3 text-sm text-muted-foreground">{expense.notes}</p>}
        <h3 className="font-display mt-6 mb-2 font-semibold">Split between {expense.shares.length}</h3>
        <ul className="divide-y">
          {expense.shares.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <Avatar name={memberName(s.user_id)} size="sm" />
              <span className="flex-1 text-sm">
                {memberName(s.user_id)}
                {s.user_id === user.id && <span className="text-muted-foreground"> (you)</span>}
              </span>
              {s.user_id === expense.payer_id && <Badge variant="secondary">paid</Badge>}
              <Money amount={s.amount} currency={group.currency} className="text-sm font-medium" />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Added by {memberName(expense.created_by)}. {isCreator ? "You can edit or delete this expense." : "Only the creator can edit it."}
        </p>
      </div>
    </div>
  );
}
