"use client";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@/lib/auth";
import { getSession } from "@/app/(pages)/login/actions";

interface AuthContextType {
  session: Session | null;
  setSession: (session: Session | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = use(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [sessionState, setSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const bootstrapRef = useRef<AbortController | null>(null);

  const setSession = useCallback((session: Session | null) => {
    bootstrapRef.current?.abort();
    setSessionState(session);
    setError(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    bootstrapRef.current = controller;
    getSession(controller.signal)
      .then((session) => {
        if (!controller.signal.aborted) setSessionState(session);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSessionState(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <AuthContext value={{ session: sessionState, setSession, loading }}>
      {error && (
        <div role="alert" className="relative z-[100] mt-20 bg-white p-4 text-center sm:mt-28">
          Couldn't restore your session.{' '}
          <button
            type="button"
            className="text-primary-orange underline"
            onClick={() => {
              setError(false);
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      )}
      {children}
    </AuthContext>
  );
};

export const SessionContent = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return <p role="status" className="p-6 pt-32 text-center">Restoring your session...</p>;
  if (!session) return <p className="p-6 pt-32 text-center"><a href="/login/microsoft" className="text-primary-orange underline">Sign in to continue</a></p>;
  return children;
};
