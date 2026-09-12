import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/AppShell";
import { api } from "@/services/api";
import { errorMessage, keys, meQuery } from "@/services/queries";

const searchSchema = z.object({ redirect: z.string().optional(), mode: z.enum(["login", "register"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — ShareBucks" },
      { name: "description", content: "Sign in or create your ShareBucks account to start splitting expenses." },
      { property: "og:title", content: "Sign in — ShareBucks" },
      { property: "og:description", content: "Sign in or create your ShareBucks account to start splitting expenses." },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
const registerSchema = z.object({
  display_name: z.string().min(1, "Name is required").max(60),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});
type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

function normalizeRedirectPath(redirect?: string): string {
  if (!redirect) return "/dashboard";

  try {
    const url = new URL(redirect, window.location.origin);
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}` || "/dashboard";
    }
  } catch {
    // Treat a plain route string as already relative.
  }

  return redirect.startsWith("/") ? redirect : "/dashboard";
}

function AuthPage() {
  const { redirect, mode } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"login" | "register">(mode ?? "login");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  useEffect(() => {
    api.auth.me().then((u) => {
      if (u) navigate({ to: normalizeRedirectPath(redirect), replace: true });
    });
  }, [navigate, redirect]);

  function onSignedIn() {
    qc.removeQueries({ queryKey: keys.me });
    qc.prefetchQuery(meQuery);
    navigate({ to: normalizeRedirectPath(redirect), replace: true });
  }

  const login = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const register = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { display_name: "", email: "", password: "" },
  });

  async function onLogin(values: LoginValues) {
    try {
      await api.auth.login(values);
      onSignedIn();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function onForgotPassword() {
    const email = login.getValues("email");
    if (!email.trim()) {
      toast.error("Enter your email to request a reset.");
      return;
    }

    try {
      const result = await api.auth.forgotPassword({ email });
      toast.success(result.message || "If an account exists, a reset link token was issued.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function onResetPassword() {
    const token = resetToken.trim();
    const password = resetPassword.trim();

    if (!token || !password) {
      toast.error("Enter the token and your new password.");
      return;
    }

    try {
      const result = await api.auth.resetPassword({ token, password });
      toast.success(result.message);
      setResetToken("");
      setResetPassword("");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function onRegister(values: RegisterValues) {
    try {
      await api.auth.register(values);
      toast.success("Welcome to ShareBucks!");
      onSignedIn();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Link to="/">
          <Logo className="text-sidebar-foreground" />
        </Link>
        <div>
          <h2 className="font-display max-w-md text-4xl font-semibold leading-tight">
            Split the bill, not the friendship.
          </h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">
            Track who paid for what, see balances update instantly, and settle up with the fewest possible payments.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} ShareBucks</p>
      </div>

      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 block lg:hidden">
            <Logo />
          </Link>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to see your groups and balances.</p>
              <form onSubmit={login.handleSubmit(onLogin)} className="mt-6 space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" autoComplete="email" {...login.register("email")} />
                  <FieldError msg={login.formState.errors.email?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" type="password" autoComplete="current-password" {...login.register("password")} />
                  <FieldError msg={login.formState.errors.password?.message} />
                </div>
                <Button type="submit" className="w-full" disabled={login.formState.isSubmitting}>
                  {login.formState.isSubmitting ? "Signing in…" : "Sign in"}
                </Button>
                <div className="flex justify-end">
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onForgotPassword}>
                    Forgot password?
                  </Button>
                </div>
                <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-3">
                  <p className="text-xs font-medium text-foreground">Reset your password</p>
                  <div className="mt-2 space-y-2">
                    <Input
                      placeholder="Reset token"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                    />
                    <Input
                      type="password"
                      placeholder="New password"
                      autoComplete="new-password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                    />
                    <Button type="button" variant="secondary" className="w-full" onClick={onResetPassword}>
                      Update password
                    </Button>
                  </div>
                </div>
              </form>
              <div className="mt-5 rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Demo account</p>
                <p className="mt-1">
                  <code>demo@sharebucks.app</code> / <code>password123</code>
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0"
                  onClick={() => {
                    login.setValue("email", "demo@sharebucks.app");
                    login.setValue("password", "password123");
                    login.handleSubmit(onLogin)();
                  }}
                >
                  Use demo account
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="register" className="mt-6">
              <h1 className="font-display text-2xl font-semibold">Create your account</h1>
              <p className="mt-1 text-sm text-muted-foreground">Free, and takes about ten seconds.</p>
              <form onSubmit={register.handleSubmit(onRegister)} className="mt-6 space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">Display name</Label>
                  <Input id="reg-name" autoComplete="name" {...register.register("display_name")} />
                  <FieldError msg={register.formState.errors.display_name?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input id="reg-email" type="email" autoComplete="email" {...register.register("email")} />
                  <FieldError msg={register.formState.errors.email?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input id="reg-password" type="password" autoComplete="new-password" {...register.register("password")} />
                  <FieldError msg={register.formState.errors.password?.message} />
                </div>
                <Button type="submit" className="w-full" disabled={register.formState.isSubmitting}>
                  {register.formState.isSubmitting ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export function FieldError({ msg }: { msg?: string | undefined }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
