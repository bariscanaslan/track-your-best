// app/(auth)/login/page.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import ReCAPTCHA from "react-google-recaptcha";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();

  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const recaptchaRef = useRef<any>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!;

  // Eğer giriş yapılmışsa dashboard'a git
  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 🔐 LOGIN SUBMIT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const token = await recaptchaRef.current?.executeAsync();
      recaptchaRef.current?.reset();

      if (!token) {
        setError("Robot doğrulaması başarısız.");
        return;
      }

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          recaptcha_token: token, 
        }),
      });

      if (!res.ok) {
        setError("Kullanıcı adı veya şifre yanlış");
        return;
      }

      const data = await res.json();
      login(data.user);

      router.replace("/dashboard");
    } catch (err) {
      console.error("Login Error:", err);
      setError("Sunucuya bağlanılamadı");
    }
  };

  if (isAuthenticated) return <div>Yükleniyor...</div>;

  return (
    <div className="login-card">

      {/* Logo Alanı */}
      <div className="login-logo"></div>

      <h2 className="login-title">Login</h2>
      <p className="login-subtitle">Access Track Your Best control panel.</p>

      <form onSubmit={handleSubmit} className="login-form">

        {/* USERNAME */}
        <div className="login-input-group">
          <label className="login-label">Username</label>
          <input
            type="text"
            name="username"
            className="login-input"
            value={form.username}
            onChange={handleChange}
            required
          />
        </div>

        {/* PASSWORD + SHOW/HIDE */}
        <div className="login-input-group">
          <label className="login-label">Password</label>

          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              className="login-input password-input"
              value={form.password}
              onChange={handleChange}
              required
            />

            {/* 👁 React-icons eye toggle */}
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <AiOutlineEye size={20} color="#ccc" />
              ) : (
                <AiOutlineEyeInvisible size={20} color="#ccc" />
              )}
            </button>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && <p className="login-error">{error}</p>}

        {/* SUBMIT */}
        <button type="submit" className="login-button">
          Login
        </button>

      </form>
      <div className="recaptcha-div">
        {/* Invisible reCAPTCHA */}
        <ReCAPTCHA
          ref={recaptchaRef}
          sitekey={RECAPTCHA_SITE_KEY}
        />
      </div>
      
    </div>
  );
}
