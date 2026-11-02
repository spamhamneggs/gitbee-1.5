"use client";
import { createContext, use, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import Cookies from "js-cookie";
import jwt from "jsonwebtoken";

interface UserData {
  nim: string;
  name: string;
  email: string;
  role: string;
  listRole: string[];
  microsoftToken: string;
}

interface AuthContextType {
  userData: UserData | null;
  setUserData: (userData: UserData | null) => void; // Updated type
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

interface AuthProviderProps {
  children: ReactNode;
}

const getUserDataFromCookie = (): UserData | null => {
  // Lazy initializers also run during SSR prerender, where `document`
  // (and therefore the cookie) does not exist.
  if (typeof document === "undefined") {
    return null;
  }
  const token = Cookies.get(process.env.NEXT_PUBLIC_COOKIE_NAME || "gitbee_token");
  if (!token) {
    return null;
  }

  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string") {
    return null;
  }
  const roles = Array.isArray(decoded.role)
    ? decoded.role.filter((role): role is string => typeof role === "string")
    : [];
  return {
    nim: typeof decoded.nim === "string" ? decoded.nim : "",
    name: typeof decoded.name === "string" ? decoded.name : "",
    email: typeof decoded.email === "string" ? decoded.email : "",
    role: typeof decoded.activeRole === "string" ? decoded.activeRole : "",
    listRole: roles,
    microsoftToken:
      typeof decoded.microsoftToken === "string" ? decoded.microsoftToken : "",
  };
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [userData, setUserData] = useState<UserData | null>(
    getUserDataFromCookie
  );
  // Render children only after mount so the cookie-backed userData never
  // hydrates differently from the server snapshot.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  return (
    <AuthContext value={{ userData, setUserData, loading: !mounted }}>
      {mounted && children}
    </AuthContext>
  );
};
