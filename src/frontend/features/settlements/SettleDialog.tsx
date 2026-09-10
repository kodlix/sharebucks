import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayIso } from "@/frontend/components/Money";
import { formatMoney, parseMoney, toDecimalString } from "@/frontend/lib/money";
import { useCreateSettlement } from "@/frontend/services/queries";
import type { MemberBalance } from "@/frontend/types";

export function SettleDialog({
  trigger,
  groupId,
  currency,
  balances,
  defaultPayer,
  defaultRecipient,
  defaultAmount,
}: {
  trigger: ReactNode;
  groupId: string;
  currency: string;
  balances: MemberBalance[];
  defaultPayer?: string;
  defaultRecipient?: string;
  defaultAmount?: number;
}) {
  const [open, setOpen] = useState(false);
  const debtors = balances.filter((b) => b.net < 0);
  const creditors = balances.filter((b) => b.net > 0);
  const [payer, setPayer] = useState(defaultPayer ?? debtors[0]?.user_id ?? "");
  const [recipient, setRecipient] = useState(defaultRecipient ?? creditors[0]?.user_id ?? "");
  const [amountStr, setAmountStr] = useState(defaultAmount ? toDecimalString(defaultAmount, currency) : "");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const create = useCreateSettlement(groupId);

  useEffect(() => {
    if (open) {
      setPayer(defaultPayer ?? debtors[0]?.user_id ?? "");
      setRecipient(defaultRecipient ?? creditors[0]?.user_id ?? "");
      setAmountStr(defaultAmount ? toDecimalString(defaultAmount, currency) : "");
      setDate(todayIso());
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const payerNet = balances.find((b) => b.user_id === payer)?.net ?? 0;
  const recipientNet = balances.find((b) => b.user_id === recipient)?.net ?? 0;
  const max = Math.max(0, Math.min(-payerNet, recipientNet));
  const amount = parseMoney(amountStr, currency);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (amount == null) return;
            create.mutate(
              { payer_id: payer, recipient_id: recipient, amount, settlement_date: date, note },
              { onSuccess: () => setOpen(false) },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Record a settlement</DialogTitle>
            <DialogDescription>This tracks a payment made outside the app. Partial payments are fine.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Payer (owes)</Label>
                <Select value={payer} onValueChange={setPayer}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {debtors.map((b) => (
                      <SelectItem key={b.user_id} value={b.user_id}>{b.user.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Recipient (is owed)</Label>
                <Select value={recipient} onValueChange={setRecipient}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {creditors.map((b) => (
                      <SelectItem key={b.user_id} value={b.user_id}>{b.user.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-amount">Amount ({currency})</Label>
                <Input id="s-amount" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="0.00" />
                <p className="text-xs text-muted-foreground">
                  Max {formatMoney(max, currency)}{" "}
                  {max > 0 && (
                    <button type="button" className="text-primary underline" onClick={() => setAmountStr(toDecimalString(max, currency))}>
                      settle in full
                    </button>
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-date">Date</Label>
                <Input id="s-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-note">Note (optional)</Label>
              <Input id="s-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bank transfer" />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || !payer || !recipient || amount == null || amount <= 0 || amount > max}>
              {create.isPending ? "Recording…" : "Record settlement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
