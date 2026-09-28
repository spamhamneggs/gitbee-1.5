"use client";
import { createContext, use, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import Cookies from "js-cookie";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";

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
  const token = Cookies.get("token");
  if (!token) {
    return null;
  }

  console.log(token);
  const decoded = jwt.decode(token) as JwtPayload;
  console.log(decoded);
  return {
    nim: decoded?.nim ? decoded.nim : "",
    name: decoded?.name ? decoded.name : "",
    email: decoded?.email ? decoded.email : "",
    role: decoded?.activeRole ? decoded.activeRole : "",
    listRole: decoded?.role ? decoded.role : "",
    microsoftToken: decoded?.microsoftToken ? decoded.microsoftToken : "",
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
