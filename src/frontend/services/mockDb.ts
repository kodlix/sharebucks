// In-memory mock database persisted to localStorage. This stands in for the
// FastAPI + SQLite backend until it exists. Nothing outside services/ should
// import this file.

import type {
  Category,
  Expense,
  ExpenseShare,
  Group,
  GroupInvite,
  GroupMember,
  Settlement,
  User,
} from "../types";
import { splitEqually } from "../lib/money";

export interface StoredUser extends User {
  password_hash: string;
}

export interface DB {
  users: StoredUser[];
  groups: Group[];
  members: GroupMember[];
  invites: GroupInvite[];
  categories: Category[];
  expenses: Omit<Expense, "shares" | "payer" | "category">[];
  shares: ExpenseShare[];
  settlements: Omit<Settlement, "payer" | "recipient">[];
  session_user_id: string | null;
}

const STORAGE_KEY = "sharebucks.mockdb.v1";
export const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Accommodation",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Travel",
  "Other",
];

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Mock-only "hash". The real backend must use bcrypt/argon2.
export function hashPassword(pw: string): string {
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = (h * 31 + pw.charCodeAt(i)) | 0;
  return `mock$${h.toString(16)}$${pw.length}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function seed(): DB {
  const ts = nowIso();
  const mkUser = (id: string, email: string, name: string): StoredUser => ({
    id,
    email,
    display_name: name,
    password_hash: hashPassword("password123"),
    created_at: ts,
  });
  const users = [
    mkUser("u_demo", "demo@sharebucks.app", "Alex Demo"),
    mkUser("u_maya", "maya@example.com", "Maya Okafor"),
    mkUser("u_liam", "liam@example.com", "Liam Chen"),
    mkUser("u_sofia", "sofia@example.com", "Sofia Rossi"),
    mkUser("u_noah", "noah@example.com", "Noah Patel"),
  ];

  const groups: Group[] = [
    {
      id: "g_lisbon",
      name: "Lisbon Trip",
      description: "Long weekend in Lisbon — flights, food and fado.",
      visibility: "private",
      currency: "EUR",
      created_by: "u_demo",
      is_archived: false,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: "g_flat",
      name: "Flat 4B",
      description: "Shared apartment bills and groceries.",
      visibility: "private",
      currency: "USD",
      created_by: "u_maya",
      is_archived: false,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: "g_run",
      name: "Sunday Run Club",
      description: "Post-run brunches and race entry fees. Everyone welcome!",
      visibility: "public",
      currency: "USD",
      created_by: "u_liam",
      is_archived: false,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: "g_board",
      name: "Board Game Nights",
      description: "Snacks, pizza and the occasional new game.",
      visibility: "public",
      currency: "GBP",
      created_by: "u_sofia",
      is_archived: false,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: "g_ski",
      name: "Ski Week 2025",
      description: "Chalet, lift passes and après.",
      visibility: "private",
      currency: "EUR",
      created_by: "u_demo",
      is_archived: true,
      created_at: ts,
      updated_at: ts,
    },
  ];

  const members: GroupMember[] = [];
  const addMember = (gid: string, uidv: string, role: "admin" | "member") =>
    members.push({
      id: uid("m"),
      group_id: gid,
      user_id: uidv,
      role,
      status: "active",
      joined_at: ts,
      left_at: null,
      user: users.find((u) => u.id === uidv)!,
    });
  addMember("g_lisbon", "u_demo", "admin");
  addMember("g_lisbon", "u_maya", "member");
  addMember("g_lisbon", "u_liam", "member");
  addMember("g_lisbon", "u_sofia", "member");
  addMember("g_flat", "u_maya", "admin");
  addMember("g_flat", "u_demo", "member");
  addMember("g_flat", "u_noah", "member");
  addMember("g_run", "u_liam", "admin");
  addMember("g_run", "u_noah", "member");
  addMember("g_board", "u_sofia", "admin");
  addMember("g_board", "u_maya", "member");
  addMember("g_board", "u_liam", "member");
  addMember("g_ski", "u_demo", "admin");
  addMember("g_ski", "u_noah", "member");

  const categories: Category[] = [];
  for (const g of groups) {
    for (const name of DEFAULT_CATEGORIES) {
      categories.push({ id: `c_${g.id}_${name.toLowerCase()}`, group_id: g.id, name, is_default: true, created_at: ts });
    }
  }

  const expenses: DB["expenses"] = [];
  const shares: ExpenseShare[] = [];
  const addExpense = (
    gid: string,
    payer: string,
    title: string,
    amount: number,
    cat: string,
    date: string,
    participants: string[],
    custom?: number[],
  ) => {
    const id = uid("e");
    expenses.push({
      id,
      group_id: gid,
      created_by: payer,
      payer_id: payer,
      category_id: `c_${gid}_${cat}`,
      title,
      amount,
      expense_date: date,
      notes: "",
      created_at: ts,
      updated_at: ts,
    });
    const amounts = custom ?? splitEqually(amount, participants.length);
    participants.forEach((p, i) => shares.push({ id: uid("s"), expense_id: id, user_id: p, amount: amounts[i] }));
  };
  const lisbon = ["u_demo", "u_maya", "u_liam", "u_sofia"];
  addExpense("g_lisbon", "u_demo", "Airbnb — 3 nights", 48000, "accommodation", daysAgo(12), lisbon);
  addExpense("g_lisbon", "u_maya", "Dinner at Cervejaria Ramiro", 13640, "food", daysAgo(10), lisbon);
  addExpense("g_lisbon", "u_liam", "Tram 28 tickets", 2400, "transport", daysAgo(10), lisbon);
  addExpense("g_lisbon", "u_sofia", "Pastéis de Belém", 1850, "food", daysAgo(9), lisbon);
  addExpense("g_lisbon", "u_demo", "Fado night", 9000, "entertainment", daysAgo(9), ["u_demo", "u_maya", "u_sofia"]);
  addExpense("g_lisbon", "u_maya", "Sintra day trip car", 7500, "travel", daysAgo(8), lisbon, [2500, 2500, 1500, 1000]);

  const flat = ["u_maya", "u_demo", "u_noah"];
  addExpense("g_flat", "u_maya", "Electricity — August", 14230, "utilities", daysAgo(20), flat);
  addExpense("g_flat", "u_demo", "Groceries run", 8675, "food", daysAgo(6), flat);
  addExpense("g_flat", "u_noah", "Internet", 6999, "utilities", daysAgo(4), flat);
  addExpense("g_flat", "u_demo", "Cleaning supplies", 3240, "shopping", daysAgo(2), flat);
  addExpense("g_flat", "u_maya", "Water bill", 4510, "utilities", daysAgo(40), flat);

  addExpense("g_run", "u_liam", "Brunch at Daily Grind", 5400, "food", daysAgo(3), ["u_liam", "u_noah"]);
  addExpense("g_board", "u_sofia", "Pizza night", 3600, "food", daysAgo(5), ["u_sofia", "u_maya", "u_liam"]);
  addExpense("g_ski", "u_demo", "Chalet deposit", 60000, "accommodation", daysAgo(200), ["u_demo", "u_noah"]);
  addExpense("g_ski", "u_noah", "Lift passes", 42000, "entertainment", daysAgo(198), ["u_demo", "u_noah"]);

  const settlements: DB["settlements"] = [
    {
      id: uid("st"),
      group_id: "g_lisbon",
      payer_id: "u_sofia",
      recipient_id: "u_demo",
      amount: 5000,
      settlement_date: daysAgo(5),
      note: "Part of the Airbnb",
      created_at: ts,
    },
    {
      id: uid("st"),
      group_id: "g_flat",
      payer_id: "u_demo",
      recipient_id: "u_maya",
      amount: 3000,
      settlement_date: daysAgo(15),
      note: "",
      created_at: ts,
    },
    {
      id: uid("st"),
      group_id: "g_ski",
      payer_id: "u_demo",
      recipient_id: "u_noah",
      amount: 9000,
      settlement_date: daysAgo(190),
      note: "All squared up",
      created_at: ts,
    },
  ];

  const invites: GroupInvite[] = [
    {
      id: uid("i"),
      group_id: "g_lisbon",
      created_by: "u_demo",
      code: "LISBON24",
      expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
      created_at: ts,
    },
    {
      id: uid("i"),
      group_id: "g_flat",
      created_by: "u_maya",
      code: "FLAT4B",
      expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
      created_at: ts,
    },
  ];

  return { users, groups, members, invites, categories, expenses, shares, settlements, session_user_id: null };
}

let db: DB | null = null;

export function getDb(): DB {
  if (db) return db;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        db = JSON.parse(raw) as DB;
        return db;
      }
    } catch {
      /* fall through to seed */
    }
  }
  db = seed();
  persist();
  return db;
}

export function persist(): void {
  if (!db || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* ignore quota errors in mock */
  }
}

export function resetDb(): void {
  db = seed();
  persist();
}
