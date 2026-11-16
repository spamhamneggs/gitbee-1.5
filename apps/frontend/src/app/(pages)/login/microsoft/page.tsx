"use client";
import { useMsal } from "@azure/msal-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, login, loginDevBypass } from "../actions";
import { useAuth } from "@/app/context/AuthContext";
import { dashboardPathForRole, SSO_BYPASS_ENABLED } from "@/lib/auth";

const Page = () => {
  const { session, setSession, loading } = useAuth();
  const { instance, inProgress, accounts } = useMsal();
  const router = useRouter();
  const bypassStartedRef = useRef(false);
  const [bypassError, setBypassError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    // Another tab can remove the cookie while this tab keeps its identity.
    if (session) {
      const controller = new AbortController();
      getSession(controller.signal)
        .then((current) => {
          if (controller.signal.aborted) return;
          if (current) router.push(dashboardPathForRole(current.activeRole) ?? "/");
          else setSession(null);
        })
        .catch(() => {
          if (!controller.signal.aborted) router.push("/");
        });
      return () => controller.abort();
    }

    const handleRedirect = async () => {
      if (SSO_BYPASS_ENABLED) {
        if (bypassStartedRef.current) return;
        bypassStartedRef.current = true;
        const result = await loginDevBypass();
        if (result.success) {
          setSession(result.data);
          router.push(dashboardPathForRole(result.data.activeRole) ?? "/");
        } else {
          // Stay here with the reason: sending the developer home just makes
          // the next login attempt fail the same way, unexplained.
          setBypassError(result.message ?? "Dev login failed.");
        }
        return;
      }

      if (inProgress === "none" && accounts.length > 0) {
        try {
          const account = accounts[0];
          if (!account) {
            throw new Error("No account found");
          }
          const response = await instance.acquireTokenSilent({
            account,
            scopes: ["user.read"],
          });

          if (!response) {
            throw new Error("Token acquisition failed");
          }

          const result = await login(response.idToken);
          if (result?.success) {
            setSession(result.data);
            router.push(dashboardPathForRole(result.data.activeRole) ?? "/");
          } else {
            router.push("/");
          }
        } catch (error) {
          console.error("An error occurred during redirection:", error);
        }
      } else if (inProgress === "none" && accounts.length <= 0) {
        router.push("/");
      }
    };

    handleRedirect();
  }, [instance, accounts, inProgress, router, setSession, session, loading]);

  if (bypassError) {
    return (
      <div className="fixed z-[100] bg-white w-screen h-screen flex justify-center items-center px-6">
        <div className="max-w-xl flex flex-col gap-4 items-center text-center">
          <h1 className="font-montserrat font-bold text-2xl text-primary-binus">
            Dev login failed
          </h1>
          <p className="text-gray-700 break-words">{bypassError}</p>
          <Link href="/" className="text-primary-orange underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed z-[100] bg-white w-screen h-screen flex justify-center items-center">
      <div className="flex-col gap-4 w-full flex items-center justify-center">
        <h1 className="font-montserrat font-bold text-2xl text-primary-binus absolute animate-pulse">
          <span className="bg-primary-binus text-white px-2 rounded-md mr-1">
            Git
          </span>
          Bee
        </h1>
        <div className="w-36 h-36 border-8 text-primary-orange text-4xl animate-spin border-gray-300 flex items-center justify-center border-t-primary-orange rounded-full"></div>
      </div>
    </div>
  );
};

export default Page;
