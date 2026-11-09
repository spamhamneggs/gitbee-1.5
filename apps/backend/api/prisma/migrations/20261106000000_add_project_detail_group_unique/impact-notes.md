# Impact Notes — Project Detail Group Unique Key

**Migration:** `20261106000000_add_project_detail_group_unique`
**Date:** 2026-11-06
**Scope:** Audit of every write/read path that targets `project_detail`'s
`(semester_id, course_id, class, group)` tuple, following GB-12.

---

## 1. Schema Change Summary

Adds one unique index so a group can own at most one project per course offering.

| Object | Before | After |
|---|---|---|
| `project_detail` index | none on the group tuple | `UNIQUE INDEX project_detail_group_key (semester_id, course_id, class, group)` |

`project_id` keeps its existing `@unique`. The compound key uses `map` in the Prisma
schema to match the index name in this migration. No column type changes.

---

## 2. Why

`ProjectHandler.insertProject` deletes the group's previous project and recreates it.
Two submissions that overlap both read the old project (`findFirst`), both delete it
(second one removes nothing), and both insert — leaving **two projects for the same
group**. The unique index turns the loser's insert into P2002, which rolls the whole
transaction back and is surfaced as **409 Conflict**.

The index also blocks two simultaneous *first-time* submits, which the old lookup
(leader + course + semester + class) could not detect.

---

## 3. Affected Paths

| # | Location | Query | Impact |
|---|---|---|---|
| 1 | `ProjectHandler.insertProject` | `tx.projectDetail.create(...)` | Must run *after* the previous detail is deleted in the same tx; on P2002 → 409. |
| 2 | `ProjectHandler.insertProject` | deletes of gallery / project_technology / project_group / project_detail / project | Switched to `deleteMany` so a lost race does not throw P2025 before the insert; the insert becomes the conflict signal. |
| 3 | `ProjectHandler.insertProject` | `tx.temporaryGroup.findMany(...)` | Read in the transaction to verify first-submission membership and backfill member names; only submitted members are deleted at the end of the tx. |
| 4 | `api/prisma/seed.ts` | `prisma.projectDetail.create(...)` | Seed combos (`BW11`/`BW22` groups 1–5) are unique on the tuple — no conflict. |
| 5 | `api/prisma/dummy/generateCsv.ts` and other project seeders | — | No `project_detail` writes. |
| 6 | `StudentGroupHandler.insertTemporaryGroup` | member checks, group-number lookup and roster inserts | Run in one serializable transaction; retry P2034 conflicts up to four times so concurrent groups receive different numbers. |

Project submission requires a student session whose signed NIM matches the submitted
leader. A first submission requires membership in the temporary roster. A replacement
requires membership in the saved project group. Both checks run inside the write
transaction before any writes. A collision with an unrelated group returns 409 and
preserves the existing project, assessment and waiting roster. The frontend includes
its session cookie when submitting.

---

## 4. Deploy Notes

- Run the duplicate check in `migration.sql` before deploying. If duplicates already
  exist (produced by the race), the index creation fails with P3018/P3009; remove the
  stale rows, then `prisma migrate resolve --rolled-back <name>` + `prisma migrate deploy`.
- `group` is a MySQL reserved word — it must stay backticked in raw SQL.
- No application read path depends on `project_detail` having a `group`-tuple index,
  so no query plans regress.
