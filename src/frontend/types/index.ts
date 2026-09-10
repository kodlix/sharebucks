// Domain types mirroring the ShareBucks data model. All money values are
// integer minor units (e.g. cents) to keep calculations exact.

export type Visibility = "private" | "public";
export type MemberRole = "admin" | "member";
export type MemberStatus = "active" | "inactive";

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  visibility: Visibility;
  currency: string;
  created_by: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  left_at: string | null;
  user: User;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  created_by: string;
  code: string;
  expires_at: string;
  created_at: string;
}

export interface Category {
  id: string;
  group_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface ExpenseShare {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
}

export interface Expense {
  id: string;
  group_id: string;
  created_by: string;
  payer_id: string;
  category_id: string;
  title: string;
  amount: number;
  expense_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
  shares: ExpenseShare[];
  payer: User;
  category: Category;
}

export interface Settlement {
  id: string;
  group_id: string;
  payer_id: string;
  recipient_id: string;
  amount: number;
  settlement_date: string;
  note: string;
  created_at: string;
  payer: User;
  recipient: User;
}

export interface MemberBalance {
  user_id: string;
  user: User;
  status: MemberStatus;
  paid: number;
  owed: number;
  net: number;
}

export interface SettlementSuggestion {
  payer_id: string;
  recipient_id: string;
  payer: User;
  recipient: User;
  amount: number;
}

export interface GroupSummary extends Group {
  role: MemberRole;
  member_count: number;
  my_balance: number;
  total_spent: number;
}

export interface GroupDetail extends Group {
  role: MemberRole;
  members: GroupMember[];
  categories: Category[];
}

export interface DiscoverGroup extends Group {
  member_count: number;
  is_member: boolean;
}

export interface DashboardData {
  groups: GroupSummary[];
  totals: {
    owed: number; // what I owe others (positive number)
    receivable: number; // what others owe me
    net: number;
    outstanding_settlements: number; // count of suggested transactions involving me
  };
  recent_expenses: (Expense & { group: Group })[];
  recent_settlements: (Settlement & { group: Group })[];
  spending: {
    total: number;
    this_month: number;
    last_month: number;
    by_category: { name: string; amount: number }[];
    by_month: { month: string; amount: number }[];
  };
}

// ---- Inputs ----

export interface RegisterInput {
  email: string;
  password: string;
  display_name: string;
}
export interface LoginInput {
  email: string;
  password: string;
}
export interface CreateGroupInput {
  name: string;
  description: string;
  visibility: Visibility;
  currency: string;
}
export type UpdateGroupInput = Partial<CreateGroupInput>;

export interface ShareInput {
  user_id: string;
  amount: number;
}
export interface ExpenseInput {
  title: string;
  amount: number;
  category_id: string;
  payer_id: string;
  expense_date: string;
  notes: string;
  shares: ShareInput[];
}
export interface SettlementInput {
  payer_id: string;
  recipient_id: string;
  amount: number;
  settlement_date: string;
  note: string;
}
