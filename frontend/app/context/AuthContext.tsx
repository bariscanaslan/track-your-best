// app/context/AuthContext.tsx

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { TybRole } from "../../lib/roles";

export interface AuthUser {
  id: string;
  organizationId?: string;
  username: string;
  email: string;
  fullName: string;
  role: TybRole;
  avatarUrl?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          credentials: "include",
        });

        if (res.ok) {
          const data: AuthUser = await res.json();
          setUser(data);
        } else {
          // Session is invalid — delete the httpOnly cookie via the backend so the
          // middleware stops seeing a stale token and redirecting to role home.
          try {
            await fetch(`${API}/api/auth/logout`, {
              method: "POST",
              credentials: "include",
            });
          } catch {
            // Ignore — the important thing is setting user to null below.
          }
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (userData: AuthUser) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: Boolean(user),
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
