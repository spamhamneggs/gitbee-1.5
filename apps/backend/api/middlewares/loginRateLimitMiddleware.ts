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

const UNICODE_DIGIT_ZEROS = [
    0x0030, 0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6,
    0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0de6, 0x0e50, 0x0ed0,
    0x0f20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80,
    0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900,
    0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10, 0x104a0, 0x10d30, 0x11066,
    0x110f0, 0x11136, 0x111d0, 0x112f0, 0x11450, 0x114d0, 0x11650,
    0x116c0, 0x11730, 0x118e0, 0x11950, 0x11c50, 0x11d50, 0x11da0,
    0x11f50, 0x16a60, 0x16ac0, 0x16b50, 0x1d7ce, 0x1d7d8, 0x1d7e2,
    0x1d7ec, 0x1d7f6, 0x1e140, 0x1e2f0, 0x1e4f0, 0x1e950, 0x1fbf0,
];

function foldUnicodeDigits(value: string): string {
    return value.replace(/\p{Nd}/gu, (ch) => {
        const cp = ch.codePointAt(0)!;
        for (let i = UNICODE_DIGIT_ZEROS.length - 1; i >= 0; i -= 1) {
            const base = UNICODE_DIGIT_ZEROS[i]!;
            if (cp >= base && cp <= base + 9) {
                return String(cp - base);
            }
        }
        return ch;
    });
}

function getAccountKey(email: unknown): string {
    if (typeof email !== "string" || email.length > 1024) return "";
    const trimmed = email.trim();
    if (trimmed.length === 0 || trimmed.length > 255) return "";
    const normalized = foldUnicodeDigits(
        trimmed
            .normalize("NFKD")
            .replace(/\p{M}/gu, "")
    )
        .toLowerCase()
        .replace(/\u00df/g, "ss")
        .replace(/\u03c2/g, "\u03c3");
    const atIndex = normalized.lastIndexOf("@");
    const account = atIndex < 0
        ? normalized
        : `${normalized.slice(0, atIndex)}@${normalized.slice(atIndex + 1).replace(/\.+$/, "")}`;
    return account.slice(0, 254);
}

function getDefaultAccountKey(body: unknown): string {
    if (!body || typeof body !== "object") return "";
    const { identifier, email } = body as { identifier?: unknown; email?: unknown };
    const effectiveIdentifier =
        typeof identifier === "string" && identifier.trim().length > 0
            ? identifier
            : email;
    return getAccountKey(effectiveIdentifier);
}

export function createLoginRateLimitMiddleware(options: {
    windowMs?: number;
    maxIpFailures?: number;
    maxAccountFailures?: number;
    maxEntries?: number;
    accountKey?: (req: Request, res: Response) => string;
}, handler: RequestHandler): LoginRateLimitMiddleware {
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

    const middleware: RequestHandler = async (req: Request, res: Response, next) => {
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
                    String(Math.max(1, Math.ceil((ipEntry.windowStartedAt + windowMs - now) / 1000)))
                );
                return sendErrorResponse(res, "Too many login attempts. Please try again later.", 429);
            }
        }

        const account = options.accountKey?.(req, res) ?? getDefaultAccountKey(req.body);
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
                    String(Math.max(1, Math.ceil((accountEntry.windowStartedAt + windowMs - now) / 1000)))
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

        async function nextWithEntries() {
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
            let handlerFinished = false;
            let responseFinished = false;
            let aborted = false;
            const releasePending = () => {
                if (completed || !handlerFinished || (!responseFinished && !aborted)) return;
                completed = true;
                for (const { entry } of entries) {
                    entry.pending = Math.max(0, entry.pending - 1);
                    if (aborted || (res.statusCode >= 400 && res.statusCode !== 429)) {
                        entry.failures += 1;
                    }
                }
            };
            res.once("finish", () => {
                responseFinished = true;
                releasePending();
            });
            res.once("close", () => {
                aborted = !res.writableFinished;
                releasePending();
            });

            try {
                await handler(req, res, next);
            } catch (error) {
                next(error);
            } finally {
                // Closing a socket does not cancel database queries or password hashing.
                handlerFinished = true;
                releasePending();
            }
        }
    };
    return Object.assign(middleware, {
        getTrackedEntryCount: () => attempts.size,
    });
}
