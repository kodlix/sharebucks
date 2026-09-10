import { Link } from "@tanstack/react-router";
import { Archive, Globe, Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/Money";
import type { GroupSummary } from "@/frontend/types";

export function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Link
      to="/groups/$groupId"
      params={{ groupId: group.id }}
      className="group flex flex-col rounded-xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display truncate text-base font-semibold group-hover:text-primary">{group.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{group.description || "No description"}</p>
        </div>
        <Badge variant="outline" className="shrink-0 font-mono">
          {group.currency}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" /> {group.member_count}
        </span>
        <span className="inline-flex items-center gap-1">
          {group.visibility === "public" ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
          {group.visibility}
        </span>
        {group.role === "admin" && <Badge variant="secondary">Admin</Badge>}
        {group.is_archived && (
          <Badge variant="outline" className="gap-1">
            <Archive className="size-3" /> Archived
          </Badge>
        )}
      </div>
      <div className="mt-4 flex items-end justify-between border-t pt-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Your balance</p>
          <Money amount={group.my_balance} currency={group.currency} signed colored className="text-lg font-semibold" />
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total spent</p>
          <Money amount={group.total_spent} currency={group.currency} className="text-sm font-medium" />
        </div>
      </div>
    </Link>
  );
}
