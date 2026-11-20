import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";

const toDataUrl = (jsCode) =>
  `data:text/javascript;base64,${Buffer.from(jsCode).toString("base64")}`;

// 1. Test the loginLocal action contract
const actionsSource = await readFile(
  new URL("../src/app/(pages)/login/actions.tsx", import.meta.url),
  "utf8"
);
const { outputText: actionsJs } = ts.transpileModule(actionsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const actionsDataUrl = toDataUrl(actionsJs);
const { loginLocal } = await import(actionsDataUrl);

test("loginLocal posts identifier and password with session credentials", async (t) => {
  const previous = process.env.NEXT_PUBLIC_BACKEND_API;
  process.env.NEXT_PUBLIC_BACKEND_API = "http://localhost:5001/api/";
  const calls = [];
  let response = Response.json({
    status: true,
    data: {
      nim: "2702000001",
      Name: "Student",
      Email: "student@binus.edu",
      ActiveRole: "Student",
      Role: ["Student"],
      MicrosoftToken: "",
    },
  });

  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, ...options });
    if (response instanceof Error) throw response;
    return response.clone();
  });

  try {
    const ok = await loginLocal("2702000001", "Password123!");
    assert.equal(ok.success, true);
    assert.equal(ok.data.nim, "2702000001");
    assert.equal(calls.at(-1).url, "http://localhost:5001/api/auth/login-local");
    assert.equal(calls.at(-1).method, "POST");
    assert.equal(calls.at(-1).credentials, "include");
    assert.deepEqual(JSON.parse(calls.at(-1).body), {
      identifier: "2702000001",
      password: "Password123!",
    });

    response = Response.json(
      { status: false, errors: "Invalid credentials" },
      { status: 401 }
    );
    assert.deepEqual(await loginLocal("2702000001", "wrong"), {
      success: false,
      message: "Invalid credentials",
    });

    response = new Response(null, { status: 404 });
    assert.equal((await loginLocal("2702000001", "Password123!")).success, false);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BACKEND_API;
    else process.env.NEXT_PUBLIC_BACKEND_API = previous;
  }
});

// 2. Test LocalLoginForm MSAL redirect handling, cached accounts, and session replacement
const routerMockUrl = toDataUrl(`
  export const state = { pushes: [], replaces: [] };
  export const useRouter = () => ({
    push: (url) => state.pushes.push(url),
    replace: (url) => state.replaces.push(url),
  });
`);

const msalMockUrl = toDataUrl(`
  export const state = {
    inProgress: "none",
    accounts: [],
    activeAccount: null,
    redirects: [],
    redirectPromiseResult: null,
    silentCalls: [],
  };
  export const useMsal = () => ({
    inProgress: state.inProgress,
    accounts: state.accounts,
    instance: {
      loginRedirect: async (req) => {
        state.redirects.push(req);
      },
      handleRedirectPromise: async () => state.redirectPromiseResult,
      setActiveAccount: (account) => {
        state.activeAccount = account;
      },
      acquireTokenSilent: async (req) => {
        state.silentCalls.push(req);
        return { idToken: req.account?.idToken ?? "" };
      },
    },
  });
`);

const authContextMockUrl = toDataUrl(`
  export const state = { userData: null, updates: [] };
  export const useAuth = () => ({
    userData: state.userData,
    setUserData: (next) => {
      state.userData = next;
      state.updates.push(next);
    },
  });
`);

const libAuthMockUrl = toDataUrl(`
  export let SSO_BYPASS_ENABLED = false;
  export const setBypassSso = (value) => { SSO_BYPASS_ENABLED = value; };
  export const dashboardPathForRole = (role) =>
    role === "Admin" ? "/dashboard-admin" : "/dashboard";
`);

const reactSpyUrl = toDataUrl(`
  import React, { useState, useRef } from ${JSON.stringify(
    import.meta.resolve("react")
  )};
  export const pendingEffects = [];
  export function useEffect(effect) {
    pendingEffects.push(effect);
  }
  export async function flushEffects() {
    while (pendingEffects.length > 0) {
      const effect = pendingEffects.shift();
      await effect();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  export { useState, useRef };
  export default { ...React, useState, useRef, useEffect };
`);

const jsxRuntimeSpyUrl = toDataUrl(`
  import { jsx as realJsx, jsxs as realJsxs, Fragment } from ${JSON.stringify(
    import.meta.resolve("react/jsx-runtime")
  )};
  export const elements = [];
  export function jsx(type, props, key) {
    elements.push({ type, props });
    return realJsx(type, props, key);
  }
  export function jsxs(type, props, key) {
    elements.push({ type, props });
    return realJsxs(type, props, key);
  }
  export { Fragment };
`);

const formSource = await readFile(
  new URL("../src/app/(pages)/login/LocalLoginForm.tsx", import.meta.url),
  "utf8"
);
const compiledForm = ts
  .transpileModule(formSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
  .outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(jsxRuntimeSpyUrl))
  .replaceAll('"react"', JSON.stringify(reactSpyUrl))
  .replaceAll('"next/navigation"', JSON.stringify(routerMockUrl))
  .replaceAll('"@azure/msal-react"', JSON.stringify(msalMockUrl))
  .replaceAll('"./actions"', JSON.stringify(actionsDataUrl))
  .replaceAll('"@/app/context/AuthContext"', JSON.stringify(authContextMockUrl))
  .replaceAll('"@/lib/auth"', JSON.stringify(libAuthMockUrl));

const { default: LocalLoginForm } = await import(toDataUrl(compiledForm));
const routerMock = await import(routerMockUrl);
const msalMock = await import(msalMockUrl);
const authMock = await import(authContextMockUrl);
const libAuthMock = await import(libAuthMockUrl);
const reactSpy = await import(reactSpyUrl);
const jsxSpy = await import(jsxRuntimeSpyUrl);
const { jsx } = await import("react/jsx-runtime");

function renderForm() {
  jsxSpy.elements.length = 0;
  reactSpy.pendingEffects.length = 0;
  return renderToStaticMarkup(jsx(LocalLoginForm, {}));
}

function findSsoButton() {
  const button = jsxSpy.elements.find(
    (el) =>
      el.type === "button" &&
      el.props?.children === "Sign in with Microsoft SSO instead"
  );
  assert.ok(button, "Expected SSO fallback control to render as a <button>");
  return button;
}

test("plain /login visit with cached MSAL accounts keeps the credential form and does not auto-sign-in", async (t) => {
  routerMock.state.pushes.length = 0;
  routerMock.state.replaces.length = 0;
  msalMock.state.redirects.length = 0;
  msalMock.state.silentCalls.length = 0;
  msalMock.state.redirectPromiseResult = null;
  msalMock.state.accounts = [
    { username: "a@binus.edu", idToken: "token-a" },
    { username: "b@binus.edu", idToken: "token-b" },
  ];
  msalMock.state.inProgress = "none";
  authMock.state.userData = null;
  authMock.state.updates.length = 0;
  libAuthMock.setBypassSso(false);

  const backendCalls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    backendCalls.push(url);
    return Response.json({ status: true });
  });

  const html = renderForm();
  assert.match(html, /NIM \/ Email \/ Lecturer Code/);
  await reactSpy.flushEffects();

  assert.equal(backendCalls.length, 0);
  assert.equal(msalMock.state.silentCalls.length, 0);
  assert.equal(authMock.state.updates.length, 0);
  assert.equal(routerMock.state.replaces.length, 0);

  const ssoButton = findSsoButton();
  await ssoButton.props.onClick();
  assert.deepEqual(msalMock.state.redirects, [
    { scopes: ["user.read"], prompt: "select_account" },
  ]);
});

test("Microsoft SSO fallback routes to /login/microsoft when SSO bypass is enabled and ignores clicks while MSAL is busy", async () => {
  routerMock.state.pushes.length = 0;
  msalMock.state.redirects.length = 0;
  msalMock.state.accounts = [];
  msalMock.state.redirectPromiseResult = null;
  authMock.state.userData = null;

  msalMock.state.inProgress = "login";
  libAuthMock.setBypassSso(false);
  renderForm();
  const busyButton = findSsoButton();
  assert.equal(busyButton.props.disabled, true);
  await busyButton.props.onClick();
  assert.equal(msalMock.state.redirects.length, 0);
  assert.equal(routerMock.state.pushes.length, 0);

  msalMock.state.inProgress = "none";
  libAuthMock.setBypassSso(true);
  renderForm();
  const bypassButton = findSsoButton();
  await bypassButton.props.onClick();
  assert.deepEqual(routerMock.state.pushes, ["/login/microsoft"]);
  assert.equal(msalMock.state.redirects.length, 0);
});

test("MSAL redirect callback signs in the selected account B over cached account A and replaces an existing local session for A", async (t) => {
  const previous = process.env.NEXT_PUBLIC_BACKEND_API;
  process.env.NEXT_PUBLIC_BACKEND_API = "http://localhost:5001/api/";

  routerMock.state.pushes.length = 0;
  routerMock.state.replaces.length = 0;
  msalMock.state.silentCalls.length = 0;
  msalMock.state.activeAccount = null;
  authMock.state.updates.length = 0;
  // Existing local session for A must be replaced when Microsoft callback for B succeeds
  authMock.state.userData = {
    nim: "2702000001",
    name: "USER A",
    email: "a@binus.edu",
    role: "Student",
    listRole: ["Student"],
    microsoftToken: "",
  };
  libAuthMock.setBypassSso(false);

  const accountA = { username: "a@binus.edu", idToken: "token-a" };
  const accountB = { username: "b@binus.edu", idToken: "token-b" };
  msalMock.state.accounts = [accountA, accountB];
  msalMock.state.inProgress = "none";
  msalMock.state.redirectPromiseResult = {
    account: accountB,
    idToken: "token-b",
  };

  const backendCalls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    backendCalls.push({ url, ...options });
    return Response.json({
      status: true,
      data: {
        nim: "D5002",
        Name: "ADMIN B",
        Email: "b@binus.edu",
        ActiveRole: "Admin",
        Role: ["Admin", "Lecturer"],
        MicrosoftToken: "ms-session-b",
      },
    });
  });

  try {
    renderForm();
    await reactSpy.flushEffects();

    assert.equal(msalMock.state.activeAccount, accountB);
    assert.equal(backendCalls.length, 1);
    assert.equal(backendCalls[0].url, "http://localhost:5001/api/auth/login");
    assert.deepEqual(JSON.parse(backendCalls[0].body), {
      microsoft_token: "token-b",
    });

    assert.equal(authMock.state.updates.length, 1);
    assert.deepEqual(authMock.state.userData, {
      nim: "D5002",
      name: "ADMIN B",
      email: "b@binus.edu",
      role: "Admin",
      listRole: ["Admin", "Lecturer"],
      microsoftToken: "ms-session-b",
    });
    assert.deepEqual(routerMock.state.replaces, ["/dashboard-admin"]);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BACKEND_API;
    else process.env.NEXT_PUBLIC_BACKEND_API = previous;
  }
});

test("next.config.mjs configures a 307 redirect from /login to /login/microsoft in production", async () => {
  const { default: nextConfig } = await import("../next.config.mjs");
  const prevNodeEnv = process.env.NODE_ENV;
  const prevLocalLogin = process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN;
    assert.deepEqual(await nextConfig.redirects(), [
      { source: "/login", destination: "/login/microsoft", permanent: false },
    ]);

    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN = "false";
    assert.deepEqual(await nextConfig.redirects(), [
      { source: "/login", destination: "/login/microsoft", permanent: false },
    ]);

    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN = "true";
    assert.deepEqual(await nextConfig.redirects(), []);
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevLocalLogin === undefined) delete process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN;
    else process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN = prevLocalLogin;
  }
});