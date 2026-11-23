import { defaultResponse } from "../../models/generic/response.js";
import type { APIResponse } from "../../models/generic/response.js";
import { getErrors } from "../../utils/response/response.js";
import { externalApi } from "../../utils/http/externalApi.js";

/**
 * Semesters change twice a year, so one Bluejack answer serves every request
 * for an hour. The longest a new semester can lag behind Bluejack is this long.
 */
export const SEMESTER_CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
    expiresAt: number;
    response: Promise<APIResponse>;
}

// Keyed by full URL. Concurrent requests share one in-flight call. Only
// answers that look like semesters are kept: a failure, or an odd answer such
// as a proxy's HTML page or an empty list, is passed on once (as before
// caching) and the next request asks Bluejack again.
const cache = new Map<string, CacheEntry>();

// The two endpoints spell the id differently (SemesterID in the list,
// SemesterId for the active one), so match the key without case.
const isSemester = (value: unknown) =>
    typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.keys(value).some((key) => key.toLowerCase() === "semesterid");
const isSemesterList = (value: unknown) =>
    Array.isArray(value) && value.length > 0 && value.every(isSemester);

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

function getCached(path: string, isCacheable: (data: unknown) => boolean, fresh = false): Promise<APIResponse> {
    const url = `${process.env.BLUEJACK_API}${path}`;
    const now = Date.now();
    const cached = cache.get(url);
    if (!fresh && cached && cached.expiresAt > now) {
        return cached.response;
    }

    const entry: CacheEntry = {
        expiresAt: now + SEMESTER_CACHE_TTL_MS,
        response: fetchFromBluejack(url).then((result) => {
            if (!(result.status === true && isCacheable(result.data)) && cache.get(url) === entry) {
                cache.delete(url);
            }
            return result;
        }),
    };
    cache.set(url, entry);
    return entry.response;
}

export default class SemesterService {
    /** Every semester. `fresh` skips the cache (and refreshes it). */
    static getAllSemesterData(options: { fresh?: boolean } = {}): Promise<APIResponse> {
        return getCached("Semester/GetSemestersWithActiveDate", isSemesterList, options.fresh);
    }

    static getCurrentSemesterData(): Promise<APIResponse> {
        return getCached("Semester/Active", isSemester);
    }

    /** Forgets every cached semester response (tests, or after Bluejack changes). */
    static clearCache() {
        cache.clear();
    }
}
