"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import { login, loginLocal } from "./actions";
import { useAuth } from "@/app/context/AuthContext";
import { dashboardPathForRole, SSO_BYPASS_ENABLED } from "@/lib/auth";

export default function LocalLoginForm() {
  const router = useRouter();
  const { setUserData } = useAuth();
  const { instance, inProgress } = useMsal();
  const callbackStartedRef = useRef(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompletingCallback, setIsCompletingCallback] = useState(false);

  useEffect(() => {
    if (SSO_BYPASS_ENABLED || callbackStartedRef.current) {
      return;
    }

    if (typeof instance.handleRedirectPromise !== "function") {
      return;
    }

    callbackStartedRef.current = true;

    const completeMicrosoftRedirect = async () => {
      try {
        const redirectResult = await instance.handleRedirectPromise();
        const selectedAccount = redirectResult?.account;
        if (!selectedAccount) {
          return;
        }

        setIsCompletingCallback(true);
        setError(null);
        instance.setActiveAccount?.(selectedAccount);

        let idToken = redirectResult.idToken ?? "";
        if (!idToken) {
          const tokenResponse = await instance.acquireTokenSilent({
            account: selectedAccount,
            scopes: ["user.read"],
          });
          idToken = tokenResponse?.idToken || selectedAccount.idToken || "";
        }

        if (!idToken) {
          throw new Error("Token acquisition failed");
        }

        const result = await login(idToken);
        if (result?.success) {
          setUserData({
            nim: result.data.nim,
            name: result.data.Name,
            email: result.data.Email,
            role: result.data.ActiveRole,
            listRole: result.data.Role,
            microsoftToken: result.data.MicrosoftToken,
          });

          router.replace(dashboardPathForRole(result.data.ActiveRole) ?? "/");
        } else {
          setIsCompletingCallback(false);
          setError(
            result?.message ?? "Microsoft sign-in failed. Please try again."
          );
        }
      } catch (err: unknown) {
        console.error("An error occurred during Microsoft sign-in:", err);
        setIsCompletingCallback(false);
        setError("Unable to complete Microsoft sign-in. Please try again.");
      }
    };

    void completeMicrosoftRedirect();
  }, [instance, router, setUserData]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setError("Please enter your NIM / email / lecturer code and password.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const result = await loginLocal(trimmedIdentifier, password);

    if (!result.success) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    setUserData({
      nim: result.data.nim,
      name: result.data.Name,
      email: result.data.Email,
      role: result.data.ActiveRole,
      listRole: result.data.Role,
      microsoftToken: "",
    });

    router.replace(dashboardPathForRole(result.data.ActiveRole) ?? "/");
  };

  const loginMicrosoft = async () => {
    if (isSubmitting || inProgress !== "none") return;

    if (SSO_BYPASS_ENABLED) {
      router.push("/login/microsoft");
      return;
    }

    setError(null);
    const loginRequest = {
      scopes: ["user.read"],
      prompt: "select_account",
    };

    try {
      await instance.loginRedirect(loginRequest);
    } catch (err: unknown) {
      console.error(err);
      setError("Unable to start Microsoft sign-in. Please try again.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-gray-100 p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <h1 className="font-montserrat font-bold text-2xl text-primary-binus">
            <span className="bg-primary-binus text-white px-2 py-0.5 rounded-md mr-1">
              Git
            </span>
            Bee
          </h1>
          <span className="mt-2 inline-block rounded-full bg-orange-50 px-3 py-0.5 text-xs font-medium text-primary-orange">
            Dev &amp; Test Sign In
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {isCompletingCallback ? (
          <p className="py-8 text-center text-sm text-gray-600">
            Completing Microsoft sign-in...
          </p>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  NIM / Email / Lecturer Code
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. 2702000001, user@binus.edu, or D1234"
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-binus focus:outline-none focus:ring-1 focus:ring-primary-binus disabled:bg-gray-100"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-16 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-binus focus:outline-none focus:ring-1 focus:ring-primary-binus disabled:bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isSubmitting}
                    className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-primary-orange py-2.5 text-sm font-semibold text-white hover:opacity-95 transition disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-gray-100 text-center">
              <button
                type="button"
                onClick={() => loginMicrosoft()}
                disabled={isSubmitting || inProgress !== "none"}
                className="text-sm font-medium text-primary-orange hover:underline disabled:opacity-60 cursor-pointer"
              >
                Sign in with Microsoft SSO instead
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}