// The shared client for Bluejack and Atlantis (AR-14, GB-09): a deadline on
// every call, certificate verification always on, and an optional extra CA
// that applies to this client only.
import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import tls from "node:tls";
import { after, describe, it } from "node:test";
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
const upstream = http.createServer((req, res) => {
    if (req.url === "/trickle") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.write("[");
        let sent = 0;
        const timer = setInterval(() => {
            if (++sent < 30) return void res.write(" ");
            clearInterval(timer);
            res.end("]");
        }, 100);
        res.on("close", () => clearInterval(timer));
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

describe("external API client", () => {
    it("gives every call a 5 second timeout and the default trust store", () => {
        const client = externalApi();

        assert.equal(EXTERNAL_API_TIMEOUT_MS, 5_000);
        assert.equal(client.defaults.timeout, 5_000);
        assert.equal(client.defaults.httpsAgent, undefined);
        assert.equal(externalApi(), client, "one shared instance");
    });

    it("trusts EXTERNAL_API_CA_FILE in addition to the public roots, for this client only", () => {
        const client = createExternalApi({ EXTERNAL_API_CA_FILE: fixture("test-ca.pem") });
        const options = client.defaults.httpsAgent.options;

        assert.equal(client.defaults.timeout, 5_000);
        assert.deepEqual(options.ca.slice(-1), [testCa]);
        assert.equal(options.ca.length, tls.rootCertificates.length + 1);
        assert.notEqual(options.rejectUnauthorized, false);
        assert.equal(externalApi().defaults.httpsAgent, undefined, "the shared client is unaffected");
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
