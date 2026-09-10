import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Globe, Search, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { discoverQuery, useJoinGroup } from "@/services/queries";

export const Route = createFileRoute("/_authenticated/groups/discover")({
  head: () => ({
    meta: [
      { title: "Discover groups — ShareBucks" },
      { name: "description", content: "Find and join public expense-sharing groups." },
      { property: "og:title", content: "Discover groups — ShareBucks" },
      { property: "og:description", content: "Find and join public expense-sharing groups." },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const [search, setSearch] = useState("");
  const { data, isPending } = useQuery(discoverQuery(search));
  const join = useJoinGroup();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title="Discover" description="Public groups anyone can join." />
      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search public groups…"
          className="pl-9"
          aria-label="Search public groups"
        />
      </div>
      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : data && data.length === 0 ? (
        <EmptyState title="No public groups match" description="Try a different search or create your own public group." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((g) => (
            <div key={g.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base font-semibold">{g.name}</h3>
                <Badge variant="outline" className="font-mono">
                  {g.currency}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted-foreground">{g.description || "No description"}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {g.member_count}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Globe className="size-3.5" /> public
                  </span>
                </span>
                {g.is_member ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/groups/$groupId" params={{ groupId: g.id }}>
                      Open
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={join.isPending}
                    onClick={() =>
                      join.mutate(
                        { groupId: g.id },
                        {
                          onSuccess: (gd) => {
                            toast.success(`Joined ${gd.name}`);
                            navigate({ to: "/groups/$groupId", params: { groupId: gd.id } });
                          },
                        },
                      )
                    }
                  >
                    Join
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
