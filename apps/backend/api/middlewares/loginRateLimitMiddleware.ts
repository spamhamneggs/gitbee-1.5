import type { Request, RequestHandler, Response } from "express";
import { sendErrorResponse } from "../utils/response/response.js";

type AttemptEntry = {
    windowStartedAt: number;
    failures: number;
    pending: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_IP_FAILURES = 20;
const MAX_ACCOUNT_FAILURES = 5;
const MAX_ENTRIES = 20_000;

export type LoginRateLimitMiddleware = RequestHandler & {
    getTrackedEntryCount(): number;
};

function getAccountKey(email: unknown): string {
    if (typeof email !== "string") return "";
    const normalized = email
        .trim()
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/ß/g, "ss")
        .replace(/ς/g, "σ");
    const atIndex = normalized.lastIndexOf("@");
    const account = atIndex < 0
        ? normalized
        : `${normalized.slice(0, atIndex)}@${normalized.slice(atIndex + 1).replace(/\.+$/, "")}`;
    return account.slice(0, 254);
}

export function createLoginRateLimitMiddleware(options: {
    windowMs?: number;
    maxIpFailures?: number;
    maxAccountFailures?: number;
    maxEntries?: number;
} = {}): LoginRateLimitMiddleware {
    const windowMs = options.windowMs ?? WINDOW_MS;
    const maxIpFailures = options.maxIpFailures ?? MAX_IP_FAILURES;
    const maxAccountFailures = options.maxAccountFailures ?? MAX_ACCOUNT_FAILURES;
    const maxEntries = options.maxEntries ?? MAX_ENTRIES;
    const attempts = new Map<string, AttemptEntry>();
    let cleanupIterator = attempts.keys();

    const pruneExpired = (now: number, budget: number) => {
        for (let scanned = 0; scanned < budget; scanned += 1) {
            let result = cleanupIterator.next();
            if (result.done) {
                cleanupIterator = attempts.keys();
                result = cleanupIterator.next();
                if (result.done) return;
            }

            const entry = attempts.get(result.value);
            if (entry && entry.pending === 0 && now - entry.windowStartedAt >= windowMs) {
                attempts.delete(result.value);
            }
        }
    };

    const middleware: RequestHandler = (req: Request, res: Response, next) => {
        const now = Date.now();
        pruneExpired(now, Math.min(attempts.size, 256));

        const ipKey = `ip:${req.ip}`;
        let ipEntry = attempts.get(ipKey);
        if (ipEntry && ipEntry.pending === 0 && now - ipEntry.windowStartedAt >= windowMs) {
            attempts.delete(ipKey);
            ipEntry = undefined;
        }
        if (ipEntry) {
            if (ipEntry.failures + ipEntry.pending >= maxIpFailures) {
                res.set(
                    "Retry-After",
                    String(Math.ceil((ipEntry.windowStartedAt + windowMs - now) / 1000))
                );
                return sendErrorResponse(res, "Too many login attempts. Please try again later.", 429);
            }
        }

        const account = getAccountKey(req.body?.email);
        const accountKey = account ? `account:${account}` : "";
        let accountEntry = accountKey ? attempts.get(accountKey) : undefined;
        if (accountEntry && accountEntry.pending === 0 && now - accountEntry.windowStartedAt >= windowMs) {
            attempts.delete(accountKey);
            accountEntry = undefined;
        }
        if (accountEntry) {
            if (accountEntry.failures + accountEntry.pending >= maxAccountFailures) {
                res.set(
                    "Retry-After",
                    String(Math.ceil((accountEntry.windowStartedAt + windowMs - now) / 1000))
                );
                return sendErrorResponse(res, "Too many login attempts. Please try again later.", 429);
            }
        }

        const missingEntries = Number(!ipEntry) + Number(Boolean(accountKey && !accountEntry));
        if (attempts.size + missingEntries > maxEntries) {
            res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
            return sendErrorResponse(res, "Login temporarily unavailable. Please try again later.", 429);
        }

        return nextWithEntries();

        function nextWithEntries() {
            const keys = [
                { key: ipKey, entry: ipEntry },
                ...(accountKey ? [{ key: accountKey, entry: accountEntry }] : []),
            ];

            const entries = keys.map(({ key, entry: existing }) => {
                let entry = existing;
                if (!entry) {
                    entry = { windowStartedAt: now, failures: 0, pending: 0 };
                    attempts.set(key, entry);
                }
                return { entry };
            });

            for (const { entry } of entries) entry.pending += 1;
            let completed = false;
            const releasePending = (countFailure: boolean) => {
                if (completed) return;
                completed = true;
                for (const { entry } of entries) {
                    entry.pending = Math.max(0, entry.pending - 1);
                    if (countFailure && res.statusCode >= 400 && res.statusCode !== 429) {
                        entry.failures += 1;
                    }
                }
            };
            res.once("finish", () => {
                releasePending(true);
            });
            res.once("close", () => releasePending(res.writableFinished));

            next();
        }
    };
    return Object.assign(middleware, {
        getTrackedEntryCount: () => attempts.size,
    });
}

export const loginRateLimitMiddleware = createLoginRateLimitMiddleware();
