import { defaultResponse } from "../../models/generic/response.js";
import type { APIResponse } from "../../models/generic/response.js";
import { getErrors } from "../../utils/response/response.js";
import { externalApi } from "../../utils/http/externalApi.js";

/**
 * Semesters change twice a year, so one Bluejack answer serves every request
 * for an hour. The longest a new semester can lag behind Bluejack is this long.
 */
export const SEMESTER_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * A semester answer. `fromCache`: it came from the cache rather than a Bluejack
 * call made for it. `usable`: it has the fields callers read, as opposed to a
 * failure or an odd answer passed on as is.
 */
export type SemesterResult = APIResponse & { fromCache: boolean; usable: boolean };

interface CacheEntry {
    expiresAt: number;
    response: APIResponse;
}

// Keyed by full URL. Only answers that callers can use are kept: a failure, or
// an odd answer such as a proxy's HTML page or an empty list, is passed on
// once (as before caching) and the next request asks Bluejack again. A cached
// answer stays in place while a refresh runs, and only a usable answer
// replaces it. After the hour it is still used whenever a refresh fails.
const cache = new Map<string, CacheEntry>();
// At most one Bluejack call per URL at a time; everyone who needs it shares it.
const inFlight = new Map<string, Promise<APIResponse>>();
// Bumped by clearCache, so a call that was already running can't refill the cache.
let generation = 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
const isFilled = (value: unknown) => typeof value === "string" && value.trim() !== "";

// The fields the callers read. The list spells the id SemesterID (the Excel
// imports and the semester menu use it with Description); the active semester
// spells it SemesterId (the dashboards use it, and the menu shows Description).
const isSemesterList = (value: unknown) =>
    Array.isArray(value) && value.length > 0 &&
    value.every((item) => isRecord(item) && isFilled(item.SemesterID) && isFilled(item.Description));
const isActiveSemester = (value: unknown) =>
    isRecord(value) && isFilled(value.SemesterId) && isFilled(value.Description);

async function fetchFromBluejack(url: string): Promise<APIResponse> {
    try {
        const res = await externalApi().get(url);
        return {
            message: "successful",
            status: true,
            data: res.data,
        };
    } catch (error) {
        return {
            ...defaultResponse,
            errors: getErrors(error),
            data: null,
        };
    }
}

function refresh(url: string, isUsable: (data: unknown) => boolean): Promise<APIResponse> {
    let pending = inFlight.get(url);
    if (!pending) {
        const startedIn = generation;
        pending = fetchFromBluejack(url)
            .then((result) => {
                if (startedIn === generation && result.status === true && isUsable(result.data)) {
                    cache.set(url, { expiresAt: Date.now() + SEMESTER_CACHE_TTL_MS, response: result });
                }
                return result;
            })
            .finally(() => {
                if (inFlight.get(url) === pending) inFlight.delete(url);
            });
        inFlight.set(url, pending);
    }
    return pending;
}

async function getSemesters(path: string, isUsable: (data: unknown) => boolean, fresh = false): Promise<SemesterResult> {
    const url = `${process.env.BLUEJACK_API}${path}`;
    const cached = cache.get(url);
    if (!fresh && cached && cached.expiresAt > Date.now()) {
        return { ...cached.response, fromCache: true, usable: true };
    }
    const result = await refresh(url, isUsable);
    if (result.status === true && isUsable(result.data)) {
        return { ...result, fromCache: false, usable: true };
    }
    // Bluejack failed or sent something unusable. An hour-old list still beats
    // an error, except for a fresh lookup, whose caller needs to know.
    const stale = cache.get(url);
    if (!fresh && stale) {
        return { ...stale.response, fromCache: true, usable: true };
    }
    return { ...result, fromCache: false, usable: false };
}

export default class SemesterService {
    /**
     * Every semester. `fresh` skips the cache (and refreshes it if Bluejack's
     * answer is usable), and returns Bluejack's failure rather than the cached list.
     */
    static getAllSemesterData(options: { fresh?: boolean } = {}): Promise<SemesterResult> {
        return getSemesters("Semester/GetSemestersWithActiveDate", isSemesterList, options.fresh);
    }

    static getCurrentSemesterData(): Promise<SemesterResult> {
        return getSemesters("Semester/Active", isActiveSemester);
    }

    /** Forgets every cached semester response (tests, or after Bluejack changes). */
    static clearCache() {
        generation += 1;
        cache.clear();
        inFlight.clear();
    }
}
