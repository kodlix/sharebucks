import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

describe("fetch-backed api service", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  const jsonResponse = (status = 200, body: any = {}, ok = true) => {
    return {
      ok,
      status,
      statusText: ok ? "OK" : "Bad Request",
      text: async () => JSON.stringify(body),
    } as Response;
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("registers through the fetch API and returns the payload", async () => {
    const user = { id: "u1", email: "new@example.com", display_name: "New User", created_at: "2026-01-01" };
    fetchMock.mockResolvedValue(jsonResponse(200, user));

    const result = await api.auth.register({
      email: "new@example.com",
      password: "password123",
      display_name: "New User",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/auth/register", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Accept: "application/json" }),
      credentials: "include",
    }));
    expect(result.email).toBe("new@example.com");
  });

  it("returns the current user from the fetch-backed me endpoint", async () => {
    const user = { id: "u1", email: "demo@sharebucks.app", display_name: "Demo User", created_at: "2026-01-01" };
    fetchMock.mockResolvedValue(jsonResponse(200, user));

    const me = await api.auth.me();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/auth/me", expect.objectContaining({
      method: "GET",
    }));
    expect(me).toEqual(user);
  });

  it("throws ApiError on a non-OK fetch response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: { error: { message: "Incorrect email or password" } } }, false));

    await expect(api.auth.login({ email: "demo@sharebucks.app", password: "wrong" })).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Incorrect email or password",
    });
  });
});
