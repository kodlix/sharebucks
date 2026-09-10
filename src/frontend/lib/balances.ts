// Deterministic balance and settlement-suggestion math. Pure functions so
// they can be unit-tested and reused by a real backend later.

export interface LedgerExpense {
  payer_id: string;
  amount: number;
  shares: { user_id: string; amount: number }[];
}
export interface LedgerSettlement {
  payer_id: string;
  recipient_id: string;
  amount: number;
}

export interface RawBalance {
  paid: number;
  owed: number;
  net: number;
}

/**
 * payer balance += expense amount; member balance -= share
 * settlement payer += amount; recipient -= amount
 */
export function computeBalances(
  userIds: string[],
  expenses: LedgerExpense[],
  settlements: LedgerSettlement[],
): Map<string, RawBalance> {
  const map = new Map<string, RawBalance>();
  const ensure = (id: string) => {
    let b = map.get(id);
    if (!b) {
      b = { paid: 0, owed: 0, net: 0 };
      map.set(id, b);
    }
    return b;
  };
  userIds.forEach(ensure);

  for (const e of expenses) {
    ensure(e.payer_id).paid += e.amount;
    for (const s of e.shares) ensure(s.user_id).owed += s.amount;
  }
  for (const s of settlements) {
    ensure(s.payer_id).paid += s.amount;
    ensure(s.recipient_id).owed += s.amount;
  }
  for (const b of map.values()) b.net = b.paid - b.owed;
  return map;
}

/** Greedy debtor/creditor matching that minimizes transaction count in practice. */
export function suggestSettlements(
  balances: Map<string, RawBalance>,
): { payer_id: string; recipient_id: string; amount: number }[] {
  const debtors = [...balances.entries()]
    .filter(([, b]) => b.net < 0)
    .map(([id, b]) => ({ id, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = [...balances.entries()]
    .filter(([, b]) => b.net > 0)
    .map(([id, b]) => ({ id, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);

  const result: { payer_id: string; recipient_id: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.min(d.amount, c.amount);
    if (amount > 0) result.push({ payer_id: d.id, recipient_id: c.id, amount });
    d.amount -= amount;
    c.amount -= amount;
    if (d.amount === 0) i++;
    if (c.amount === 0) j++;
  }
  return result;
}
