import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { useJoinGroup } from "@/services/queries";

export const Route = createFileRoute("/_authenticated/join")({
  validateSearch: z.object({ code: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Join a group — ShareBucks" },
      { name: "description", content: "Enter an invitation code to join a private group." },
      { property: "og:title", content: "Join a group — ShareBucks" },
      { property: "og:description", content: "Enter an invitation code to join a private group." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const search = Route.useSearch();
  const [code, setCode] = useState(search.code ?? "");
  const join = useJoinGroup();
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    join.mutate(
      { code },
      {
        onSuccess: (g) => {
          toast.success(`Welcome to ${g.name}`);
          navigate({ to: "/groups/$groupId", params: { groupId: g.id } });
        },
      },
    );
  }

  return (
    <div className="max-w-md">
      <PageHeader title="Join with a code" description="Private groups share an invitation code or link." />
      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6 shadow-xs">
        <div className="space-y-1.5">
          <Label htmlFor="code">Invitation code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. LISBON24"
            className="font-mono uppercase tracking-widest"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">Demo codes: LISBON24, FLAT4B</p>
        </div>
        <Button type="submit" className="w-full" disabled={join.isPending || code.trim().length === 0}>
          {join.isPending ? "Joining…" : "Join group"}
        </Button>
      </form>
    </div>
  );
}
