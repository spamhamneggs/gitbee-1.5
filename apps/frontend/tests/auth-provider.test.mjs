import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/app/context/AuthContext.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});

// Run the provider's real effect and render output with controlled requests.
function providerHarness(getSession) {
  const state = [];
  const setters = [];
  let cursor = 0;
  let effect;
  let dependencies;
  let cleanup;
  function nextState(initial) {
    const index = cursor++;
    if (!(index in state)) {
      state[index] = initial;
      setters[index] = (next) => { state[index] = typeof next === "function" ? next(state[index]) : next; };
    }
    return [state[index], setters[index]];
  }
  function registerEffect(callback, nextDependencies) {
    if (!dependencies || nextDependencies.some((value, index) => value !== dependencies[index])) {
      dependencies = nextDependencies;
      effect = callback;
    }
  }
  function memoizeCallback(callback, nextDependencies) {
    const index = cursor++;
    const previous = state[index];
    if (!previous || nextDependencies.some((value, offset) => value !== previous.dependencies[offset])) {
      state[index] = { callback, dependencies: nextDependencies };
    }
    return state[index].callback;
  }
  const react = {
    createContext: () => ({}),
    use() {},
    useState: nextState,
    useCallback: memoizeCallback,
    useEffect: registerEffect,
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  runInNewContext(outputText, {
    exports, AbortController,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name === "@/app/(pages)/login/actions") return { getSession };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return {
    render() {
      cursor = 0;
      const tree = exports.AuthProvider({ children: "application" });
      if (effect) {
        cleanup?.();
        cleanup = effect();
        effect = undefined;
      }
      return tree;
    },
    unmount() { cleanup?.(); },
  };
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object") return [];
  return [node, ...elements(node.props.children)];
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("failed bootstrap keeps public content available and can retry session restoration", async () => {
  const calls = [];
  const harness = providerHarness((signal) => new Promise((resolve, reject) => calls.push({ signal, resolve, reject })));
  assert.ok(elements(harness.render()).some((node) => node.props.role === "status"));
  calls[0].reject(new DOMException("Timed out", "TimeoutError"));
  await settle();
  const failed = harness.render();
  assert.equal(failed.props.value.loading, false);
  assert.ok(elements(failed).some((node) => node.props.role === "alert"));
  assert.ok(failed.props.children.props.children.includes("application"));
  const retry = elements(failed).find((node) => node.type === "button");
  retry.props.onClick();
  harness.render();
  assert.equal(calls.length, 2);
  const session = { nim: "D5001", activeRole: "Admin", authMethod: "sso" };
  calls[1].resolve(session);
  await settle();
  const restored = harness.render();
  assert.equal(restored.props.value.session, session);
  assert.equal(restored.props.value.loading, false);
  assert.ok(!elements(restored).some((node) => node.props.role === "alert"));
  harness.unmount();
});

test("unmounted bootstrap ignores late responses", async () => {
  let finish;
  let signal;
  const harness = providerHarness((requestSignal) => {
    signal = requestSignal;
    return new Promise((resolve) => { finish = resolve; });
  });
  harness.render();
  harness.unmount();
  assert.equal(signal.aborted, true);
  finish({ nim: "late-response" });
  await settle();
  const tree = harness.render();
  assert.equal(tree.props.value.session, null);
  assert.equal(tree.props.value.loading, true);
});

test("successful sign-in clears a bootstrap error and keeps the session setter stable", async () => {
  const harness = providerHarness(async () => { throw new Error("Backend unavailable"); });
  const initial = harness.render();
  await settle();
  const failed = harness.render();
  assert.ok(elements(failed).some((node) => node.props.role === "alert"));
  const setSession = failed.props.value.setSession;
  assert.equal(setSession, initial.props.value.setSession);

  const session = { nim: "D5001", activeRole: "Admin", authMethod: "sso" };
  setSession(session);
  const authenticated = harness.render();
  assert.equal(authenticated.props.value.session, session);
  assert.equal(authenticated.props.value.loading, false);
  assert.equal(authenticated.props.value.setSession, setSession);
  assert.ok(!elements(authenticated).some((node) => node.props.role === "alert"));
  assert.ok(!elements(authenticated).some((node) => node.props.role === "status"));
  assert.ok(authenticated.props.children.props.children.includes("application"));

  setSession(null);
  const signedOut = harness.render();
  assert.equal(signedOut.props.value.session, null);
  assert.equal(signedOut.props.value.setSession, setSession);
  harness.unmount();
});
