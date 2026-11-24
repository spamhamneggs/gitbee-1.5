// Bluejack (semesters) and Atlantis (Microsoft sign-in) through the shared
// client, against a local stand-in server: semester lookups are cached
// (AR-14) and kept while a refresh runs or fails, failures and unusable
// answers aren't cached, a passing failure is retried within the call, both
// Excel upload endpoints pick up a newly added semester and report an outage
// as one, and sign-in tells a missing Atlantis account apart from an outage.
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it, type TestContext } from "node:test";
import express from "express";
import request from "supertest";
import xlsx from "xlsx";

process.env.DATABASE_URL ??= "mysql://test:test@127.0.0.1:3306/test";
process.env.JWT_SECRET ??= "external-calls-test-secret";

const LIST = "/bluejack/Semester/GetSemestersWithActiveDate";
const ACTIVE = "/bluejack/Semester/Active";
const initialSemesters = [
    { SemesterID: "SEM-2520", Description: "Even Semester 2025/2026" },
    { SemesterID: "SEM-2610", Description: "Odd Semester 2026/2027" },
];
const addedSemester = { SemesterID: "SEM-2620", Description: "Even Semester 2026/2027" };
// Bluejack spells the id SemesterId for the active semester, SemesterID in the list.
const activeSemester = { SemesterId: "SEM-2610", Description: "Odd Semester 2026/2027" };
let semesters = initialSemesters;
// When set, every Bluejack path answers with exactly this.
let rawAnswer: { status: number; body: string; type?: string } | null = null;
let hits: Record<string, number> = {};
let failNext = 0;
let delayMs = 0;

const atlantisAccount = (email: string, extra: Record<string, unknown> = {}) => ({
    Name: "EKA", BinusianID: "BN200000001", KodeDosen: "D5001",
    email: [{ Email: email, isPrefEmail: "1" }],
    ...extra,
});

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
    if (url.pathname === LIST) return reply(200, semesters);
    if (url.pathname === ACTIVE) return reply(200, activeSemester);
    if (url.pathname === "/atlantis") {
        const input = url.searchParams.get("input") ?? "";
        // Staff: Atlantis answers with an empty NIM, a null one, or none at all.
        if (input === "eka@binus.edu") return reply(200, atlantisAccount(input, { NIM: "" }));
        if (input === "null.nim@binus.edu") return reply(200, atlantisAccount(input, { NIM: null }));
        if (input === "no.nim@binus.edu") return reply(200, atlantisAccount(input));
        if (input === "down@binus.edu") return reply(503, { message: "Atlantis is down" });
        // 404s that don't come from Atlantis itself: a proxy's page, or nothing at all.
        if (input === "proxy.404@binus.edu") {
            res.writeHead(404, { "Content-Type": "text/html" });
            return res.end("<html><body>404 Not Found</body></html>");
        }
        if (input === "empty.404@binus.edu") {
            res.writeHead(404);
            return res.end();
        }
    }
    return reply(404, { message: "not found" });
});

await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const { port } = upstream.address() as AddressInfo;
process.env.BLUEJACK_API = `http://127.0.0.1:${port}/bluejack/`;
process.env.ATLANTIS_API = `http://127.0.0.1:${port}/atlantis`;

const { default: SemesterService, SEMESTER_CACHE_TTL_MS } = await import("../api/services/semester/semesterService.js");
const { default: AtlantisService } = await import("../api/services/atlantis/atlantisService.js");
const { default: AuthService } = await import("../api/services/auth/authService.js");
const { default: semesterRoutes } = await import("../api/routes/semester/semesterRoutes.js");
const { default: userRoutes } = await import("../api/routes/user/userRoutes.js");
const { default: ClassRosterService } = await import("../api/services/class/classRosterService.js");
const { prisma } = await import("../api/prisma/client.js");

const app = express();
app.use("/api/semester", semesterRoutes);
app.use("/api/user", userRoutes);

const workbook = (rows: unknown[][]) =>
    xlsx.write({ SheetNames: ["S"], Sheets: { S: xlsx.utils.aoa_to_sheet(rows) } }, { type: "buffer", bookType: "xlsx" }) as Buffer;
const classSheet = (term: number) => workbook([
    ["term", "lecturer_name", "lecturer_code", "course_code", "course_name", "class", "location"],
    [term, "Eka", "D5001", "COMP6100001", "Software Engineering", "LA01", "Kemanggisan"],
]);
const studentSheet = (term: number) => workbook([
    ["nim", "name", "term", "course_code", "class"],
    ["2702000001", "Student One", term, "COMP6100001", "LA01"],
]);

type InsertedRows = { semester_id: string }[];
type InsertModel = "classTransaction" | "studentListTransaction";
/** Replaces both roster inserts with ones that record their rows. */
function captureInserts(t: TestContext) {
    const inserted: Record<InsertModel, InsertedRows[]> = { classTransaction: [], studentListTransaction: [] };
    for (const model of ["classTransaction", "studentListTransaction"] as const) {
        const delegate = prisma[model] as unknown as { createMany: (args: { data: InsertedRows }) => Promise<{ count: number }> };
        const original = delegate.createMany;
        delegate.createMany = async (args) => {
            inserted[model].push(args.data);
            return { count: args.data.length };
        };
        t.after(() => { delegate.createMany = original; });
    }
    return inserted;
}

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
            assert.deepEqual(current.body.data, activeSemester);
        }
        // The Excel imports read the semester list through the same cache.
        assert.deepEqual((await SemesterService.getAllSemesterData()).data, semesters);

        assert.deepEqual(hits, { [LIST]: 1, [ACTIVE]: 1 });
    });

    it("share one Bluejack call between concurrent requests", async () => {
        delayMs = 50;
        const responses = await Promise.all(
            Array.from({ length: 5 }, () => request(app).get("/api/semester/current"))
        );

        assert.ok(responses.every((response) => response.status === 200));
        assert.equal(hits[ACTIVE], 1);
    });

    it("recover from one passing failure within the same request (AR-14)", async () => {
        failNext = 1;
        const response = await request(app).get("/api/semester/all");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body.data, semesters);
        assert.equal(hits[LIST], 2, "the 503, then the retry");
    });

    it("don't cache a failure, so the next request asks again", async () => {
        failNext = 2;
        const failed = await request(app).get("/api/semester/all");
        const retried = await request(app).get("/api/semester/all");

        assert.equal(failed.status, 400);
        assert.deepEqual(failed.body.errors, { message: "Bluejack is down" });
        assert.equal(retried.status, 200);
        assert.equal(hits[LIST], 3);
    });

    it("ask Bluejack again once the cached answer is an hour old", async (t) => {
        t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
        await SemesterService.getCurrentSemesterData();
        t.mock.timers.tick(SEMESTER_CACHE_TTL_MS - 1);
        await SemesterService.getCurrentSemesterData();
        assert.equal(hits[ACTIVE], 1);

        t.mock.timers.tick(2);
        await SemesterService.getCurrentSemesterData();
        assert.equal(hits[ACTIVE], 2);
    });

    it("keep using an hour-old answer while Bluejack can't be reached", async (t) => {
        t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
        await request(app).get("/api/semester/all");
        await request(app).get("/api/semester/current");
        t.mock.timers.tick(SEMESTER_CACHE_TTL_MS + 1);

        failNext = 4; // both lookups and their retries get a 503
        const all = await request(app).get("/api/semester/all");
        const current = await request(app).get("/api/semester/current");
        assert.equal(all.status, 200);
        assert.deepEqual(all.body.data, initialSemesters);
        assert.equal(current.status, 200);
        assert.deepEqual(current.body.data, activeSemester);

        // Once Bluejack answers properly again, its answer replaces the old one.
        semesters = [...initialSemesters, addedSemester];
        assert.deepEqual((await request(app).get("/api/semester/all")).body.data, semesters);
        assert.deepEqual((await request(app).get("/api/semester/all")).body.data, semesters);
        assert.equal(hits[LIST], 4, "fill, 503 and retry, the recovery; then cached");
    });

    it("pass on what Bluejack answers after the hour, and not bring the old answer back later", async (t) => {
        t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
        for (const [path, answer] of [
            ["/api/semester/current", '{"message":"no active semester"}'],
            ["/api/semester/all", "[]"],
        ] as const) {
            SemesterService.clearCache();
            rawAnswer = null;
            assert.equal((await request(app).get(path)).status, 200, `${path} is cached`);
            t.mock.timers.tick(SEMESTER_CACHE_TTL_MS + 1);

            // Between semesters, say: Bluejack answered, so the old answer doesn't replace it.
            rawAnswer = { status: 200, body: answer };
            const answered = await request(app).get(path);
            assert.equal(answered.status, 200, path);
            assert.deepEqual(answered.body.data, JSON.parse(answer), path);

            // Bluejack has moved on from the old answer, so an outage doesn't bring it back.
            rawAnswer = null;
            failNext = 2;
            const down = await request(app).get(path);
            assert.equal(down.status, 400, path);
            assert.deepEqual(down.body.errors, { message: "Bluejack is down" }, path);
        }
    });

    it("pass odd answers on as before, without caching them", async () => {
        for (const answer of [
            { status: 200, body: "<html>Please sign in to the proxy</html>", type: "text/html" },
            { status: 200, body: "[]" },
            { status: 200, body: '{"error":"maintenance"}' },
            { status: 200, body: '"Semester service paused"' },
            { status: 200, body: '[{"SemesterID": "SEM-2610"' },
            { status: 200, body: '[{"Description":"Odd Semester 2026/2027"}]' },
            { status: 200, body: '[{"SemesterID":null,"Description":"Odd Semester 2026/2027"}]' },
            { status: 200, body: '[{"SemesterID":"  ","Description":"Odd Semester 2026/2027"}]' },
            { status: 200, body: '[{"SemesterID":"SEM-2610"}]' },
            { status: 200, body: '[{"SemesterID":"SEM-2610","Description":"Odd Semester 2026/2027"},{"SemesterID":"SEM-2620"}]' },
        ]) {
            SemesterService.clearCache();
            hits = {};
            rawAnswer = answer;
            const first = await request(app).get("/api/semester/all");
            await request(app).get("/api/semester/all");

            assert.equal(first.status, 200, answer.body);
            assert.equal(hits[LIST], 2, `not cached: ${answer.body}`);
        }
    });

    it("cache the active semester only with the SemesterId and Description callers read", async () => {
        for (const [body, cached] of [
            ['{"SemesterId":"SEM-2610","Description":"Odd Semester 2026/2027"}', true],
            ['{"SemesterID":"SEM-2610","Description":"Odd Semester 2026/2027"}', false],
            ['{"SemesterId":null,"Description":"Odd Semester 2026/2027"}', false],
            ['{"SemesterId":"   ","Description":"Odd Semester 2026/2027"}', false],
            ['{"SemesterId":"SEM-2610"}', false],
            ['{"message":"no active semester"}', false],
            ["[]", false],
        ] as const) {
            SemesterService.clearCache();
            hits = {};
            rawAnswer = { status: 200, body };
            await request(app).get("/api/semester/current");
            await request(app).get("/api/semester/current");

            assert.equal(hits[ACTIVE], cached ? 1 : 2, body);
        }
    });

    it("don't keep an answer with a blank id once Bluejack recovers", async () => {
        rawAnswer = { status: 200, body: '{"SemesterId":null,"Description":"Odd Semester 2026/2027"}' };
        await request(app).get("/api/semester/current");
        rawAnswer = null;
        const recovered = await request(app).get("/api/semester/current");
        await request(app).get("/api/semester/current");

        assert.deepEqual(recovered.body.data, activeSemester);
        assert.equal(hits[ACTIVE], 2, "the usable answer is the one cached");
    });

    it("skip and refresh the cache for a fresh lookup", async () => {
        assert.equal((await SemesterService.getAllSemesterData()).fromCache, false);
        semesters = [...initialSemesters, addedSemester];

        const cached = await SemesterService.getAllSemesterData();
        assert.equal(cached.fromCache, true);
        assert.equal((cached.data as unknown[]).length, 2, "still cached");
        const fresh = await SemesterService.getAllSemesterData({ fresh: true });
        assert.equal(fresh.fromCache, false);
        assert.equal((fresh.data as unknown[]).length, 3);
        assert.equal(((await SemesterService.getAllSemesterData()).data as unknown[]).length, 3, "cache refreshed");
        assert.equal(hits[LIST], 2);
    });

    it("keep serving the cached list while a refresh runs, and after it fails", async () => {
        await request(app).get("/api/semester/all"); // caches the list
        failNext = 2; // the refresh and its retry both get a 503
        delayMs = 100;
        const failedImport = ClassRosterService.importClassTransactionsFromExcel(classSheet(2620))
            .then(() => null, (error: Error) => error);
        const during = await request(app).get("/api/semester/all");
        const failed = await failedImport;
        const afterwards = await request(app).get("/api/semester/all");

        assert.equal(during.status, 200);
        assert.deepEqual(during.body.data, initialSemesters);
        // The term might be in Bluejack's list; the import couldn't check, so it doesn't blame the file.
        assert.equal((failed as { status?: number } | null)?.status, 503);
        assert.match(String(failed?.message), /^Couldn't load the semester list from Bluejack \(Bluejack is down\)\./);
        assert.equal(afterwards.status, 200);
        assert.deepEqual(afterwards.body.data, initialSemesters);
        assert.equal(hits[LIST], 3, "one call to fill the cache, then the refresh and its retry");
    });

    it("keep the cached list when a refresh gets an unusable answer", async () => {
        await SemesterService.getAllSemesterData();
        rawAnswer = { status: 200, body: '[{"SemesterID":null,"Description":"Even Semester 2026/2027"}]' };
        const fresh = await SemesterService.getAllSemesterData({ fresh: true });

        assert.equal(fresh.usable, false, "a fresh lookup reports what Bluejack sent");
        assert.deepEqual((await SemesterService.getAllSemesterData()).data, initialSemesters);
    });

    it("report a Bluejack outage, not a bad file, when an import can't load a usable list", async () => {
        const unavailable = (detail: RegExp) => (error: { status?: number; message: string }) =>
            error.status === 503 && detail.test(error.message);

        failNext = 2; // nothing cached, and Bluejack is down
        await assert.rejects(ClassRosterService.importClassTransactionsFromExcel(classSheet(2610)),
            unavailable(/^Couldn't load the semester list from Bluejack \(Bluejack is down\)\. Please try again/));
        rawAnswer = { status: 200, body: "<html>Please sign in to the proxy</html>", type: "text/html" };
        await assert.rejects(ClassRosterService.importStudentEnrolmentsFromExcel(studentSheet(2610)),
            unavailable(/^Couldn't load the semester list from Bluejack\. Please try again/));

        // Only a short, one-line JSON message is shown as the reason.
        for (const message of ["x".repeat(201), "Bluejack is down\n    at SemesterController.Active"]) {
            rawAnswer = { status: 503, body: JSON.stringify({ message }) };
            await assert.rejects(ClassRosterService.importClassTransactionsFromExcel(classSheet(2610)),
                unavailable(/^Couldn't load the semester list from Bluejack\. Please try again in a few minutes\.$/));
        }
        rawAnswer = null;

        // A term code that can't be read is the file's fault either way, and needs no lookup.
        hits = {};
        await assert.rejects(ClassRosterService.importClassTransactionsFromExcel(classSheet(1999)),
            (error: { status?: number; message: string }) => error.status === 400 && /Invalid semester information/.test(error.message));
        assert.equal(hits[LIST], undefined);
    });

    it("let an Excel import use a semester Bluejack added after the list was cached", async (t) => {
        const inserted = captureInserts(t);

        await ClassRosterService.importClassTransactionsFromExcel(classSheet(2610)); // caches the list
        semesters = [...initialSemesters, addedSemester];
        await ClassRosterService.importClassTransactionsFromExcel(classSheet(2620));

        assert.equal(inserted.classTransaction[1]?.[0]?.semester_id, "SEM-2620");
        // A term Bluejack has never heard of still fails, after one fresh look.
        await assert.rejects(ClassRosterService.importClassTransactionsFromExcel(classSheet(2710)), /Invalid semester information/);
        // An unparseable term fails without asking Bluejack again.
        const before = hits[LIST];
        await assert.rejects(ClassRosterService.importClassTransactionsFromExcel(classSheet(1999)), /Invalid semester information/);
        assert.equal(hits[LIST], before);
    });

    it("share one refresh between concurrent imports of a newly added semester", async (t) => {
        const inserted = captureInserts(t);
        await SemesterService.getAllSemesterData(); // caches the list
        semesters = [...initialSemesters, addedSemester];
        delayMs = 50;

        await Promise.all(Array.from({ length: 5 }, () => ClassRosterService.importClassTransactionsFromExcel(classSheet(2620))));

        assert.equal(hits[LIST], 2, "one call to fill the cache, one shared refresh");
        assert.deepEqual(inserted.classTransaction.map((rows) => rows[0]?.semester_id), Array(5).fill("SEM-2620"));
    });

    it("ask Bluejack once for an import that finds the list uncached", async (t) => {
        const inserted = captureInserts(t);
        semesters = [...initialSemesters, addedSemester];

        await ClassRosterService.importClassTransactionsFromExcel(classSheet(2620));
        assert.equal(hits[LIST], 1);
        assert.equal(inserted.classTransaction[0]?.[0]?.semester_id, "SEM-2620");

        SemesterService.clearCache();
        hits = {};
        await assert.rejects(ClassRosterService.importClassTransactionsFromExcel(classSheet(2710)), /Invalid semester information/);
        assert.equal(hits[LIST], 1, "a list fetched for this import is already fresh");
    });
});

describe("Excel upload endpoints", () => {
    for (const [endpoint, model, sheet] of [
        ["upload-transaction-excel", "classTransaction", classSheet],
        ["upload-student-excel", "studentListTransaction", studentSheet],
    ] as const) {
        it(`POST /api/user/admin/${endpoint} uses a semester Bluejack added after the list was cached`, async (t) => {
            const inserted = captureInserts(t);
            const upload = (term: number) =>
                request(app).post(`/api/user/admin/${endpoint}`).attach("file", sheet(term), "rows.xlsx");

            assert.equal((await upload(2610)).status, 200); // caches the list
            semesters = [...initialSemesters, addedSemester];
            const response = await upload(2620);

            assert.equal(response.status, 200, JSON.stringify(response.body));
            assert.deepEqual(inserted[model].map((rows) => rows[0]?.semester_id), ["SEM-2610", "SEM-2620"]);
            assert.equal(hits[LIST], 2);
        });

        it(`POST /api/user/admin/${endpoint} answers 503 when Bluejack is down`, async (t) => {
            const inserted = captureInserts(t);
            const upload = () => request(app).post(`/api/user/admin/${endpoint}`).attach("file", sheet(2610), "rows.xlsx");

            failNext = 2;
            const down = await upload();
            assert.equal(down.status, 503);
            assert.match(down.body.errors, /^Couldn't load the semester list from Bluejack \(Bluejack is down\)\./);

            // A proxy's error page stays out of the message.
            rawAnswer = { status: 502, body: "<html><head><title>502 Bad Gateway</title></head><body>nginx</body></html>", type: "text/html" };
            const proxied = await upload();
            assert.equal(proxied.status, 503);
            assert.equal(proxied.body.errors, "Couldn't load the semester list from Bluejack. Please try again in a few minutes.");
            assert.deepEqual(inserted[model], []);
        });
    }
});

describe("Atlantis lookup for Microsoft sign-in", () => {
    it("returns the account through the shared client", async () => {
        const result = await AtlantisService.getAtlantisData("eka@binus.edu");

        assert.equal(result.status, true);
        assert.equal((result.data as { KodeDosen: string }).KodeDosen, "D5001");
        assert.equal(hits["/atlantis"], 1);
    });

    it("reports a missing account as a definite miss", async () => {
        const result = await AtlantisService.getAtlantisData("nobody@binus.edu");

        assert.equal(result.status, false);
        assert.equal(result.data, null);
        assert.equal(result.notFound, true);
        assert.equal(hits["/atlantis"], 1, "a 404 isn't retried");
    });

    it("doesn't take a 404 from something in front of Atlantis for a miss", async () => {
        for (const email of ["proxy.404@binus.edu", "empty.404@binus.edu"]) {
            const result = await AtlantisService.getAtlantisData(email);

            assert.equal(result.status, false, email);
            assert.equal(result.notFound, false, email);
        }
    });

    it("accepts an answer with a missing or null NIM", async () => {
        for (const [email, nim] of [["no.nim@binus.edu", undefined], ["null.nim@binus.edu", null]] as const) {
            const result = await AtlantisService.getAtlantisData(email);

            assert.equal(result.status, true, email);
            assert.equal((result.data as { NIM?: string | null }).NIM, nim, email);
        }
    });

    it("reports an outage as a failure, not a miss", async () => {
        const result = await AtlantisService.getAtlantisData("down@binus.edu");

        assert.equal(result.status, false);
        assert.equal(result.notFound, false);
        assert.equal(hits["/atlantis"], 2, "retried once");
    });

    it("makes no call when ATLANTIS_API isn't set", async (t) => {
        const configured = process.env.ATLANTIS_API;
        delete process.env.ATLANTIS_API;
        t.after(() => { process.env.ATLANTIS_API = configured; });

        const result = await AtlantisService.getAtlantisData("eka@binus.edu");

        assert.equal(result.status, false);
        assert.equal(result.notFound, false);
        assert.equal(hits["/atlantis"], undefined);
    });

    it("lets sign-in refuse someone Atlantis has no account or NIM for, and ask for a retry only in an outage", async (t) => {
        const original = prisma.user.findFirst;
        prisma.user.findFirst = (async () => null) as unknown as typeof original;
        t.after(() => { prisma.user.findFirst = original; });

        for (const [email, status] of [
            ["nobody@binus.edu", 403], // Atlantis: its own 404
            ["no.nim@binus.edu", 403], // Atlantis: an account without a NIM
            ["null.nim@binus.edu", 403], // Atlantis: an account with a null NIM
            ["eka@binus.edu", 403], // Atlantis: an account with an empty NIM
            ["down@binus.edu", 503], // Atlantis: 503 twice
            ["proxy.404@binus.edu", 503], // a proxy's 404 page
            ["empty.404@binus.edu", 503], // a 404 with no body
        ] as const) {
            await assert.rejects(
                AuthService.resolveSsoAccount(email),
                (error: { status?: number }) => error.status === status,
                email,
            );
        }
    });
});
