import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExpenseForm } from "@/frontend/features/expenses/ExpenseForm";
import { PageHeader } from "@/frontend/components/PageHeader";
import { expenseQuery, groupQuery, useUpdateExpense } from "@/frontend/services/queries";
import { Route as AuthedRoute } from "../../../../../_authenticated";

export const Route = createFileRoute("/_authenticated/groups/$groupId/expenses/$expenseId/edit")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(groupQuery(params.groupId)),
      context.queryClient.ensureQueryData(expenseQuery(params.groupId, params.expenseId)),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Edit expense — ShareBucks" },
      { name: "description", content: "Update an expense and its split." },
      { property: "og:title", content: "Edit expense — ShareBucks" },
      { property: "og:description", content: "Update an expense and its split." },
    ],
  }),
  component: EditExpensePage,
});

function EditExpensePage() {
  const { groupId, expenseId } = Route.useParams();
  const { user } = AuthedRoute.useRouteContext();
  const { data: group } = useSuspenseQuery(groupQuery(groupId));
  const { data: expense } = useSuspenseQuery(expenseQuery(groupId, expenseId));
  const update = useUpdateExpense(groupId, expenseId);
  const navigate = useNavigate();

  return (
    <>
      <PageHeader eyebrow={group.name} title="Edit expense" />
      <ExpenseForm
        group={group}
        currentUserId={user.id}
        initial={expense}
        pending={update.isPending}
        submitLabel="Save changes"
        onSubmit={(input) =>
          update.mutate(input, {
            onSuccess: () => {
              toast.success("Expense updated");
              navigate({ to: "/groups/$groupId/expenses/$expenseId", params: { groupId, expenseId } });
            },
          })
        }
      />
    </>
  );
}
