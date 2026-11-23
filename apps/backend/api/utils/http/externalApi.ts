import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";
import tls from "node:tls";
import axios, { AxiosError, type AxiosInstance } from "axios";

/** How long a Bluejack or Atlantis call may take before it fails (AR-14). */
export const EXTERNAL_API_TIMEOUT_MS = 5_000;

/**
 * The certificates in a CA file, as PEM. Accepts PEM (one or several
 * certificates) or a single DER certificate; anything else is a startup error
 * rather than a client that silently trusts nothing extra.
 */
function readCaCertificates(caFile: string): string[] {
    let raw: Buffer;
    try {
        raw = readFileSync(caFile);
    } catch (error) {
        throw new Error(`EXTERNAL_API_CA_FILE could not be read: ${caFile}`, { cause: error });
    }
    const pemBlocks = raw.toString("utf8").match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
    try {
        const certificates = pemBlocks
            ? pemBlocks.map((block) => new X509Certificate(block))
            : [new X509Certificate(raw)];
        return certificates.map((certificate) => certificate.toString());
    } catch (error) {
        throw new Error(`EXTERNAL_API_CA_FILE has no valid certificate (expected PEM or DER): ${caFile}`, { cause: error });
    }
}

/**
 * The HTTP client for BINUS's external APIs: Bluejack (semesters) and the
 * Atlantis lookup on Microsoft sign-in. Certificates are always verified
 * (GB-09). If one of those servers uses a certificate from a private CA, as a
 * dev instance might, set EXTERNAL_API_CA_FILE to that CA's certificate file:
 * this client then trusts it as well, and nothing else in the process does.
 */
export function createExternalApi(env: NodeJS.ProcessEnv = process.env, timeout = EXTERNAL_API_TIMEOUT_MS): AxiosInstance {
    const caFile = env.EXTERNAL_API_CA_FILE?.trim();
    const client = caFile
        // `ca` replaces Node's default trust store, so keep the public roots too.
        ? axios.create({ timeout, httpsAgent: new https.Agent({ ca: [...tls.rootCertificates, ...readCaCertificates(caFile)] }) })
        : axios.create({ timeout });

    // axios's `timeout` only fires while the connection is idle, so a server
    // that keeps sending a byte at a time could hold a call open indefinitely.
    // This deadline covers the whole call, body included.
    client.interceptors.request.use((config) => {
        config.signal ??= AbortSignal.timeout(timeout);
        return config;
    });
    client.interceptors.response.use(undefined, (error: unknown) => {
        const signal = (error as AxiosError).config?.signal as AbortSignal | undefined;
        if (axios.isCancel(error) && (signal?.reason as { name?: string } | undefined)?.name === "TimeoutError") {
            throw new AxiosError(`timeout of ${timeout}ms exceeded`, AxiosError.ECONNABORTED, (error as AxiosError).config);
        }
        throw error;
    });
    return client;
}

let sharedClient: AxiosInstance | undefined;

/** The shared client, created on first use so it sees the loaded .env. */
export function externalApi(): AxiosInstance {
    sharedClient ??= createExternalApi();
    return sharedClient;
}
