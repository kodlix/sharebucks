import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Scale, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShareBucks — Split expenses with your group" },
      { name: "description", content: "Track shared expenses, split bills equally or by custom amounts, and settle up with the fewest payments." },
      { property: "og:title", content: "ShareBucks — Split expenses with your group" },
      { property: "og:description", content: "Track shared expenses, split bills equally or by custom amounts, and settle up with the fewest payments." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Users, title: "Groups for everything", body: "Trips, roommates, dinners, clubs. Public groups anyone can join, or private ones by invite." },
  { icon: Scale, title: "Exact balances", body: "Equal or custom splits, calculated in exact minor units. No rounding surprises." },
  { icon: Sparkles, title: "Smart settle-up", body: "See the fewest payments that clear everyone's debts, and record full or partial payments." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth" search={{ mode: "login" }}>Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/auth" search={{ mode: "register" }}>Get started</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 lg:pt-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Shared expenses, simplified</p>
        <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Who owes what, always up to date.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          ShareBucks keeps track of every shared expense so your group can stop doing math in the group chat.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "register" }}>
              Create a free account <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth" search={{ mode: "login" }}>Try the demo</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border bg-card p-6 shadow-xs">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="size-5" />
            </span>
            <h2 className="font-display mt-4 text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
