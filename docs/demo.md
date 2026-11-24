# GitBee CSV / Excel database demo

## Run locally

Requirements: Node.js 22.12+ and either Docker or a local Windows MariaDB installation (XAMPP is detected automatically). Keep ports 3309, 5001, and 8000 free.

From the repository root:

```sh
npm --prefix apps/backend install --ignore-scripts --package-lock=false
npm --prefix apps/frontend install --ignore-scripts --package-lock=false
npm run demo
```

These commands provide a Windows-compatible alternative to the repository's pnpm workspace setup. The launcher generates the Prisma client, deploys migrations, seeds the empty demo database, generates sample files, and starts both apps. It does not modify your `.env` files. The database and generated JWT secret are kept in the ignored `.demo/` directory when using local MariaDB. Docker uses the dedicated `gitbee-demo-db` container and `gitbee_demo_data` volume.

Open **http://localhost:8000/demo-login** and sign in:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@example.test | GitbeeDummy#2026 |
| Lecturer | lecturer@example.test | GitbeeDummy#2026 |
| SCC | scc@example.test | GitbeeDummy#2026 |
| HoP | hop@example.test | GitbeeDummy#2026 |
| Student | student@example.test | GitbeeDummy#2026 |

The data workspace requires Admin membership. The other accounts demonstrate local role sign-in, but the role dashboards show empty data without the external BLUEJACK semester service. The launcher does not mock that service. Seeded projects are visible in Explore and the database workspace. All names, addresses, projects, and IDs are synthetic. The email domain `example.test` does not send email.

Demo tools are disabled by default. The launcher alone sets `DEMO_TOOLS=true` for `/api/user/admin/data-tools` and `NEXT_PUBLIC_DEMO=true` for `/demo-login` and `/data-demo`. Normal starts and production builds without these flags return 404 for the demo tools; Manage Users and the account APIs remain available. `NEXT_PUBLIC_DEMO` is fixed at frontend build time, so changing it at deployment does not enable an already-built image.

The launcher binds the frontend and backend to loopback. Local MariaDB also binds to loopback; the Docker database publishes only `127.0.0.1:3309`. This is a local presentation setup. Keep the known demo passwords confined to the demo environment.

For another Windows MariaDB installation:

```sh
node scripts/demo.mjs --mysql-bin C:/path/to/mariadb/bin
```

For an already-created, dedicated MySQL database, set `DATABASE_URL` before launching. The database name must be `gitbee_demo` or `gitbee_demo_<lowercase suffix>`:

```powershell
$env:DATABASE_URL = 'mysql://demo_user:password@127.0.0.1:3309/gitbee_demo'
npm run demo
```

Seeding skips a database that already has records. Restarting never clears imported records. Stop with Ctrl+C. The launcher stops app process trees and shuts down its own MariaDB gracefully with `mysqladmin`; external databases are left running. Docker users can additionally run `docker stop gitbee-demo-db` to stop the database while retaining its data. The app's older `prisma db seed` command is destructive and is not used by this launcher.

## Five-minute presentation

1. Sign in as the demo Admin and open `/data-demo`. A fresh seed has 28 accounts.
2. Click **Load sample files** to load student and staff CSV examples, or choose one or more files from `apps/backend/samples/demo/`. Mixed student/staff files are detected by their column headers.
3. Step **2 — Validate & preview** is always visible, including before selecting files. Click **Validate & preview**. The browser reads the files into row objects and posts JSON for backend validation. Each file gets its own table; passwords are hidden. Preview never writes to the database.
4. Observe the backend's `[data-demo]` receipt log: action, filenames, row counts, and two validated rows per file. Passwords are excluded. The launcher enables this with `DEMO_IMPORT_LOG=true`; logging is off by default elsewhere.
5. Click **Save to database**. On a fresh database, the sample loader creates 8 students and 6 staff. Uploading matching Excel copies later skips them as duplicates. Each file shows created/skipped/failed counts. The backend revalidates every row, even if preview was bypassed or the request was changed.
6. Click **Get Data** below the import area. The table displays freshly queried accounts, including `major_code` and `major_codes`. It shows 20 accounts per page, newest first, with pagination.
7. Refresh the entire page and click **Get Data** again. The accounts must remain; the results are fetched from the database and do not depend on the upload preview.
8. Reload and save the same samples: zero new accounts should be created. **Try samples with errors** demonstrates a missing name/invalid email and duplicate rows; valid new accounts still save.
9. The existing **Browse database** and **Schema & relationships** tabs remain available for the broader database presentation.

Use a fresh dedicated demo database to verify the initial counts. Existing users are preserved, including existing accounts whose major codes predate this migration and are still NULL; duplicate import does not backfill or overwrite them.

## File format and behavior

Student columns:

```csv
nim,name,email,binusian_id,major_code,password
```

Staff columns:

```csv
lecturer_code,name,email,binusian_id,role,major_codes,password
```

- UTF-8 CSV (comma or semicolon separated) or `.xlsx`; older `.xls` files must be saved as `.xlsx` first. In Excel, use CSV UTF-8 to preserve accented names. Manage Users and Students accept the same CSV separators.
- Limit: 5 MB, 1,000 data rows per file, 4,000 total data rows per JSON batch, with no fixed file-count limit. Excel files must contain one worksheet and plain values. Formulas and encrypted files are rejected.
- The row limit counts rows containing values, not formatting-only empty cells; reported row numbers still match the source worksheet.
- Headers must match the template. All headers are required, but `binusian_id` cells may be blank. Keep identifiers as text or use an Excel number format that preserves leading zeroes.
- Preview validates row structure and field values. Import revalidates the file, rejects unsupported HoP rows, checks duplicates against the actual database collation, hashes passwords, and inserts valid accounts.
- The report separates created, skipped, and failed rows. Imports are partial: valid, nonduplicate rows are inserted even when other rows fail.
- Staff roles supported by this import are Lecturer, Admin, and SCC. HoP accounts are seeded with a `hop_major` relation for the demo, but bulk HoP import remains unsupported because the schema has no major-code lookup.
- `major_code` / `major_codes` are stored in nullable text columns on `user`. They preserve the imported source values without creating major assignments. Account import does not create class roster entries or projects.
- The existing legacy Excel endpoints remain unchanged. This workspace uses the new protected `/api/user/admin/data-tools` endpoints for both formats.

## JSON API contract and code map

All routes below require a current Admin session cookie and return `Cache-Control: no-store`.

- `POST /api/user/admin/data-tools/imports/preview`: validates a JSON batch and returns per-file counts, validation errors, and up to ten preview rows without passwords. Does not write.
- `POST /api/user/admin/data-tools/imports/save`: receives the same JSON shape, validates again, maps valid rows to Prisma `User` objects, hashes passwords, and inserts accounts. Files are processed in order so later files see earlier duplicates. Partial imports retain per-file errors.
- `GET /api/user/admin/get-student-accounts` and `GET /api/user/admin/get-staff-accounts`: the Get Data table uses the paginated account routes from PR #69. Responses contain `{ items, total, page, pageSize }` inside `{ message, status, data }`. Both support search and pagination; staff also supports a role filter. The student response includes `major_code`, and staff includes `major_codes` and HoP major names. Passwords and credential versions are never selected.

Example request (`Content-Type: application/json`):

```json
{
  "files": [
    {
      "name": "student-sample.csv",
      "type": "student",
      "rows": [
        {
          "line": 2,
          "data": {
            "nim": "001234",
            "name": "Demo Student",
            "email": "demo.student@example.test",
            "binusian_id": "",
            "major_code": "COMP",
            "password": "GitbeeDummy#2026"
          }
        }
      ]
    }
  ]
}
```

All cell values are strings. `line` is the logical CSV record number or Excel worksheet row, with the header at row 1. The server rejects malformed envelopes, more than 4,000 rows across a batch, more than 1,000 rows in a file, duplicate row numbers, or unsupported fields. Per-row field errors are reported without discarding other valid rows.

| Responsibility | File |
| --- | --- |
| Browser file reading and JSON construction | `apps/frontend/src/app/data-demo/readImportFiles.ts` |
| Preview/save controls | `apps/frontend/src/app/data-demo/ImportWorkspace.tsx` |
| Get Data table and shared account API client | `apps/frontend/src/app/data-demo/SavedAccounts.tsx`, `apps/frontend/src/lib/accountApi.ts` |
| Save module: JSON validation, receipt logging, persistence orchestration | `apps/backend/api/utils/demo/saveDemoData.ts` |
| Existing ORM mapping, hashing, duplicate handling and insert | `apps/backend/api/utils/csv/csvUserImport.ts` |
| Fetch module: ORM queries with explicit safe fields | `apps/backend/api/services/user/userService.ts` (`listStudentAccounts`, `listStaffAccounts`) |
| HTTP routes | `apps/backend/api/routes/user/admin/dataToolsRoutes.ts` |
| Nullable major-code columns | `apps/backend/api/prisma/migrations/20261115000000_preserve_imported_major_codes/migration.sql` |

`npm run demo` deploys the new migration automatically. For another environment, generate Prisma and deploy migrations before running the updated code. The migration adds nullable columns and does not modify existing rows. JSON is the transport format; the database stores typed account columns rather than a single JSON document.

## Database presentation

The workspace reads counts, column types, nullability, keys, and foreign keys from the live database. It shows 20 records per page, ordered by descending ID. Long text cells are shortened to 240 characters in the browser only. There is no arbitrary SQL editor or table write action.

```mermaid
erDiagram
    project ||--o| project_detail : describes
    project ||--o{ project_group : contains
    project ||--o| assessment : graded_by
    project ||--o| reviewed_project : reviewed_by
    project ||--o| outstanding_project : recognized_by
    project ||--o{ gallery : illustrates
    project ||--o{ project_technology : uses
    technology ||--o{ project_technology : labels
    category ||--o{ project_detail : classifies
    status ||--o{ project_detail : tracks
    major ||--o{ project_detail : owns
    user ||--o{ hop_major : leads
    major ||--o{ hop_major : assigned_to
```

| Table group | Purpose |
| --- | --- |
| `user`, `role`, `hop_major` | Accounts, role reference list, and HoP-major assignments. The `user.role` value is text, not a foreign key to `role`. |
| `project`, `project_detail`, `project_group` | Project ownership, details, and student membership snapshots. |
| `assessment`, `reviewed_project`, `outstanding_project` | Grading, review, and showcase decisions, at most one of each per project. |
| `gallery`, `technology`, `project_technology` | Project media and technology tags. |
| `status`, `category`, `major` | Reference data required by project details. |
| `class_transaction`, `student_list_transaction` | Lecturer teaching assignments and student class rosters. |
| `class`, `deadline`, `temporary_group` | Finalization, submission deadlines, and pre-submission groups. |

`project.student_leader_id`, `project.lecturer_id`, and roster student IDs are application-level identifiers, not foreign keys to `user`. `project_detail` uniquely identifies a group by `(semester_id, course_id, class, group)`. Deleting a project cascades to its owned detail/group/review/media rows; referenced status/category/major rows are restricted from deletion while in use.

## Verification

Backend database tests require `TEST_DATABASE_URL` pointing at a migrated, dedicated test database. Never point them at real or demo presentation data. Run the normal parallel test command; the JSON round-trip test filters account pages to its unique run domain so other tests cannot move its rows between pages.

Run backend and frontend `npm test`, `npm run lint`, and TypeScript checks, plus `node --test scripts/tests/*.test.mjs` from the repository root for launcher process cleanup. A production `npm run build` without demo flags must leave both demo pages unavailable.

Both apps use SheetJS 0.20.3 from the [official CDN](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), replacing the vulnerable npm-only 0.18.5 release. The lockfile pins the same tarball and integrity in both workspaces.

## Account route integration

The data-tools router is mounted at `/admin/data-tools` only when `DEMO_TOOLS=true`. It exposes JSON preview/save, samples, and the database explorer. The unused multipart demo imports and `/saved-users` have been removed; account reads use the student/staff routes.

The demo Get Data section offers Students and Staff, search, staff-role filtering, and 20-row pages. After a JSON save it clears filters, returns to page one, and fetches the imported type (Students for mixed batches). Switch to Staff and click Get Data to inspect staff from a mixed batch. Requests carry the session cookie, disable caching, and cancel stale requests. Errors clear old results and allow retry.

Manage Users uses the same two account routes. Its Students view is read-only; staff views retain existing update controls. CSV import success selects Students or All staff, clears search, and reloads page one. Staff Update keeps the current search, role filter, and page. The Students page (`/manage-student`) reads the same student account route through `getAccounts("student", …)` and imports with `uploadStudentsCsv`, so its list and imports match the Students view.

Manage Users follows local login eligibility from PR #69. Legacy staff roles such as `admin` or `HoP ` do not match the exact role rules, so those accounts no longer appear here for repair. This does not alter stored roles; correcting existing records requires a separate administrative data correction.

Imported major codes are source text, not HoP assignments. Rows imported before the major-code migration may have null major-code fields; duplicate imports do not overwrite them.

The integration includes current `main` through `cb4ca27` (PRs #69 and #70). It preserves the reviewed account rules, literal wildcard search, pagination limits, and repeatable-read transactions. The account predicates use `REGEXP` with a case-sensitive Unicode collation so the local MariaDB demo can apply the same login rules without the MySQL-only `REGEXP_LIKE` function.

Review follow-up validation is recorded in PR #73. Earlier local Windows builds and frontend lint hit environment-specific errors; these were not general project limitations. The reviewer independently verified production builds and MySQL 8 compatibility. External SSO and BLUEJACK-backed dashboards are outside this local demo.
