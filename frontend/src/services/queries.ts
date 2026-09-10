// TanStack Query hooks over the service layer. Components import from here
// (or from api directly for one-off calls) — never from mockDb.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "./api";
import type { CreateGroupInput, ExpenseInput, SettlementInput, UpdateGroupInput } from "../types";

export const keys = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  groups: ["groups"] as const,
  group: (id: string) => ["groups", id] as const,
  discover: (q: string) => ["discover", q] as const,
  expenses: (gid: string) => ["groups", gid, "expenses"] as const,
  expense: (gid: string, eid: string) => ["groups", gid, "expenses", eid] as const,
  balances: (gid: string) => ["groups", gid, "balances"] as const,
  settlements: (gid: string) => ["groups", gid, "settlements"] as const,
  suggestions: (gid: string) => ["groups", gid, "suggestions"] as const,
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export const meQuery = queryOptions({ queryKey: keys.me, queryFn: () => api.auth.me(), staleTime: Infinity });
export const dashboardQuery = queryOptions({ queryKey: keys.dashboard, queryFn: () => api.dashboard.get() });
export const groupsQuery = queryOptions({ queryKey: keys.groups, queryFn: () => api.groups.list() });
export const groupQuery = (id: string) => queryOptions({ queryKey: keys.group(id), queryFn: () => api.groups.get(id) });
export const discoverQuery = (q: string) =>
  queryOptions({ queryKey: keys.discover(q), queryFn: () => api.groups.discover(q) });
export const expensesQuery = (gid: string) =>
  queryOptions({ queryKey: keys.expenses(gid), queryFn: () => api.expenses.list(gid) });
export const expenseQuery = (gid: string, eid: string) =>
  queryOptions({ queryKey: keys.expense(gid, eid), queryFn: () => api.expenses.get(gid, eid) });
export const balancesQuery = (gid: string) =>
  queryOptions({ queryKey: keys.balances(gid), queryFn: () => api.balances.get(gid) });
export const settlementsQuery = (gid: string) =>
  queryOptions({ queryKey: keys.settlements(gid), queryFn: () => api.settlements.list(gid) });
export const suggestionsQuery = (gid: string) =>
  queryOptions({ queryKey: keys.suggestions(gid), queryFn: () => api.settlements.suggestions(gid) });

export function useMe() {
  return useQuery(meQuery);
}

/** Invalidate everything derived from a group's ledger. */
function useInvalidateGroup() {
  const qc = useQueryClient();
  return (gid?: string) => {
    if (gid) qc.invalidateQueries({ queryKey: keys.group(gid) });
    qc.invalidateQueries({ queryKey: keys.groups });
    qc.invalidateQueries({ queryKey: keys.dashboard });
    qc.invalidateQueries({ queryKey: ["discover"] });
  };
}

export function useCreateGroup() {
  const inv = useInvalidateGroup();
  return useMutation({
    mutationFn: (input: CreateGroupInput) => api.groups.create(input),
    onSuccess: () => inv(),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useUpdateGroup(gid: string) {
  const inv = useInvalidateGroup();
  return useMutation({
    mutationFn: (input: UpdateGroupInput) => api.groups.update(gid, input),
    onSuccess: () => {
      inv(gid);
      toast.success("Group updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useArchiveGroup(gid: string) {
  const inv = useInvalidateGroup();
  return useMutation({
    mutationFn: () => api.groups.archive(gid),
    onSuccess: () => {
      inv(gid);
      toast.success("Group archived");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useLeaveGroup(gid: string) {
  const inv = useInvalidateGroup();
  return useMutation({
    mutationFn: () => api.groups.leave(gid),
    onSuccess: () => inv(gid),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useRemoveMember(gid: string) {
  const inv = useInvalidateGroup();
  return useMutation({
    mutationFn: (userId: string) => api.groups.removeMember(gid, userId),
    onSuccess: () => {
      inv(gid);
      toast.success("Member removed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useJoinGroup() {
  const inv = useInvalidateGroup();
  return useMutation({
    mutationFn: (args: { groupId?: string; code?: string }) => api.groups.join(args.groupId ?? null, args.code),
    onSuccess: (g) => inv(g.id),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useCreateCategory(gid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.groups.createCategory(gid, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.group(gid) }),
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useCreateExpense(gid: string) {
  const inv = useInvalidateGroup();
  return useMutation({
    mutationFn: (input: ExpenseInput) => api.expenses.create(gid, input),
    onSuccess: () => inv(gid),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useUpdateExpense(gid: string, eid: string) {
  const inv = useInvalidateGroup();
  return useMutation({
    mutationFn: (input: ExpenseInput) => api.expenses.update(gid, eid, input),
    onSuccess: () => inv(gid),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useDeleteExpense(gid: string) {
  const inv = useInvalidateGroup();
  return useMutation({
    mutationFn: (eid: string) => api.expenses.remove(gid, eid),
    onSuccess: () => {
      inv(gid);
      toast.success("Expense deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
export function useCreateSettlement(gid: string) {
  const inv = useInvalidateGroup();
  return useMutation({
    mutationFn: (input: SettlementInput) => api.settlements.create(gid, input),
    onSuccess: () => {
      inv(gid);
      toast.success("Settlement recorded");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
