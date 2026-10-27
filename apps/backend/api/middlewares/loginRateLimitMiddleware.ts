import type { Request, RequestHandler, Response } from "express";
import { sendErrorResponse } from "../utils/response/response.js";

type AttemptEntry = {
    windowStartedAt: number;
    failures: number;
    pending: number;
    lastSeenAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_IP_FAILURES = 20;
const MAX_ACCOUNT_FAILURES = 5;
const MAX_ENTRIES = 20_000;

export function createLoginRateLimitMiddleware(options: {
    windowMs?: number;
    maxIpFailures?: number;
    maxAccountFailures?: number;
} = {}): RequestHandler {
    const windowMs = options.windowMs ?? WINDOW_MS;
    const maxIpFailures = options.maxIpFailures ?? MAX_IP_FAILURES;
    const maxAccountFailures = options.maxAccountFailures ?? MAX_ACCOUNT_FAILURES;
    const attempts = new Map<string, AttemptEntry>();

    return (req: Request, res: Response, next) => {
        const now = Date.now();
        for (const [key, entry] of attempts) {
            if (now - entry.lastSeenAt >= windowMs) attempts.delete(key);
        }

        const account = typeof req.body?.email === "string"
            ? req.body.email.slice(0, 254).trim().toLowerCase()
            : "";
        const keys = [
            { key: `ip:${req.ip}`, limit: maxIpFailures },
            ...(account ? [{ key: `account:${account}`, limit: maxAccountFailures }] : []),
        ];

        const entries = keys.map(({ key, limit }) => {
            let entry = attempts.get(key);
            if (!entry || now - entry.windowStartedAt >= windowMs) {
                entry = { windowStartedAt: now, failures: 0, pending: 0, lastSeenAt: now };
                attempts.set(key, entry);
            }
            entry.lastSeenAt = now;
            return { entry, limit };
        });

        const blockedEntries = entries.filter(
            ({ entry, limit }) => entry.failures + entry.pending >= limit
        );
        if (blockedEntries.length > 0) {
            const retryAfter = Math.max(
                ...blockedEntries.map(({ entry }) =>
                    Math.ceil((entry.windowStartedAt + windowMs - now) / 1000)
                )
            );
            res.set("Retry-After", String(retryAfter));
            return sendErrorResponse(res, "Too many login attempts. Please try again later.", 429);
        }

        for (const { entry } of entries) entry.pending += 1;
        res.once("finish", () => {
            for (const { entry } of entries) {
                entry.pending = Math.max(0, entry.pending - 1);
                if (res.statusCode >= 400 && res.statusCode !== 429) entry.failures += 1;
                entry.lastSeenAt = Date.now();
            }
        });

        if (attempts.size > MAX_ENTRIES) {
            const oldestEntries = [...attempts.entries()]
                .sort(([, left], [, right]) => left.lastSeenAt - right.lastSeenAt)
                .slice(0, attempts.size - MAX_ENTRIES);
            for (const [key] of oldestEntries) attempts.delete(key);
        }

        next();
    };
}

export const loginRateLimitMiddleware = createLoginRateLimitMiddleware();
