import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { GroupCard } from "@/features/groups/GroupCard";
import { GroupFormDialog } from "@/features/groups/GroupFormDialog";
import { groupsQuery, useCreateGroup } from "@/services/queries";

export const Route = createFileRoute("/_authenticated/groups/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(groupsQuery),
  head: () => ({
    meta: [
      { title: "My groups — ShareBucks" },
      { name: "description", content: "All the groups you share expenses with." },
      { property: "og:title", content: "My groups — ShareBucks" },
      { property: "og:description", content: "All the groups you share expenses with." },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { data: groups } = useSuspenseQuery(groupsQuery);
  const create = useCreateGroup();
  const navigate = useNavigate();
  const active = groups.filter((g) => !g.is_archived);
  const archived = groups.filter((g) => g.is_archived);

  const createDialog = (
    <GroupFormDialog
      title="New group"
      pending={create.isPending}
      onSubmit={async (input) => {
        const g = await create.mutateAsync(input);
        navigate({ to: "/groups/$groupId", params: { groupId: g.id } });
      }}
      trigger={
        <Button>
          <Plus /> New group
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader
        title="My groups"
        description={`${active.length} active · ${archived.length} archived`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/join">
                <Ticket /> Join with code
              </Link>
            </Button>
            {createDialog}
          </>
        }
      />
      {active.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create a group for your next trip or your household, or discover public groups."
          action={createDialog}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display mb-3 text-lg font-semibold text-muted-foreground">Archived</h2>
          <div className="grid gap-4 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
