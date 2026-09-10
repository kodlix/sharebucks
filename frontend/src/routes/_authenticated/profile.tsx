import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, formatDate } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/services/api";
import { errorMessage, keys } from "@/services/queries";
import { Route as AuthedRoute } from "../_authenticated";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — ShareBucks" },
      { name: "description", content: "Manage your ShareBucks profile and account." },
      { property: "og:title", content: "Profile — ShareBucks" },
      { property: "og:description", content: "Manage your ShareBucks profile and account." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = AuthedRoute.useRouteContext();
  const [name, setName] = useState(user.display_name);
  const qc = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();

  const update = useMutation({
    mutationFn: () => api.auth.updateProfile({ display_name: name }),
    onSuccess: (u) => {
      qc.setQueryData(keys.me, u);
      qc.invalidateQueries();
      router.invalidate();
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reset = useMutation({
    mutationFn: () => api.resetMockData(),
    onSuccess: async () => {
      qc.clear();
      toast.success("Demo data reset. Please sign in again.");
      navigate({ to: "/auth", replace: true });
    },
  });

  return (
    <div className="max-w-xl">
      <PageHeader title="Profile" description="Your account details." />
      <div className="rounded-xl border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <Avatar name={user.display_name} size="lg" />
          <div>
            <p className="font-display text-lg font-semibold">{user.display_name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">Member since {formatDate(user.created_at)}</p>
          </div>
        </div>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} disabled />
          </div>
          <Button type="submit" disabled={update.isPending || name.trim() === user.display_name}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </div>

      <div className="mt-8 rounded-xl border border-dashed p-6">
        <h2 className="font-display font-semibold">Demo data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This preview runs on a local mock service. Reset it to restore the original sample groups and expenses.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => reset.mutate()} disabled={reset.isPending}>
          Reset demo data
        </Button>
      </div>
    </div>
  );
}
