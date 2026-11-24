import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";
import { setTimeout as sleep } from "node:timers/promises";
import tls from "node:tls";
import axios, { AxiosError, type AxiosInstance } from "axios";

/** How long a Bluejack or Atlantis call may take before it fails (AR-14). */
export const EXTERNAL_API_TIMEOUT_MS = 5_000;

// A GET that fails in a way that often clears up by itself gets one more try
// (AR-14), inside the same deadline: a gateway error, or a dropped or refused
// connection. Timeouts aren't retried, since the deadline has run out.
const RETRY_STATUSES = new Set([502, 503, 504]);
const RETRY_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "EPIPE", "EAI_AGAIN"]);
const RETRY_DELAY_MS = 100;
/** Less of the deadline than this left after the pause, and the retry is skipped. */
const MIN_RETRY_MS = 500;

const isRetryable = (error: AxiosError) => {
    if ((error.config?.method ?? "get").toLowerCase() !== "get") return false;
    if (error.response) return RETRY_STATUSES.has(error.response.status);
    return RETRY_CODES.has(error.code ?? "");
};

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
        // `ca` replaces the CAs Node would otherwise trust, so start from those:
        // the bundled roots plus any added with NODE_EXTRA_CA_CERTS or the system store.
        ? axios.create({ timeout, httpsAgent: new https.Agent({ ca: [...tls.getCACertificates("default"), ...readCaCertificates(caFile)] }) })
        : axios.create({ timeout });

    // axios's `timeout` only fires while the connection is idle, so a server
    // that keeps sending a byte at a time could hold a call open indefinitely.
    // This deadline covers the whole call, body included, and a retry shares it.
    const deadlines = new WeakMap<AbortSignal, { at: number; retried: boolean }>();
    client.interceptors.request.use((config) => {
        if (!config.signal) {
            const signal = AbortSignal.timeout(timeout);
            deadlines.set(signal, { at: Date.now() + timeout, retried: false });
            config.signal = signal;
        }
        return config;
    });
    client.interceptors.response.use(undefined, async (error: unknown) => {
        const config = (error as AxiosError).config;
        const signal = config?.signal as AbortSignal | undefined;
        const deadline = signal ? deadlines.get(signal) : undefined;
        if (config && deadline && !deadline.retried && axios.isAxiosError(error) && isRetryable(error)
            && deadline.at - Date.now() - RETRY_DELAY_MS >= MIN_RETRY_MS) {
            deadline.retried = true;
            await sleep(RETRY_DELAY_MS);
            // Same config, so the same signal: the retry ends at the original deadline.
            return client.request(config);
        }
        if (axios.isCancel(error) && (signal?.reason as { name?: string } | undefined)?.name === "TimeoutError") {
            throw new AxiosError(`timeout of ${timeout}ms exceeded`, AxiosError.ECONNABORTED, config);
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
