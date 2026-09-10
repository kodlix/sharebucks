import { beforeEach, describe, expect, it } from "vitest";
import { api, ApiError } from "./api";
import { resetDb } from "./mockDb";

describe("mocked api service", () => {
    const store = new Map<string, string>();

    beforeEach(() => {
        store.clear();
        Object.defineProperty(globalThis, "window", {
            value: {
                localStorage: {
                    getItem(key: string) {
                        return store.has(key) ? store.get(key)! : null;
                    },
                    setItem(key: string, value: string) {
                        store.set(key, value);
                    },
                    removeItem(key: string) {
                        store.delete(key);
                    },
                },
            },
            configurable: true,
            writable: true,
        });
        resetDb();
    });

    it("registers, logs in, reads the current user, and logs out cleanly", async () => {
        const user = await api.auth.register({
            email: "new@example.com",
            password: "password123",
            display_name: "New User",
        });

        expect(user.email).toBe("new@example.com");
        expect(user.display_name).toBe("New User");

        const sameUser = await api.auth.me();
        expect(sameUser?.id).toBe(user.id);

        await api.auth.logout();
        expect(await api.auth.me()).toBeNull();

        await expect(
            api.auth.login({ email: "new@example.com", password: "wrong-password" }),
        ).rejects.toMatchObject({ name: "ApiError", status: 401 });
    });

    it("creates a group, lists it, and makes its public metadata discoverable", async () => {
        await api.auth.login({ email: "demo@sharebucks.app", password: "password123" });

        const created = await api.groups.create({
            name: "API Smoke",
            description: "A group created through the mock API.",
            visibility: "public",
            currency: "USD",
        });

        expect(created.name).toBe("API Smoke");
        expect(created.categories.length).toBeGreaterThan(0);

        const listed = await api.groups.list();
        expect(listed.some((group) => group.id === created.id)).toBe(true);

        const detail = await api.groups.get(created.id);
        expect(detail.id).toBe(created.id);

        const discover = await api.groups.discover("API");
        expect(discover.some((group) => group.id === created.id)).toBe(true);
    });

    it("creates and lists an expense and exposes member balances and settlement suggestions", async () => {
        await api.auth.login({ email: "demo@sharebucks.app", password: "password123" });

        const group = await api.groups.create({
            name: "Expense Smoke",
            description: "A group for expense smoke checks.",
            visibility: "private",
            currency: "USD",
        });

        const categoryId = group.categories[0]?.id ?? "c_group_default";
        const expense = await api.expenses.create(group.id, {
            title: "Dinner",
            amount: 2500,
            category_id: categoryId,
            payer_id: "u_demo",
            expense_date: "2026-09-10",
            notes: "Dinner for the group",
            shares: [{ user_id: "u_demo", amount: 2500 }],
        });

        expect(expense.title).toBe("Dinner");
        expect(expense.amount).toBe(2500);
        expect(expense.shares[0]?.amount).toBe(2500);

        const listedExpenses = await api.expenses.list(group.id);
        expect(listedExpenses.some((item) => item.id === expense.id)).toBe(true);

        const balances = await api.balances.get(group.id);
        expect(balances.some((balance) => balance.user_id === "u_demo")).toBe(true);

        const details = await api.groups.get(group.id);
        expect(details.members.some((member) => member.user_id === "u_demo")).toBe(true);

        const suggestions = await api.settlements.suggestions(group.id);
        expect(Array.isArray(suggestions)).toBe(true);
    });
});
