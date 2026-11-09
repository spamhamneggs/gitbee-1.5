"use client";
import { useState, type FormEvent } from "react";
import { dashboardPathForRole } from "@/lib/auth";
import styles from "../data-demo/demo.module.css";

export default function DemoLogin() {
  const [email, setEmail] = useState("admin@example.test");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API}auth/login-local`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.status)
        throw new Error(
          typeof result.errors === "string"
            ? result.errors
            : "Login failed. Check your credentials.",
        );
      window.location.assign(
        result.data.Role?.includes("Admin")
          ? "/data-demo"
          : (dashboardPathForRole(result.data.ActiveRole) ?? "/"),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to reach the backend.",
      );
      setBusy(false);
    }
  }
  return (
    <main className={styles.root}>
      <div className={styles.login}>
        <p className={styles.eyebrow}>GITBEE · LOCAL DEMO</p>
        <h1>Ready to explore?</h1>
        <p>
          Sign in with the seeded administrator to import sample files and
          inspect the database.
        </p>
        <form onSubmit={submit} className={styles.form}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button disabled={busy} className={styles.primary}>
            {busy ? "Signing in…" : "Open the demo →"}
          </button>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </form>
        <p className={styles.muted}>
          Use the demo credentials in the setup guide. This uses the app’s local
          account login.
        </p>
      </div>
    </main>
  );
}
