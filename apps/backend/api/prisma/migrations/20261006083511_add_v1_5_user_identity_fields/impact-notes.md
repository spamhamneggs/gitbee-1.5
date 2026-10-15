# Impact Audit — User Identity Fields Migration

**Migration:** `20261006083511_add_v1_5_user_identity_fields`
**Date:** 2026-10-06
**Scope:** Audit of all queries touching `User` and student identifiers across the named handlers.

---

## 1. Schema Change Summary

The `user` table is extended so it can store **students** (not just staff).

| Field | Before | After |
|---|---|---|
| `lecturer_code` | `VARCHAR(50) NOT NULL`, unique | `VARCHAR(50) NULL`, unique |
| `binusian_id` | — | `VARCHAR(150) NULL`, **unique** |
| `password` | — | `VARCHAR(255) NULL` |
| `student_id` | — | `VARCHAR(50) NULL`, **unique** |
| `user_type` | — | `VARCHAR(50) NULL` |
| unique index | `(lecturer_code, name)` | dropped (only `lecturer_code` unique remains) |

**Identifier taxonomy after the change:**
- Staff users carry `lecturer_code` (and possibly `binusian_id`).
- Student users carry `student_id` (NIM) and `binusian_id`, with `user_type = 'student'` and `role = 'Student'`.
- All three code columns (`lecturer_code`, `student_id`, `binusian_id`) are individually unique and nullable.

---

## 2. Handler-by-Handler Audit

### 2.1 authHandler.ts

**File:** `apps/backend/api/handlers/auth/authHandler.ts`

**Queries touching User / student identifiers:**

| # | Query | Identifier(s) used |
|---|---|---|
| 1 | `prisma.user.findFirst({ where: { OR: [{ email }, { lecturer_code }, { student_id }, { binusian_id }] } })` (L50) | `email`, `lecturer_code`, `student_id`, `binusian_id` |
| 2 | `createToken(nim, username, …)` where `nim = user.lecturer_code ?? user.student_id ?? user.binusian_id` (L74–76) | `lecturer_code`, `student_id`, `binusian_id` |

**Assessment — ✅ No breakage.**

- The handler already reads the new fields (`student_id`, `binusian_id`, `user_type`) and uses them for staff/student disambiguation (L66: `user.role !== "Student" && user.user_type !== "student"`).
- The `OR` lookup (L43–48) correctly falls back through all three identity columns.
- The `nim` claim computation (L74–76) correctly prefers `lecturer_code` for staff and `student_id`/`binusian_id` for students.

---

### 2.2 userHandler.ts

**File:** `apps/backend/api/handlers/user/userHandler.ts`

**Queries touching User / student identifiers:**

| # | Query | Identifier(s) used |
|---|---|---|
| 1 | `GenericService.getName(params.nim)` (L19) | NIM passed to external Atlantis API (no DB `user` query) |
| 2 | `prisma.role.findMany()` (L30) | role table only — no user identifier |

**Assessment — ✅ No breakage.**

- `userHandler` does **not** query the `user` table by any identifier. `getName` delegates to the external Atlantis service.
- No impact from the schema change.

---

### 2.3 adminUserHandler.ts (incl. `uploadUserExcel`)

**File:** `apps/backend/api/handlers/user/admin/adminUserHandler.ts`

**Queries touching User / student identifiers:**

| # | Method | Query | Identifier(s) |
|---|---|---|---|
| 1 | `getUser` | `prisma.user.findMany({ where: { role, OR: [{ lecturer_code contains }, { email contains }, { name contains }] } })` (L52–113) | `lecturer_code`, `email`, `name` |
| 2 | `insertUser` | `prisma.user.create({ data: { lecturer_code, email, name, role } })` (L145) | `lecturer_code` |
| 3 | `updateRole` | `prisma.user.findUnique({ where: { id } })` + `prisma.user.update({ where: { id }, data: { role } })` (L184, L200) | `id` |
| 4 | `uploadUserExcel` | `prisma.user.createMany({ data: validatedUsers, skipDuplicates: true })` (L272) | `lecturer_code` |
| 5 | `removeUserExcel` | `prisma.user.deleteMany({ where: { NOT: [{ role: 'Admin' }, { role: 'SCC' }, { role: 'HoP' }] } })` (L288) | `role` |
| 6 | `getAllStudent` | `prisma.studentListTransaction.findMany(...)` (L473) | `student_id` (in `student_list_transaction`, **not** `user`) |
| 7 | `uploadStudentExcel` | `prisma.studentListTransaction.createMany(...)` (L562) | `student_id` (in `student_list_transaction`, **not** `user`) |

**Breakages:**

#### ⚠️ BREAKAGE 1 — `getUser` search misses `binusian_id` / `student_id` (minor)

The search `OR` (L36–44) only covers `lecturer_code`, `email`, `name`. It does **not** search `binusian_id` or `student_id`.

- **Why it breaks:** Staff users seeded/imported without `binusian_id` are unaffected. But if a user row carries `binusian_id` (e.g. populated after a Microsoft login in the future), searching by Binusian ID in the admin user list returns nothing.
- **Impact:** Low — currently no code populates `user.binusian_id`, so the field is `NULL` for every row and the gap is invisible today. It becomes a real bug once `binusian_id` starts being written.
- **Fix:** Add `{ binusian_id: { contains: params.search } }` (and optionally `{ student_id: { contains: params.search } }`) to the `OR` clause.

#### 🔴 BREAKAGE 2 — `removeUserExcel` deletes Student user rows (critical)

`removeUserExcel` (L286–298) deletes **every** user whose role is not `Admin`, `SCC`, or `HoP`. Before the schema change only `Lecturer` rows matched. After the change, any `user` row with `role = 'Student'` (created for students) will also be deleted.

- **Why it breaks:** The endpoint's intent is "clear uploaded lecturer Excel data", but the `NOT IN (Admin, SCC, HoP)` filter now also sweeps student users.
- **Impact:** High — a single admin "remove lecturer excel" action wipes all student identity rows from the `user` table, breaking login lookup for those students.
- **Fix:** Explicitly target `Lecturer` only:
  ```ts
  where: { role: 'Lecturer' }
  ```
  or add `{ role: 'Student' }` to the `NOT` exclusion list.

#### ℹ️ Note — `uploadUserExcel` unique-dedup still works

`skipDuplicates: true` relies on unique indexes. The new unique indexes on `binusian_id` and `student_id` are `NULL` for all imported lecturers, and MySQL permits multiple `NULL`s in a unique index, so no false-duplicate errors. The remaining unique constraint on `lecturer_code` still dedups correctly.

#### ℹ️ Note — Excel column mapping bug (pre-existing, out of scope)

`uploadUserExcel` maps both `email` and `name` from `row[1]` (L261–262). This is a pre-existing bug unrelated to the schema change.

---

### 2.4 projectHandler.ts

**File:** `apps/backend/api/handlers/project/projectHandler.ts`

**Queries touching User / student identifiers:**

| # | Method | Query | Identifier(s) |
|---|---|---|---|
| 1 | `insertProject` | `prisma.project.findFirst({ where: { lecturer_id, projectGroups: { some: { student_id } } } })` (L41) | `lecturer_id` (lecturer code string), `student_id` (NIM in `project_group`) |
| 2 | `insertProject` | `prisma.project.create({ data: { lecturer_id, student_leader_id } })` (L73) | `lecturer_id`, `student_leader_id` (both plain strings) |
| 3 | `insertProject` | `prisma.projectGroup.createMany({ data: [{ student_id, student_name, student_binusian_id }] })` (L139) | `student_id` (NIM), `student_binusian_id` |
| 4 | `getAllProject` | `prisma.project.findMany({ where: { projectGroups: { some: { student_name/student_id/student_binusian_id contains } } } })` (L199) | `student_id`, `student_name`, `student_binusian_id` (in `project_group`) |
| 5 | `getDetailProject` | `prisma.project.findMany({ where: { id } })` (L285) | `id` |

**Assessment — ✅ No breakage.**

Key reason: `Project.lecturer_id`, `Project.student_leader_id`, and `ProjectGroup.student_id` are **deliberately denormalized strings**, not foreign keys to `User`. The schema comments confirm this ("NIM, not an FK to User"). So making `user.lecturer_code` nullable and adding `user.student_id` has **no FK or constraint impact** on the project tables.

- `lecturer_id` stores the lecturer code directly; it works whether or not a matching `user` row exists.
- `student_id` in `project_group` is the NIM; it never joined to `user.student_id`.

No changes required.

---

### 2.5 studentGroupHandler.ts

**File:** `apps/backend/api/handlers/group/student/studentGroupHandler.ts`

**Queries touching User / student identifiers:**

| # | Method | Query | Identifier(s) |
|---|---|---|---|
| 1 | `insertTemporaryGroup` | `prisma.temporaryGroup.findMany({ where: { student_id: { in: studentIds } } })` (L27) | `student_id` (NIM in `temporary_group`) |
| 2 | `insertTemporaryGroup` | `prisma.project.findMany({ where: { projectGroups: { some: { student_id: { in: studentIds } } } } })` (L39) | `student_id` (NIM in `project_group`) |
| 3 | `insertTemporaryGroup` | `prisma.temporaryGroup.create({ data: { student_id, student_name, student_binusian_id } })` (L133) | `student_id`, `student_binusian_id` |
| 4 | `getCurrentStudentGroup` | `prisma.temporaryGroup.findFirst({ where: { semester_id, course_id, class, student_id } })` (L174) | `student_id` (NIM in `temporary_group`) |

**Assessment — ✅ No breakage.**

`TemporaryGroup.student_id` and `ProjectGroup.student_id` are NIM snapshots, not FKs to `User`. The handler never reads or writes `user.student_id`. The schema change to the `user` table is invisible here.

---

## 3. Bonus: Finding Seed

**Seed files audited:** `seeds/user.ts`, `seeds/student.ts`, `seeds/project.ts`, `seeds/seed.ts`.

### 3.1 `seeds/user.ts` — ✅ No breakage

Seeds 5 staff rows with `lecturer_code`, `email`, `name`, `role`. The new columns (`binusian_id`, `student_id`, `user_type`, `password`) are all `NULL`, which is allowed. All `lecturer_code` values are unique, satisfying the remaining unique index.

### 3.2 `seeds/student.ts` — ✅ No breakage (different table)

Seeds `student_list_transaction` rows (NIM + name + course + class). This is a **separate table** from `user` and is unaffected by the `user` schema change.

### 3.3 `seeds/project.ts` — ✅ No breakage

Seeds projects with `lecturer_id` (`"D2345"`, `"D6789"`, `"D5432"`) and `student_leader_id` (NIMs). Neither is a FK to `user`, so no referential integrity issue.

### 3.4 `seeds/seed.ts` — ⚠️ One latent seed issue

- **HoPMajor seeding** (L82–87) hard-codes `user_id: 4, major_id: 6`. User ID 4 is Roger Laurent (HoP). This works but is **fragile** — if the user seed order changes, the HoP link breaks. Not caused by this migration.
- **Student `binusian_id`** (L162–163): project groups are seeded with `student_binusian_id: ""` (empty string) because the local roster has no Binusian IDs. This is intentional and correct.

### 3.5 Seed gap worth noting

No seed creates a **student** row in the `user` table (i.e. a row with `student_id` set, `user_type = 'student'`, `role = 'Student'`). The migration's new `user.student_id` / `user.binansian_id` columns are never exercised by seeds. This means:
- The unique indexes on `student_id` and `binusian_id` are not validated by the seed run.
- The auth flow for a student who *does* have a `user` row is not seed-tested.

If the team wants seed coverage for the new student-user path, add a seed user like:
```ts
{
  email: "student@binus.ac.id",
  name: "Test Student",
  role: "Student",
  user_type: "student",
  student_id: "2501959296",
  binusian_id: "BINUSIAN001",
  lecturer_code: null
}
```

---

## 4. Breakage Summary

| # | Handler | Severity | Issue |
|---|---|---|---|
| 1 | `adminUserHandler.getUser` | ⚠️ Minor | Search `OR` omits `binusian_id` / `student_id` |
| 2 | `adminUserHandler.removeUserExcel` | 🔴 Critical | Deletes `role='Student'` user rows alongside lecturers |
| 3 | (seed) `seed.ts` | ℹ️ Info | No seed exercises the new student-user columns |

Everything else (`authHandler`, `userHandler`, `projectHandler`, `studentGroupHandler`) is **compatible** with the schema change because project/group student identifiers are denormalized NIM strings, not FKs to `User`.
