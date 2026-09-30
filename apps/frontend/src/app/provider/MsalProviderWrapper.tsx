"use client";  

import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import type { ReactNode } from "react";

const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_CLIENT_ID || "",
    authority: process.env.NEXT_PUBLIC_TENANT_ID || "",
    redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || "",
    postLogoutRedirectUri:
      process.env.NEXT_PUBLIC_POST_LOGOUT_REDIRECT_URI || "",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: process.env.NEXT_PUBLIC_CACHE_LOCATION || "",
    storeAuthStateInCookie:
      process.env.NEXT_PUBLIC_STORE_AUTH_STATE_IN_COOKIE === "true",
  },
};

const msalInstance = new PublicClientApplication(msalConfig);

export default function MsalProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
