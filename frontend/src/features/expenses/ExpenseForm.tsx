import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, todayIso } from "@/components/Money";
import { formatMoney, parseMoney, splitEqually, toDecimalString } from "@/lib/money";
import { useCreateCategory } from "@/services/queries";
import type { Expense, ExpenseInput, GroupDetail } from "@/frontend/types";

type SplitMode = "equal" | "custom";

export function ExpenseForm({
  group,
  currentUserId,
  initial,
  onSubmit,
  pending,
  submitLabel,
}: {
  group: GroupDetail;
  currentUserId: string;
  initial?: Expense | undefined;
  onSubmit: (input: ExpenseInput) => void;
  pending: boolean;
  submitLabel: string;
}) {
  const active = group.members.filter((m) => m.status === "active");
  const currency = group.currency;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [amountStr, setAmountStr] = useState(initial ? toDecimalString(initial.amount, currency) : "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? group.categories[0]?.id ?? "");
  const [payerId, setPayerId] = useState(initial?.payer_id ?? currentUserId);
  const [date, setDate] = useState(initial?.expense_date ?? todayIso());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [participants, setParticipants] = useState<string[]>(
    initial ? initial.shares.map((s) => s.user_id) : active.map((m) => m.user_id),
  );
  const initialIsEqual = useMemo(() => {
    if (!initial) return true;
    const eq = splitEqually(initial.amount, initial.shares.length);
    return initial.shares.every((s, i) => s.amount === eq[i]);
  }, [initial]);
  const [mode, setMode] = useState<SplitMode>(initialIsEqual ? "equal" : "custom");
  const [customStr, setCustomStr] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    initial?.shares.forEach((s) => (m[s.user_id] = toDecimalString(s.amount, currency)));
    return m;
  });
  const [newCat, setNewCat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createCategory = useCreateCategory(group.id);

  const amount = parseMoney(amountStr, currency);
  const equalShares = amount != null ? splitEqually(amount, participants.length) : [];
  const customTotal = participants.reduce((a, id) => a + (parseMoney(customStr[id] ?? "", currency) ?? 0), 0);
  const remaining = (amount ?? 0) - customTotal;

  function toggleParticipant(id: string, on: boolean) {
    setParticipants((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Add a title.");
    if (amount == null || amount <= 0) return setError("Enter a valid amount greater than zero.");
    if (participants.length === 0) return setError("Pick at least one participant.");
    let shares: ExpenseInput["shares"];
    if (mode === "equal") {
      shares = participants.map((id, i) => ({ user_id: id, amount: equalShares[i] ?? 0 }));
    } else {
      shares = participants.map((id) => ({ user_id: id, amount: parseMoney(customStr[id] ?? "", currency) ?? -1 }));
      if (shares.some((s) => s.amount < 0)) return setError("Enter a valid amount for every participant.");
      if (remaining !== 0)
        return setError(
          `Shares must add up to ${formatMoney(amount, currency)} (${remaining > 0 ? "missing" : "over by"} ${formatMoney(Math.abs(remaining), currency)}).`,
        );
    }
    onSubmit({ title, amount, category_id: categoryId, payer_id: payerId, expense_date: date, notes, shares });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5 rounded-xl border bg-card p-6 shadow-xs">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner at Ramiro" autoFocus />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount ({currency})</Label>
            <Input
              id="amount"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="text-lg font-semibold tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Paid by</Label>
            <Select value={payerId} onValueChange={setPayerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {active.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.user.display_name}
                    {m.user_id === currentUserId ? " (you)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {group.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 pt-1">
              <Input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="New category…"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!newCat.trim() || createCategory.isPending}
                onClick={() =>
                  createCategory.mutate(newCat, {
                    onSuccess: (c) => {
                      setCategoryId(c.id);
                      setNewCat("");
                    },
                  })
                }
              >
                <Plus /> Add
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>

      <div className="flex flex-col rounded-xl border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold">Split</h3>
          <Tabs value={mode} onValueChange={(v) => setMode(v as SplitMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="equal" className="text-xs">
                Equal
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-xs">
                Custom
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ul className="mt-4 flex-1 space-y-2">
          {active.map((m) => {
            const idx = participants.indexOf(m.user_id);
            const on = idx >= 0;
            return (
              <li key={m.user_id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <Checkbox
                  id={`p-${m.user_id}`}
                  checked={on}
                  onCheckedChange={(c) => toggleParticipant(m.user_id, c === true)}
                />
                <Avatar name={m.user.display_name} size="sm" />
                <label htmlFor={`p-${m.user_id}`} className="min-w-0 flex-1 truncate text-sm">
                  {m.user.display_name}
                  {m.user_id === currentUserId && <span className="text-muted-foreground"> (you)</span>}
                </label>
                {on &&
                  (mode === "equal" ? (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {amount != null ? formatMoney(equalShares[idx] ?? 0, currency) : "—"}
                    </span>
                  ) : (
                    <Input
                      inputMode="decimal"
                      value={customStr[m.user_id] ?? ""}
                      onChange={(e) => setCustomStr((s) => ({ ...s, [m.user_id]: e.target.value }))}
                      placeholder="0.00"
                      className="h-8 w-24 text-right tabular-nums"
                      aria-label={`Share for ${m.user.display_name}`}
                    />
                  ))}
              </li>
            );
          })}
        </ul>
        {mode === "custom" && amount != null && (
          <p className={`mt-3 text-xs tabular-nums ${remaining === 0 ? "text-positive" : "text-negative"}`}>
            {remaining === 0
              ? "Shares match the total."
              : remaining > 0
                ? `${formatMoney(remaining, currency)} left to assign`
                : `${formatMoney(-remaining, currency)} over the total`}
          </p>
        )}
        {mode === "custom" && amount != null && remaining !== 0 && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto self-start p-0 text-xs"
            onClick={() => {
              const eq = splitEqually(amount, participants.length);
              const next: Record<string, string> = {};
              participants.forEach((id, i) => (next[id] = toDecimalString(eq[i] ?? 0, currency)));
              setCustomStr(next);
            }}
          >
            Fill equally
          </Button>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="mt-5 w-full" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
