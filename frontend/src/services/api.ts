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
import { splitEqually } from "../lib/money";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

const API_BASE = typeof import.meta !== "undefined" && import.meta.env && import.meta.env["VITE_API_BASE_URL"]
  ? import.meta.env["VITE_API_BASE_URL"]
  : "";

async function request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  const url = `${API_BASE}${path}`;
  const options: RequestInit = {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (response.status === 204) return null;

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message = data?.detail?.error?.message || data?.message || response.statusText || "Request failed.";
    throw new ApiError(response.status, message);
  }

  return data as T;
}

function get<T>(path: string): Promise<T | null> {
  return request<T>("GET", path);
}

function post<T>(path: string, body?: unknown): Promise<T | null> {
  return request<T>("POST", path, body);
}

function patch<T>(path: string, body?: unknown): Promise<T | null> {
  return request<T>("PATCH", path, body);
}

function del(path: string): Promise<void | null> {
  return request<void>("DELETE", path);
}

export const api = {
  auth: {
    async register(input: RegisterInput): Promise<User> {
      return (await post<User>("/api/auth/register", input)) as User;
    },
    async login(input: LoginInput): Promise<User> {
      return (await post<User>("/api/auth/login", input)) as User;
    },
    async logout(): Promise<void> {
      await post<void>("/api/auth/logout");
    },
    async me(): Promise<User | null> {
      return (await get<User>("/api/auth/me")) || null;
    },
    async updateProfile(input: { display_name: string }): Promise<User> {
      return (await patch<User>("/api/auth/me", input)) as User;
    },
  },

  groups: {
    async list(): Promise<GroupSummary[]> {
      return (await get<GroupSummary[]>("/api/groups")) || [];
    },
    async create(input: CreateGroupInput): Promise<GroupDetail> {
      return (await post<GroupDetail>("/api/groups", input)) as GroupDetail;
    },
    async get(groupId: string): Promise<GroupDetail> {
      return (await get<GroupDetail>(`/api/groups/${groupId}`)) as GroupDetail;
    },
    async update(groupId: string, input: UpdateGroupInput): Promise<GroupDetail> {
      return (await patch<GroupDetail>(`/api/groups/${groupId}`, input)) as GroupDetail;
    },
    async archive(groupId: string): Promise<GroupDetail> {
      return (await post<GroupDetail>(`/api/groups/${groupId}/archive`)) as GroupDetail;
    },
    async leave(groupId: string): Promise<void> {
      await post<void>(`/api/groups/${groupId}/leave`);
    },
    async members(groupId: string): Promise<GroupMember[]> {
      return (await get<GroupMember[]>(`/api/groups/${groupId}/members`)) || [];
    },
    async removeMember(groupId: string, userId: string): Promise<void> {
      await del(`/api/groups/${groupId}/members/${userId}`);
    },
    async createInvite(groupId: string): Promise<GroupInvite> {
      return (await post<GroupInvite>(`/api/groups/${groupId}/invites`)) as GroupInvite;
    },
    async join(groupId: string | null, code?: string): Promise<GroupDetail> {
      if (groupId) {
        return (await post<GroupDetail>(`/api/groups/${groupId}/join`, code ? { code } : undefined)) as GroupDetail;
      }
      return (await post<GroupDetail>(`/api/groups/join`, code ? { code } : undefined)) as GroupDetail;
    },
    async discover(search = ""): Promise<DiscoverGroup[]> {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      return (await get<DiscoverGroup[]>(`/api/groups/discover${qs}`)) || [];
    },
    async createCategory(groupId: string, name: string): Promise<Category> {
      return (await post<Category>(`/api/groups/${groupId}/categories`, { name })) as Category;
    },
  },

  expenses: {
    async list(groupId: string): Promise<Expense[]> {
      return (await get<Expense[]>(`/api/groups/${groupId}/expenses`)) || [];
    },
    async get(groupId: string, expenseId: string): Promise<Expense> {
      return (await get<Expense>(`/api/groups/${groupId}/expenses/${expenseId}`)) as Expense;
    },
    async create(groupId: string, input: ExpenseInput): Promise<Expense> {
      return (await post<Expense>(`/api/groups/${groupId}/expenses`, input)) as Expense;
    },
    async update(groupId: string, expenseId: string, input: ExpenseInput): Promise<Expense> {
      return (await patch<Expense>(`/api/groups/${groupId}/expenses/${expenseId}`, input)) as Expense;
    },
    async remove(groupId: string, expenseId: string): Promise<void> {
      await del(`/api/groups/${groupId}/expenses/${expenseId}`);
    },
    splitEqually,
  },

  balances: {
    async get(groupId: string): Promise<MemberBalance[]> {
      return (await get<MemberBalance[]>(`/api/groups/${groupId}/balances`)) || [];
    },
  },

  settlements: {
    async suggestions(groupId: string): Promise<SettlementSuggestion[]> {
      return (await get<SettlementSuggestion[]>(`/api/groups/${groupId}/settlements/suggestions`)) || [];
    },
    async list(groupId: string): Promise<Settlement[]> {
      return (await get<Settlement[]>(`/api/groups/${groupId}/settlements`)) || [];
    },
    async create(groupId: string, input: SettlementInput): Promise<Settlement> {
      return (await post<Settlement>(`/api/groups/${groupId}/settlements`, input)) as Settlement;
    },
  },

  dashboard: {
    async get(): Promise<DashboardData> {
      return (await get<DashboardData>("/api/dashboard")) as DashboardData;
    },
  },

  async resetMockData(): Promise<void> {
    return;
  },
};

export type Api = typeof api;
