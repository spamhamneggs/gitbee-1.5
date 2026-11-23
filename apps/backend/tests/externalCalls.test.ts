// Bluejack (semesters) and Atlantis (Microsoft sign-in) through the shared
// client, against a local stand-in server: semester lookups are cached
// (AR-14), failures aren't, and Atlantis still answers the SSO lookup.
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";
import express from "express";
import request from "supertest";
import xlsx from "xlsx";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";

const initialSemesters = [
    { SemesterID: "SEM-2520", Description: "Even Semester 2025/2026" },
    { SemesterID: "SEM-2610", Description: "Odd Semester 2026/2027" },
];
let semesters = initialSemesters;
// When set, every Bluejack path answers with exactly this.
let rawAnswer: { status: number; body: string; type?: string } | null = null;
let hits: Record<string, number> = {};
let failNext = 0;
let delayMs = 0;

const upstream = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    hits[url.pathname] = (hits[url.pathname] ?? 0) + 1;
    const reply = (status: number, body: unknown) => setTimeout(() => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
    }, delayMs);
    if (failNext > 0) {
        failNext -= 1;
        return reply(503, { message: "Bluejack is down" });
    }
    if (rawAnswer && url.pathname.startsWith("/bluejack/")) {
        res.writeHead(rawAnswer.status, { "Content-Type": rawAnswer.type ?? "application/json" });
        return res.end(rawAnswer.body);
    }
    if (url.pathname === "/bluejack/Semester/GetSemestersWithActiveDate") return reply(200, semesters);
    if (url.pathname === "/bluejack/Semester/Active") return reply(200, semesters[1]);
    if (url.pathname === "/atlantis" && url.searchParams.get("input") === "eka@binus.edu") {
        return reply(200, {
            NIM: "", Name: "EKA", BinusianID: "BN200000001", KodeDosen: "D5001",
            email: [{ Email: "eka@binus.edu", isPrefEmail: "1" }],
        });
    }
    return reply(404, { message: "not found" });
});

await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const { port } = upstream.address() as AddressInfo;
process.env.BLUEJACK_API = `http://127.0.0.1:${port}/bluejack/`;
process.env.ATLANTIS_API = `http://127.0.0.1:${port}/atlantis`;

const { default: SemesterService, SEMESTER_CACHE_TTL_MS } = await import("../api/services/semester/semesterService.js");
const { default: AtlantisService } = await import("../api/services/atlantis/atlantisService.js");
const { default: semesterRoutes } = await import("../api/routes/semester/semesterRoutes.js");
const { default: ClassRosterService } = await import("../api/services/class/classRosterService.js");
const { prisma } = await import("../api/prisma/client.js");

const app = express();
app.use("/api/semester", semesterRoutes);

before(() => SemesterService.clearCache());
beforeEach(() => {
    SemesterService.clearCache();
    hits = {};
    failNext = 0;
    delayMs = 0;
    rawAnswer = null;
    semesters = initialSemesters;
});
after(async () => {
    upstream.closeAllConnections();
    upstream.close();
    await prisma.$disconnect();
});

describe("semester lookups", () => {
    it("ask Bluejack once and serve repeat requests from the cache", async () => {
        for (let i = 0; i < 3; i += 1) {
            const all = await request(app).get("/api/semester/all");
            const current = await request(app).get("/api/semester/current");
            assert.equal(all.status, 200);
            assert.deepEqual(all.body.data, semesters);
            assert.deepEqual(current.body.data, semesters[1]);
        }
        // The Excel imports read the semester list through the same cache.
        assert.deepEqual((await SemesterService.getAllSemesterData()).data, semesters);

        assert.deepEqual(hits, {
            "/bluejack/Semester/GetSemestersWithActiveDate": 1,
            "/bluejack/Semester/Active": 1,
        });
    });

    it("share one Bluejack call between concurrent requests", async () => {
        delayMs = 50;
        const responses = await Promise.all(
            Array.from({ length: 5 }, () => request(app).get("/api/semester/current"))
        );

        assert.ok(responses.every((response) => response.status === 200));
        assert.equal(hits["/bluejack/Semester/Active"], 1);
    });

    it("don't cache a failure, so the next request asks again", async () => {
        failNext = 1;
        const failed = await request(app).get("/api/semester/all");
        const retried = await request(app).get("/api/semester/all");

        assert.equal(failed.status, 400);
        assert.deepEqual(failed.body.errors, { message: "Bluejack is down" });
        assert.equal(retried.status, 200);
        assert.equal(hits["/bluejack/Semester/GetSemestersWithActiveDate"], 2);
    });

    it("ask Bluejack again once the cached answer is an hour old", async (t) => {
        t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
        await SemesterService.getCurrentSemesterData();
        t.mock.timers.tick(SEMESTER_CACHE_TTL_MS - 1);
        await SemesterService.getCurrentSemesterData();
        assert.equal(hits["/bluejack/Semester/Active"], 1);

        t.mock.timers.tick(2);
        await SemesterService.getCurrentSemesterData();
        assert.equal(hits["/bluejack/Semester/Active"], 2);
    });

    it("pass odd answers on as before, without caching them", async () => {
        for (const answer of [
            { status: 200, body: "<html>Please sign in to the proxy</html>", type: "text/html" },
            { status: 200, body: "[]" },
            { status: 200, body: '{"error":"maintenance"}' },
            { status: 200, body: '"Semester service paused"' },
            { status: 200, body: '[{"SemesterID": "SEM-2610"' },
            { status: 200, body: '[{"Description":"Odd Semester 2026/2027"}]' },
        ]) {
            SemesterService.clearCache();
            hits = {};
            rawAnswer = answer;
            const first = await request(app).get("/api/semester/all");
            await request(app).get("/api/semester/all");

            assert.equal(first.status, 200, answer.body);
            assert.equal(hits["/bluejack/Semester/GetSemestersWithActiveDate"], 2, `not cached: ${answer.body}`);
        }
    });

    it("cache the active semester whichever way its id is capitalised, and nothing else", async () => {
        for (const [body, cached] of [
            ['{"SemesterId":"SEM-2610","Description":"Odd Semester 2026/2027"}', true],
            ['{"SemesterID":"SEM-2610"}', true],
            ['{"message":"no active semester"}', false],
            ["[]", false],
        ] as const) {
            SemesterService.clearCache();
            hits = {};
            rawAnswer = { status: 200, body };
            await request(app).get("/api/semester/current");
            await request(app).get("/api/semester/current");

            assert.equal(hits["/bluejack/Semester/Active"], cached ? 1 : 2, body);
        }
    });

    it("skip and refresh the cache for a fresh lookup", async () => {
        await SemesterService.getAllSemesterData();
        semesters = [...initialSemesters, { SemesterID: "SEM-2620", Description: "Even Semester 2026/2027" }];

        assert.equal(((await SemesterService.getAllSemesterData()).data as unknown[]).length, 2, "still cached");
        assert.equal(((await SemesterService.getAllSemesterData({ fresh: true })).data as unknown[]).length, 3);
        assert.equal(((await SemesterService.getAllSemesterData()).data as unknown[]).length, 3, "cache refreshed");
        assert.equal(hits["/bluejack/Semester/GetSemestersWithActiveDate"], 2);
    });

    it("let an Excel import use a semester Bluejack added after the list was cached", async (t) => {
        const inserted: { semester_id: string }[][] = [];
        const original = prisma.classTransaction.createMany;
        prisma.classTransaction.createMany = (async (args: { data: { semester_id: string }[] }) => {
            inserted.push(args.data);
            return { count: args.data.length };
        }) as unknown as typeof original;
        t.after(() => { prisma.classTransaction.createMany = original; });
        const sheet = (term: number) => xlsx.write({ SheetNames: ["S"], Sheets: { S: xlsx.utils.aoa_to_sheet([
            ["term", "lecturer_name", "lecturer_code", "course_code", "course_name", "class", "location"],
            [term, "Eka", "D5001", "COMP6100001", "Software Engineering", "LA01", "Kemanggisan"],
        ]) } }, { type: "buffer", bookType: "xlsx" });

        await ClassRosterService.importClassTransactionsFromExcel(sheet(2610)); // caches the list
        semesters = [...initialSemesters, { SemesterID: "SEM-2620", Description: "Even Semester 2026/2027" }];
        await ClassRosterService.importClassTransactionsFromExcel(sheet(2620));

        assert.equal(inserted[1]?.[0]?.semester_id, "SEM-2620");
        // A term Bluejack has never heard of still fails, after one fresh look.
        await assert.rejects(ClassRosterService.importClassTransactionsFromExcel(sheet(2710)), /Invalid semester information/);
        // An unparseable term fails without asking Bluejack again.
        const before = hits["/bluejack/Semester/GetSemestersWithActiveDate"];
        await assert.rejects(ClassRosterService.importClassTransactionsFromExcel(sheet(1999)), /Invalid semester information/);
        assert.equal(hits["/bluejack/Semester/GetSemestersWithActiveDate"], before);
    });
});

describe("Atlantis lookup for Microsoft sign-in", () => {
    it("returns the account through the shared client", async () => {
        const result = await AtlantisService.getAtlantisData("eka@binus.edu");

        assert.equal(result.status, true);
        assert.equal((result.data as { KodeDosen: string }).KodeDosen, "D5001");
        assert.equal(hits["/atlantis"], 1);
    });

    it("reports a missing account as a failure with no data", async () => {
        const result = await AtlantisService.getAtlantisData("nobody@binus.edu");

        assert.equal(result.status, false);
        assert.equal(result.data, null);
    });

    it("makes no call when ATLANTIS_API isn't set", async (t) => {
        const configured = process.env.ATLANTIS_API;
        delete process.env.ATLANTIS_API;
        t.after(() => { process.env.ATLANTIS_API = configured; });

        const result = await AtlantisService.getAtlantisData("eka@binus.edu");

        assert.equal(result.status, false);
        assert.equal(hits["/atlantis"], undefined);
    });
});
