// app/(auth)/login/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, AuthUser } from "../../context/AuthContext";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const ROLE_ROUTES: Record<AuthUser["role"], string> = {
  admin: "/admin",
  fleet_manager: "/fleet-manager",
  driver: "/driver",
  viewer: "/admin",
};

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!loginValue.trim() || !password) {
      setError("Please enter your email/username and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ login: loginValue.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message ?? "Login failed. Please try again.");
        return;
      }

      const user = data as AuthUser;
      login(user);
      router.replace(ROLE_ROUTES[user.role] ?? "/admin");
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-logo" />
      <h2 className="login-title">Welcome back</h2>
      <p className="login-subtitle">Sign in to Track Your Best</p>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <div className="login-input-group">
          <label className="login-label" htmlFor="login-field">
            Email or username
          </label>
          <input
            id="login-field"
            className="login-input"
            type="text"
            placeholder="you@example.com"
            autoComplete="username"
            value={loginValue}
            onChange={(e) => setLoginValue(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="login-input-group">
          <label className="login-label" htmlFor="password-field">
            Password
          </label>
          <div className="password-wrapper">
            <input
              id="password-field"
              className="login-input password-input"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && <p className="login-error">{error}</p>}

        <button className="login-button" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
