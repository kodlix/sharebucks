// ============================================================================
// ShareBucks API service layer (MOCK)
//
// This is the ONLY module the UI talks to for data. Every method mirrors a
// REST endpoint from the specification (see comments). Replace the bodies
// with `fetch` calls against FastAPI later without touching any component.
// ============================================================================

import type {
  Category,
  CreateGroupInput,
  DashboardData,
  DiscoverGroup,
  Expense,
  ExpenseInput,
  GroupDetail,
  GroupInvite,
  GroupMember,
  GroupSummary,
  LoginInput,
  MemberBalance,
  RegisterInput,
  Settlement,
  SettlementInput,
  SettlementSuggestion,
  UpdateGroupInput,
  User,
} from "../types";
import { computeBalances, suggestSettlements } from "../lib/balances";
import { splitEqually } from "../lib/money";
import { DEFAULT_CATEGORIES, getDb, hashPassword, nowIso, persist, resetDb, uid, type DB } from "./mockDb";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

const LATENCY_MS = 180;
const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));

// ---- internal helpers -------------------------------------------------------

function publicUser(u: DB["users"][number]): User {
  const { password_hash: _ph, ...rest } = u;
  return rest;
}

function requireUser(db: DB): User {
  const u = db.users.find((x) => x.id === db.session_user_id);
  if (!u) throw new ApiError(401, "You need to sign in.");
  return publicUser(u);
}

function findGroup(db: DB, groupId: string) {
  const g = db.groups.find((x) => x.id === groupId);
  if (!g) throw new ApiError(404, "Group not found.");
  return g;
}

function activeMembership(db: DB, groupId: string, userId: string) {
  return db.members.find((m) => m.group_id === groupId && m.user_id === userId && m.status === "active");
}

function requireMembership(db: DB, groupId: string, userId: string) {
  const m = activeMembership(db, groupId, userId);
  if (!m) throw new ApiError(403, "You are not an active member of this group.");
  return m;
}

function activeMembers(db: DB, groupId: string) {
  return db.members.filter((m) => m.group_id === groupId && m.status === "active");
}

function hydrateMember(db: DB, m: GroupMember): GroupMember {
  return { ...m, user: publicUser(db.users.find((u) => u.id === m.user_id)!) };
}

function hydrateExpense(db: DB, e: DB["expenses"][number]): Expense {
  return {
    ...e,
    shares: db.shares.filter((s) => s.expense_id === e.id),
    payer: publicUser(db.users.find((u) => u.id === e.payer_id)!),
    category: db.categories.find((c) => c.id === e.category_id)!,
  };
}

function hydrateSettlement(db: DB, s: DB["settlements"][number]): Settlement {
  return {
    ...s,
    payer: publicUser(db.users.find((u) => u.id === s.payer_id)!),
    recipient: publicUser(db.users.find((u) => u.id === s.recipient_id)!),
  };
}

function groupLedger(db: DB, groupId: string) {
  const expenses = db.expenses
    .filter((e) => e.group_id === groupId)
    .map((e) => ({ payer_id: e.payer_id, amount: e.amount, shares: db.shares.filter((s) => s.expense_id === e.id) }));
  const settlements = db.settlements.filter((s) => s.group_id === groupId);
  const memberIds = db.members.filter((m) => m.group_id === groupId).map((m) => m.user_id);
  return computeBalances(memberIds, expenses, settlements);
}

function groupBalances(db: DB, groupId: string): MemberBalance[] {
  const ledger = groupLedger(db, groupId);
  const members = db.members.filter((m) => m.group_id === groupId);
  return members
    .map((m) => {
      const b = ledger.get(m.user_id) ?? { paid: 0, owed: 0, net: 0 };
      return { user_id: m.user_id, user: publicUser(db.users.find((u) => u.id === m.user_id)!), status: m.status, ...b };
    })
    .filter((b) => b.status === "active" || b.net !== 0)
    .sort((a, b) => b.net - a.net);
}

function groupSuggestions(db: DB, groupId: string): SettlementSuggestion[] {
  const ledger = groupLedger(db, groupId);
  return suggestSettlements(ledger).map((s) => ({
    ...s,
    payer: publicUser(db.users.find((u) => u.id === s.payer_id)!),
    recipient: publicUser(db.users.find((u) => u.id === s.recipient_id)!),
  }));
}

function toSummary(db: DB, g: DB["groups"][number], userId: string): GroupSummary {
  const membership = db.members.find((m) => m.group_id === g.id && m.user_id === userId)!;
  const ledger = groupLedger(db, g.id);
  return {
    ...g,
    role: membership.role,
    member_count: activeMembers(db, g.id).length,
    my_balance: ledger.get(userId)?.net ?? 0,
    total_spent: db.expenses.filter((e) => e.group_id === g.id).reduce((a, e) => a + e.amount, 0),
  };
}

function toDetail(db: DB, g: DB["groups"][number], userId: string): GroupDetail {
  const membership = db.members.find((m) => m.group_id === g.id && m.user_id === userId)!;
  return {
    ...g,
    role: membership.role,
    members: db.members
      .filter((m) => m.group_id === g.id)
      .map((m) => hydrateMember(db, m))
      .sort((a, b) => (a.status === b.status ? (a.role === "admin" ? -1 : 1) : a.status === "active" ? -1 : 1)),
    categories: db.categories.filter((c) => c.group_id === g.id),
  };
}

function validateExpenseInput(db: DB, groupId: string, input: ExpenseInput) {
  if (!input.title.trim()) throw new ApiError(422, "Title is required.");
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new ApiError(422, "Amount must be greater than zero.");
  if (!input.expense_date) throw new ApiError(422, "Date is required.");
  if (!db.categories.some((c) => c.id === input.category_id && c.group_id === groupId))
    throw new ApiError(422, "Invalid category.");
  if (!activeMembership(db, groupId, input.payer_id)) throw new ApiError(422, "The payer must be an active member.");
  if (input.shares.length === 0) throw new ApiError(422, "At least one participant is required.");
  for (const s of input.shares) {
    if (!activeMembership(db, groupId, s.user_id)) throw new ApiError(422, "All participants must be active members.");
    if (!Number.isInteger(s.amount) || s.amount < 0) throw new ApiError(422, "Share amounts must be valid.");
  }
  const total = input.shares.reduce((a, s) => a + s.amount, 0);
  if (total !== input.amount) throw new ApiError(422, "Share totals must exactly equal the expense amount.");
  const ids = new Set(input.shares.map((s) => s.user_id));
  if (ids.size !== input.shares.length) throw new ApiError(422, "Duplicate participant.");
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

// ---- public API -------------------------------------------------------------

export const api = {
  auth: {
    /** POST /api/auth/register */
    async register(input: RegisterInput): Promise<User> {
      await delay();
      const db = getDb();
      const email = input.email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(422, "Enter a valid email address.");
      if (input.password.length < 8) throw new ApiError(422, "Password must be at least 8 characters.");
      if (!input.display_name.trim()) throw new ApiError(422, "Display name is required.");
      if (db.users.some((u) => u.email === email)) throw new ApiError(409, "An account with this email already exists.");
      const user = {
        id: uid("u"),
        email,
        display_name: input.display_name.trim(),
        password_hash: hashPassword(input.password),
        created_at: nowIso(),
      };
      db.users.push(user);
      db.session_user_id = user.id;
      persist();
      return publicUser(user);
    },
    /** POST /api/auth/login */
    async login(input: LoginInput): Promise<User> {
      await delay();
      const db = getDb();
      const email = input.email.trim().toLowerCase();
      const user = db.users.find((u) => u.email === email);
      if (!user || user.password_hash !== hashPassword(input.password))
        throw new ApiError(401, "Incorrect email or password.");
      db.session_user_id = user.id;
      persist();
      return publicUser(user);
    },
    /** POST /api/auth/logout */
    async logout(): Promise<void> {
      await delay();
      const db = getDb();
      db.session_user_id = null;
      persist();
    },
    /** GET /api/auth/me — resolves null instead of throwing 401 for convenience */
    async me(): Promise<User | null> {
      const db = getDb();
      const u = db.users.find((x) => x.id === db.session_user_id);
      return u ? publicUser(u) : null;
    },
    /** PATCH /api/auth/me (profile update) */
    async updateProfile(input: { display_name: string }): Promise<User> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      if (!input.display_name.trim()) throw new ApiError(422, "Display name is required.");
      const stored = db.users.find((u) => u.id === me.id)!;
      stored.display_name = input.display_name.trim();
      db.members.forEach((m) => {
        if (m.user_id === me.id) m.user = publicUser(stored);
      });
      persist();
      return publicUser(stored);
    },
  },

  groups: {
    /** GET /api/groups */
    async list(): Promise<GroupSummary[]> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const mine = db.members.filter((m) => m.user_id === me.id && m.status === "active").map((m) => m.group_id);
      return db.groups.filter((g) => mine.includes(g.id)).map((g) => toSummary(db, g, me.id));
    },
    /** POST /api/groups */
    async create(input: CreateGroupInput): Promise<GroupDetail> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      if (!input.name.trim()) throw new ApiError(422, "Group name is required.");
      if (!/^[A-Z]{3}$/.test(input.currency)) throw new ApiError(422, "Currency must be an ISO 4217 code.");
      const ts = nowIso();
      const group = {
        id: uid("g"),
        name: input.name.trim(),
        description: input.description.trim(),
        visibility: input.visibility,
        currency: input.currency,
        created_by: me.id,
        is_archived: false,
        created_at: ts,
        updated_at: ts,
      };
      db.groups.push(group);
      db.members.push({
        id: uid("m"),
        group_id: group.id,
        user_id: me.id,
        role: "admin",
        status: "active",
        joined_at: ts,
        left_at: null,
        user: me,
      });
      for (const name of DEFAULT_CATEGORIES) {
        db.categories.push({ id: uid("c"), group_id: group.id, name, is_default: true, created_at: ts });
      }
      persist();
      return toDetail(db, group, me.id);
    },
    /** GET /api/groups/{id} */
    async get(groupId: string): Promise<GroupDetail> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const g = findGroup(db, groupId);
      requireMembership(db, groupId, me.id);
      return toDetail(db, g, me.id);
    },
    /** PATCH /api/groups/{id} */
    async update(groupId: string, input: UpdateGroupInput): Promise<GroupDetail> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const g = findGroup(db, groupId);
      const m = requireMembership(db, groupId, me.id);
      if (m.role !== "admin") throw new ApiError(403, "Only the administrator can edit the group.");
      if (g.is_archived) throw new ApiError(409, "Archived groups cannot be edited.");
      if (input.name !== undefined) {
        if (!input.name.trim()) throw new ApiError(422, "Group name is required.");
        g.name = input.name.trim();
      }
      if (input.description !== undefined) g.description = input.description.trim();
      if (input.visibility !== undefined) g.visibility = input.visibility;
      if (input.currency !== undefined) {
        if (!/^[A-Z]{3}$/.test(input.currency)) throw new ApiError(422, "Currency must be an ISO 4217 code.");
        g.currency = input.currency;
      }
      g.updated_at = nowIso();
      persist();
      return toDetail(db, g, me.id);
    },
    /** POST /api/groups/{id}/archive */
    async archive(groupId: string): Promise<GroupDetail> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const g = findGroup(db, groupId);
      const m = requireMembership(db, groupId, me.id);
      if (m.role !== "admin") throw new ApiError(403, "Only the administrator can archive the group.");
      g.is_archived = true;
      g.updated_at = nowIso();
      persist();
      return toDetail(db, g, me.id);
    },
    /** POST /api/groups/{id}/leave */
    async leave(groupId: string): Promise<void> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      findGroup(db, groupId);
      const m = requireMembership(db, groupId, me.id);
      if (m.role === "admin") throw new ApiError(409, "Administrators cannot leave their group. Archive it instead.");
      const net = groupLedger(db, groupId).get(me.id)?.net ?? 0;
      if (net !== 0) throw new ApiError(409, "Settle your balance before leaving the group.");
      m.status = "inactive";
      m.left_at = nowIso();
      persist();
    },
    /** GET /api/groups/{id}/members */
    async members(groupId: string): Promise<GroupMember[]> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      requireMembership(db, groupId, me.id);
      return db.members.filter((m) => m.group_id === groupId).map((m) => hydrateMember(db, m));
    },
    /** DELETE /api/groups/{id}/members/{user_id} */
    async removeMember(groupId: string, userId: string): Promise<void> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const m = requireMembership(db, groupId, me.id);
      if (m.role !== "admin") throw new ApiError(403, "Only the administrator can remove members.");
      if (userId === me.id) throw new ApiError(409, "You cannot remove yourself.");
      const target = activeMembership(db, groupId, userId);
      if (!target) throw new ApiError(404, "Member not found.");
      target.status = "inactive";
      target.left_at = nowIso();
      persist();
    },
    /** POST /api/groups/{id}/invites */
    async createInvite(groupId: string): Promise<GroupInvite> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const g = findGroup(db, groupId);
      requireMembership(db, groupId, me.id);
      if (g.is_archived) throw new ApiError(409, "Archived groups accept no new members.");
      const invite: GroupInvite = {
        id: uid("i"),
        group_id: groupId,
        created_by: me.id,
        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
        created_at: nowIso(),
      };
      db.invites.push(invite);
      persist();
      return invite;
    },
    /** POST /api/groups/{id}/join  (public group, or private with invite code) */
    async join(groupId: string | null, code?: string): Promise<GroupDetail> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      let gid = groupId;
      if (code) {
        const invite = db.invites.find((i) => i.code.toUpperCase() === code.trim().toUpperCase());
        if (!invite) throw new ApiError(404, "Invalid invitation code.");
        if (new Date(invite.expires_at).getTime() < Date.now()) throw new ApiError(410, "This invitation has expired.");
        gid = invite.group_id;
      }
      if (!gid) throw new ApiError(400, "Group or invitation code required.");
      const g = findGroup(db, gid);
      if (g.is_archived) throw new ApiError(409, "This group is archived and accepts no new members.");
      if (g.visibility === "private" && !code) throw new ApiError(403, "This group is private. Use an invitation code.");
      if (activeMembership(db, gid, me.id)) throw new ApiError(409, "You are already a member.");
      const prior = db.members.find((m) => m.group_id === gid && m.user_id === me.id);
      if (prior) {
        prior.status = "active";
        prior.left_at = null;
        prior.joined_at = nowIso();
      } else {
        db.members.push({
          id: uid("m"),
          group_id: gid,
          user_id: me.id,
          role: "member",
          status: "active",
          joined_at: nowIso(),
          left_at: null,
          user: me,
        });
      }
      persist();
      return toDetail(db, g, me.id);
    },
    /** GET /api/groups/discover?search= */
    async discover(search = ""): Promise<DiscoverGroup[]> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const q = search.trim().toLowerCase();
      return db.groups
        .filter((g) => g.visibility === "public" && !g.is_archived)
        .filter((g) => !q || g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q))
        .map((g) => ({
          ...g,
          member_count: activeMembers(db, g.id).length,
          is_member: !!activeMembership(db, g.id, me.id),
        }));
    },
    /** POST /api/groups/{id}/categories (custom category) */
    async createCategory(groupId: string, name: string): Promise<Category> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      requireMembership(db, groupId, me.id);
      const trimmed = name.trim();
      if (!trimmed) throw new ApiError(422, "Category name is required.");
      if (db.categories.some((c) => c.group_id === groupId && c.name.toLowerCase() === trimmed.toLowerCase()))
        throw new ApiError(409, "That category already exists.");
      const c: Category = { id: uid("c"), group_id: groupId, name: trimmed, is_default: false, created_at: nowIso() };
      db.categories.push(c);
      persist();
      return c;
    },
  },

  expenses: {
    /** GET /api/groups/{id}/expenses */
    async list(groupId: string): Promise<Expense[]> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      requireMembership(db, groupId, me.id);
      return db.expenses
        .filter((e) => e.group_id === groupId)
        .map((e) => hydrateExpense(db, e))
        .sort((a, b) => (a.expense_date < b.expense_date ? 1 : a.expense_date > b.expense_date ? -1 : b.created_at.localeCompare(a.created_at)));
    },
    /** GET /api/groups/{id}/expenses/{expense_id} */
    async get(groupId: string, expenseId: string): Promise<Expense> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      requireMembership(db, groupId, me.id);
      const e = db.expenses.find((x) => x.id === expenseId && x.group_id === groupId);
      if (!e) throw new ApiError(404, "Expense not found.");
      return hydrateExpense(db, e);
    },
    /** POST /api/groups/{id}/expenses */
    async create(groupId: string, input: ExpenseInput): Promise<Expense> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const g = findGroup(db, groupId);
      requireMembership(db, groupId, me.id);
      if (g.is_archived) throw new ApiError(409, "Archived groups accept no new expenses.");
      validateExpenseInput(db, groupId, input);
      const ts = nowIso();
      const e = {
        id: uid("e"),
        group_id: groupId,
        created_by: me.id,
        payer_id: input.payer_id,
        category_id: input.category_id,
        title: input.title.trim(),
        amount: input.amount,
        expense_date: input.expense_date,
        notes: input.notes.trim(),
        created_at: ts,
        updated_at: ts,
      };
      db.expenses.push(e);
      for (const s of input.shares) db.shares.push({ id: uid("s"), expense_id: e.id, user_id: s.user_id, amount: s.amount });
      persist();
      return hydrateExpense(db, e);
    },
    /** PATCH /api/groups/{id}/expenses/{expense_id} */
    async update(groupId: string, expenseId: string, input: ExpenseInput): Promise<Expense> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const g = findGroup(db, groupId);
      requireMembership(db, groupId, me.id);
      const e = db.expenses.find((x) => x.id === expenseId && x.group_id === groupId);
      if (!e) throw new ApiError(404, "Expense not found.");
      if (e.created_by !== me.id) throw new ApiError(403, "Only the creator can edit this expense.");
      if (g.is_archived) throw new ApiError(409, "Archived groups cannot be changed.");
      validateExpenseInput(db, groupId, input);
      Object.assign(e, {
        payer_id: input.payer_id,
        category_id: input.category_id,
        title: input.title.trim(),
        amount: input.amount,
        expense_date: input.expense_date,
        notes: input.notes.trim(),
        updated_at: nowIso(),
      });
      db.shares = db.shares.filter((s) => s.expense_id !== e.id);
      for (const s of input.shares) db.shares.push({ id: uid("s"), expense_id: e.id, user_id: s.user_id, amount: s.amount });
      persist();
      return hydrateExpense(db, e);
    },
    /** DELETE /api/groups/{id}/expenses/{expense_id} */
    async remove(groupId: string, expenseId: string): Promise<void> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const g = findGroup(db, groupId);
      requireMembership(db, groupId, me.id);
      const e = db.expenses.find((x) => x.id === expenseId && x.group_id === groupId);
      if (!e) throw new ApiError(404, "Expense not found.");
      if (e.created_by !== me.id) throw new ApiError(403, "Only the creator can delete this expense.");
      if (g.is_archived) throw new ApiError(409, "Archived groups cannot be changed.");
      db.expenses = db.expenses.filter((x) => x.id !== expenseId);
      db.shares = db.shares.filter((s) => s.expense_id !== expenseId);
      persist();
    },
    /** Helper for forms: equal split preview */
    splitEqually,
  },

  balances: {
    /** GET /api/groups/{id}/balances */
    async get(groupId: string): Promise<MemberBalance[]> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      requireMembership(db, groupId, me.id);
      return groupBalances(db, groupId);
    },
  },

  settlements: {
    /** GET /api/groups/{id}/settlements/suggestions */
    async suggestions(groupId: string): Promise<SettlementSuggestion[]> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      requireMembership(db, groupId, me.id);
      return groupSuggestions(db, groupId);
    },
    /** GET /api/groups/{id}/settlements */
    async list(groupId: string): Promise<Settlement[]> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      requireMembership(db, groupId, me.id);
      return db.settlements
        .filter((s) => s.group_id === groupId)
        .map((s) => hydrateSettlement(db, s))
        .sort((a, b) => (a.settlement_date < b.settlement_date ? 1 : -1));
    },
    /** POST /api/groups/{id}/settlements */
    async create(groupId: string, input: SettlementInput): Promise<Settlement> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const g = findGroup(db, groupId);
      requireMembership(db, groupId, me.id);
      if (g.is_archived) throw new ApiError(409, "Archived groups cannot record settlements.");
      if (input.payer_id === input.recipient_id) throw new ApiError(422, "Payer and recipient must differ.");
      if (!Number.isInteger(input.amount) || input.amount <= 0) throw new ApiError(422, "Amount must be greater than zero.");
      if (!input.settlement_date) throw new ApiError(422, "Date is required.");
      const ledger = groupLedger(db, groupId);
      const payerNet = ledger.get(input.payer_id)?.net ?? 0;
      const recipientNet = ledger.get(input.recipient_id)?.net ?? 0;
      if (payerNet >= 0) throw new ApiError(422, "The payer does not owe anything in this group.");
      if (recipientNet <= 0) throw new ApiError(422, "The recipient is not owed anything in this group.");
      const maxAllowed = Math.min(-payerNet, recipientNet);
      if (input.amount > maxAllowed)
        throw new ApiError(422, "Settlement cannot exceed the outstanding debt between these members.");
      const s = {
        id: uid("st"),
        group_id: groupId,
        payer_id: input.payer_id,
        recipient_id: input.recipient_id,
        amount: input.amount,
        settlement_date: input.settlement_date,
        note: input.note.trim(),
        created_at: nowIso(),
      };
      db.settlements.push(s);
      persist();
      return hydrateSettlement(db, s);
    },
  },

  dashboard: {
    /** GET /api/dashboard */
    async get(): Promise<DashboardData> {
      await delay();
      const db = getDb();
      const me = requireUser(db);
      const memberships = db.members.filter((m) => m.user_id === me.id);
      const groupIds = memberships.map((m) => m.group_id);
      const groups = db.groups
        .filter((g) => groupIds.includes(g.id))
        .filter((g) => memberships.find((m) => m.group_id === g.id)!.status === "active" || !g.is_archived)
        .map((g) => toSummary(db, g, me.id));

      let owed = 0;
      let receivable = 0;
      let outstanding = 0;
      for (const g of groups) {
        if (g.my_balance < 0) owed += -g.my_balance;
        if (g.my_balance > 0) receivable += g.my_balance;
        outstanding += groupSuggestions(db, g.id).filter((s) => s.payer_id === me.id || s.recipient_id === me.id).length;
      }

      const groupById = new Map(db.groups.map((g) => [g.id, g]));
      const myExpenses = db.expenses.filter((e) => groupIds.includes(e.group_id));
      const recent_expenses = [...myExpenses]
        .sort((a, b) => (a.expense_date < b.expense_date ? 1 : -1))
        .slice(0, 8)
        .map((e) => ({ ...hydrateExpense(db, e), group: groupById.get(e.group_id)! }));
      const recent_settlements = db.settlements
        .filter((s) => groupIds.includes(s.group_id))
        .sort((a, b) => (a.settlement_date < b.settlement_date ? 1 : -1))
        .slice(0, 6)
        .map((s) => ({ ...hydrateSettlement(db, s), group: groupById.get(s.group_id)! }));

      // Spending = my share of expenses (what I consumed), across all groups.
      // Note: mixes currencies at face value for the mock; a real backend would group per currency.
      const myShares = db.shares.filter((s) => s.user_id === me.id);
      const expenseById = new Map(myExpenses.map((e) => [e.id, e]));
      const now = new Date();
      const thisMonth = now.toISOString().slice(0, 7);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonth = lastMonthDate.toISOString().slice(0, 7);
      const byCat = new Map<string, number>();
      const byMonth = new Map<string, number>();
      let total = 0;
      let tm = 0;
      let lm = 0;
      for (const s of myShares) {
        const e = expenseById.get(s.expense_id);
        if (!e) continue;
        total += s.amount;
        const mk = monthKey(e.expense_date);
        if (mk === thisMonth) tm += s.amount;
        if (mk === lastMonth) lm += s.amount;
        const cat = db.categories.find((c) => c.id === e.category_id)?.name ?? "Other";
        byCat.set(cat, (byCat.get(cat) ?? 0) + s.amount);
        byMonth.set(mk, (byMonth.get(mk) ?? 0) + s.amount);
      }
      const months: { month: string; amount: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const k = d.toISOString().slice(0, 7);
        months.push({ month: k, amount: byMonth.get(k) ?? 0 });
      }

      return {
        groups,
        totals: { owed, receivable, net: receivable - owed, outstanding_settlements: outstanding },
        recent_expenses,
        recent_settlements,
        spending: {
          total,
          this_month: tm,
          last_month: lm,
          by_category: [...byCat.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
          by_month: months,
        },
      };
    },
  },

  /** Dev helper: reset the mock database to seed data. */
  async resetMockData(): Promise<void> {
    await delay();
    resetDb();
  },
};

export type Api = typeof api;
