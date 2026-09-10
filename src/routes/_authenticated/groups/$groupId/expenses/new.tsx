import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExpenseForm } from "@/frontend/features/expenses/ExpenseForm";
import { PageHeader } from "@/frontend/components/PageHeader";
import { groupQuery, useCreateExpense } from "@/frontend/services/queries";
import { Route as AuthedRoute } from "../../../../_authenticated";

export const Route = createFileRoute("/_authenticated/groups/$groupId/expenses/new")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(groupQuery(params.groupId)),
  head: () => ({
    meta: [
      { title: "New expense — ShareBucks" },
      { name: "description", content: "Record a shared expense and split it among members." },
      { property: "og:title", content: "New expense — ShareBucks" },
      { property: "og:description", content: "Record a shared expense and split it among members." },
    ],
  }),
  component: NewExpensePage,
});

function NewExpensePage() {
  const { groupId } = Route.useParams();
  const { user } = AuthedRoute.useRouteContext();
  const { data: group } = useSuspenseQuery(groupQuery(groupId));
  const create = useCreateExpense(groupId);
  const navigate = useNavigate();

  return (
    <>
      <PageHeader eyebrow={group.name} title="New expense" description="Everyone active in the group is included by default." />
      <ExpenseForm
        group={group}
        currentUserId={user.id}
        pending={create.isPending}
        submitLabel="Save expense"
        onSubmit={(input) =>
          create.mutate(input, {
            onSuccess: () => {
              toast.success("Expense added");
              navigate({ to: "/groups/$groupId", params: { groupId } });
            },
          })
        }
      />
    </>
  );
}
