import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
const TOKEN_COOKIE = "tyb_token";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  viewer: "/admin",
  fleet_manager: "/fleet-manager",
  driver: "/driver",
};

const ROLE_FORBIDDEN_PREFIXES: Record<string, string[]> = {
  admin:         ["/driver", "/fleet-manager"],
  viewer:        ["/driver", "/fleet-manager"],
  fleet_manager: ["/admin", "/driver"],
  driver:        ["/admin", "/fleet-manager"],
};

interface TokenPayload {
  role?: string;
  exp?: number;
}

/**
 * Decode JWT payload without signature verification.
 * Returns null if the token is malformed OR expired.
 */
function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // base64url → standard base64 with correct padding
    const raw = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = raw + "=".repeat((4 - (raw.length % 4)) % 4);
    const payload: TokenPayload = JSON.parse(atob(padded));

    // Treat expired tokens as invalid so middleware redirects to /login,
    // preventing the redirect loop (stale cookie → role home → 401 → /login → stale cookie …)
    if (payload.exp != null && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawToken = request.cookies.get(TOKEN_COOKIE)?.value;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  // Decode & validate the token (null = missing, malformed, or expired)
  const payload = rawToken ? decodeToken(rawToken) : null;
  const isAuthenticated = payload !== null;
  const role = payload?.role ?? null;

  // ── Unauthenticated ──────────────────────────────────────────────────────
  if (!isAuthenticated) {
    if (isPublic) return NextResponse.next();           // allow /login through
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);                  // everything else → /login
  }

  // ── Authenticated ────────────────────────────────────────────────────────
  const home = role ? (ROLE_HOME[role] ?? "/login") : "/login";

  // On / → send to their home page
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  // Always allow /login through so the client can recover from bad/stale cookies
  // instead of bouncing between /login and a protected route forever.
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // On a forbidden section → send to their home page
  if (role) {
    const forbidden = ROLE_FORBIDDEN_PREFIXES[role] ?? [];
    const isForbidden = forbidden.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    if (isForbidden) {
      const url = request.nextUrl.clone();
      url.pathname = home;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|tyb-logo.png|.*\\.png$|.*\\.svg$).*)",
  ],
};
