// The shared client for Bluejack and Atlantis (AR-14, GB-09): a deadline on
// every call, one retry for a GET that fails in a passing way, certificate
// verification always on, and an optional extra CA that applies to this
// client only.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import tls from "node:tls";
import { pathToFileURL } from "node:url";
import { after, beforeEach, describe, it } from "node:test";
import {
    createExternalApi,
    EXTERNAL_API_TIMEOUT_MS,
    externalApi,
} from "../api/utils/http/externalApi.js";

const fixture = (name: string) => path.join(import.meta.dirname, "fixtures", name);
const testCa = new X509Certificate(readFileSync(fixture("test-ca.pem"))).toString();
const otherCa = new X509Certificate(readFileSync(fixture("other-ca.pem"))).toString();

const tempDir = mkdtempSync(path.join(tmpdir(), "gitbee-external-api-"));
const tempFile = (name: string, contents: string | Buffer) => {
    const file = path.join(tempDir, name);
    writeFileSync(file, contents);
    return file;
};

// /silent accepts the request and never answers; /trickle answers at once,
// then sends one byte every 100 ms for 3 s, so the connection is never idle.
// The rest fail in a set way on their first request (`first`) or every time
// (`always`), and answer {"ok":true} otherwise. Requests are counted per
// method and path in `hits`.
let hits: Record<string, number> = {};
const upstream = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    const key = `${req.method} ${url.pathname}`;
    const count = (hits[key] = (hits[key] ?? 0) + 1);
    const ok = () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
    };
    const status = (code: number, afterMs = 0) => setTimeout(() => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(`{"status":${code}}`);
    }, afterMs);
    if (url.pathname === "/trickle") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.write("[");
        let sent = 0;
        const timer = setInterval(() => {
            if (++sent < 30) return void res.write(" ");
            clearInterval(timer);
            res.end("]");
        }, 100);
        res.on("close", () => clearInterval(timer));
    } else if (url.pathname === "/first") {
        // ?status=503 answers that status once; ?drop drops the first connection.
        if (count > 1) return ok();
        if (url.searchParams.has("drop")) return void req.socket.destroy();
        status(Number(url.searchParams.get("status")));
    } else if (url.pathname === "/always") {
        status(Number(url.searchParams.get("status")), Number(url.searchParams.get("after") ?? 0));
    } else if (url.pathname === "/first-then-silent") {
        // A quick 503, then a retry that never gets an answer.
        if (count === 1) status(503);
    }
});
await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const upstreamUrl = (route: string) => `http://127.0.0.1:${(upstream.address() as AddressInfo).port}${route}`;
after(() => {
    rmSync(tempDir, { recursive: true, force: true });
    // Also ends a request left hanging if the deadline regresses.
    upstream.closeAllConnections();
    upstream.close();
});

const expectTimeout = (ms: number) => (error: { code?: string; message: string }) =>
    error.code === "ECONNABORTED" && error.message === `timeout of ${ms}ms exceeded`;
const expectStatus = (status: number) => (error: { response?: { status: number } }) => error.response?.status === status;
const fingerprints = (pems: string[]) => pems.map((pem) => new X509Certificate(pem).fingerprint256);

beforeEach(() => { hits = {}; });

describe("external API client", () => {
    it("gives every call a 5 second timeout and the default trust store", () => {
        const client = externalApi();

        assert.equal(EXTERNAL_API_TIMEOUT_MS, 5_000);
        assert.equal(client.defaults.timeout, 5_000);
        assert.equal(client.defaults.httpsAgent, undefined);
        assert.equal(externalApi(), client, "one shared instance");
    });

    it("trusts EXTERNAL_API_CA_FILE in addition to Node's own CAs, for this client only", () => {
        const client = createExternalApi({ EXTERNAL_API_CA_FILE: fixture("test-ca.pem") });
        const options = client.defaults.httpsAgent.options;

        assert.equal(client.defaults.timeout, 5_000);
        assert.deepEqual(options.ca, [...tls.getCACertificates("default"), testCa]);
        assert.notEqual(options.rejectUnauthorized, false);
        assert.equal(externalApi().defaults.httpsAgent, undefined, "the shared client is unaffected");
    });

    it("keeps a CA that Node was started with through NODE_EXTRA_CA_CERTS", () => {
        // Node reads NODE_EXTRA_CA_CERTS only at startup, so check in a fresh process.
        const moduleUrl = pathToFileURL(path.join(import.meta.dirname, "../api/utils/http/externalApi.ts")).href;
        const probe = tempFile("probe.mts", [
            `const { createExternalApi } = await import(${JSON.stringify(moduleUrl)});`,
            `const client = createExternalApi({ EXTERNAL_API_CA_FILE: ${JSON.stringify(fixture("test-ca.pem"))} });`,
            "console.log(JSON.stringify(client.defaults.httpsAgent.options.ca));",
        ].join("\n"));
        const tsx = path.join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
        const result = spawnSync(process.execPath, [tsx, probe], {
            env: { ...process.env, NODE_EXTRA_CA_CERTS: fixture("other-ca.pem") },
            encoding: "utf8",
        });
        assert.equal(result.status, 0, result.stderr);
        const trusted = fingerprints(JSON.parse(result.stdout.trim().split("\n").at(-1)!));

        assert.ok(trusted.includes(fingerprints([otherCa])[0]!), "the NODE_EXTRA_CA_CERTS CA is still trusted");
        assert.equal(trusted.at(-1), fingerprints([testCa])[0], "EXTERNAL_API_CA_FILE is added");
    });

    it("reads every certificate in a bundle, a DER file, and a padded path", () => {
        const bundle = tempFile("bundle.pem", `${otherCa}\n${readFileSync(fixture("test-ca.pem"), "utf8")}`);
        const der = tempFile("ca.der", new X509Certificate(testCa).raw);

        assert.deepEqual(createExternalApi({ EXTERNAL_API_CA_FILE: bundle }).defaults.httpsAgent.options.ca.slice(-2), [otherCa, testCa]);
        assert.deepEqual(createExternalApi({ EXTERNAL_API_CA_FILE: der }).defaults.httpsAgent.options.ca.slice(-1), [testCa]);
        assert.ok(createExternalApi({ EXTERNAL_API_CA_FILE: `  ${fixture("test-ca.pem")}  ` }).defaults.httpsAgent);
        assert.equal(createExternalApi({ EXTERNAL_API_CA_FILE: "   " }).defaults.httpsAgent, undefined);
    });

    it("refuses a CA file it can't use, naming the variable", () => {
        assert.throws(() => createExternalApi({ EXTERNAL_API_CA_FILE: path.join(tempDir, "missing.pem") }),
            /EXTERNAL_API_CA_FILE could not be read/);
        assert.throws(() => createExternalApi({ EXTERNAL_API_CA_FILE: tempDir }), /EXTERNAL_API_CA_FILE could not be read/);
        for (const [name, contents] of [
            ["empty.pem", ""],
            ["garbage.pem", "not a certificate\n"],
            ["key.pem", "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIA==\n-----END PRIVATE KEY-----\n"],
            ["broken.pem", "-----BEGIN CERTIFICATE-----\nbm90IGEgY2VydA==\n-----END CERTIFICATE-----\n"],
        ]) {
            assert.throws(() => createExternalApi({ EXTERNAL_API_CA_FILE: tempFile(name!, contents!) }),
                /EXTERNAL_API_CA_FILE has no valid certificate/, name);
        }
    });

    // Without a deadline these calls would wait; the test limits turn that into a failure.
    it("abandons a call that gets no answer within the timeout", { timeout: 3_000 }, async () => {
        const started = Date.now();
        await assert.rejects(createExternalApi({}, 200).get(upstreamUrl("/silent")), expectTimeout(200));
        assert.ok(Date.now() - started < 2_000);
    });

    it("abandons a call whose body keeps trickling in past the timeout", { timeout: 2_500 }, async () => {
        const started = Date.now();
        await assert.rejects(createExternalApi({}, 300).get(upstreamUrl("/trickle")), expectTimeout(300));
        assert.ok(Date.now() - started < 1_500);
    });

    it("leaves a caller's own abort signal alone", async () => {
        const controller = new AbortController();
        const call = createExternalApi({}, 2_000).get(upstreamUrl("/silent"), { signal: controller.signal });
        controller.abort();
        await assert.rejects(call, (error: { code?: string }) => error.code === "ERR_CANCELED");
    });

    it("recovers a GET from one gateway error or dropped connection, in the same call", async () => {
        const client = createExternalApi({}, 2_000);
        for (const query of ["status=502", "status=503", "status=504", "drop"]) {
            hits = {};
            const response = await client.get(upstreamUrl(`/first?${query}`));

            assert.deepEqual(response.data, { ok: true }, query);
            assert.equal(hits["GET /first"], 2, query);
        }
    });

    it("tries a failing GET only twice, and doesn't retry other failures or other methods", async () => {
        const client = createExternalApi({}, 2_000);

        await assert.rejects(client.get(upstreamUrl("/always?status=503")), expectStatus(503));
        assert.equal(hits["GET /always"], 2);
        await assert.rejects(client.get(upstreamUrl("/always?status=404")), expectStatus(404));
        await assert.rejects(client.get(upstreamUrl("/always?status=500")), expectStatus(500));
        assert.equal(hits["GET /always"], 4, "a 404 or 500 isn't retried");
        await assert.rejects(client.post(upstreamUrl("/first?status=503")), expectStatus(503));
        assert.equal(hits["POST /first"], 1, "only GETs are retried");
    });

    it("keeps a retry inside the original deadline", { timeout: 3_000 }, async () => {
        const started = Date.now();
        await assert.rejects(createExternalApi({}, 1_000).get(upstreamUrl("/first-then-silent")), expectTimeout(1_000));

        assert.equal(hits["GET /first-then-silent"], 2, "retried after the 503");
        assert.ok(Date.now() - started < 1_500, "one deadline for both tries");
    });

    it("skips the retry when too little of the deadline is left for it", async () => {
        await assert.rejects(createExternalApi({}, 800).get(upstreamUrl("/always?status=503&after=400")), expectStatus(503));
        assert.equal(hits["GET /always"], 1);
    });

    it("leaves certificate verification on everywhere in the backend", () => {
        const sourceFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
            const file = path.join(dir, name);
            if (statSync(file).isDirectory()) return name === "generated" ? [] : sourceFiles(file);
            return file.endsWith(".ts") ? [file] : [];
        });
        const offenders = sourceFiles(path.join(import.meta.dirname, "../api")).filter((file) =>
            /NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized\s*:\s*false/.test(readFileSync(file, "utf8"))
        );
        assert.deepEqual(offenders, []);
    });
});
