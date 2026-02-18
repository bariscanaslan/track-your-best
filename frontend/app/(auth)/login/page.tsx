// app/(auth)/login/page.tsx

"use client";

export default function LoginPage() {
  return (
    <div className="login-card">
      <div className="login-logo"></div>
      <h2 className="login-title">Login Disabled</h2>
      <p className="login-subtitle">Authentication is temporarily turned off.</p>
    </div>
  );
}

/*
  Previous login flow (disabled):
  - useAuth + useRouter redirect
  - reCAPTCHA check
  - POST /auth/login
  - login() + router.replace("/dashboard")
*/
