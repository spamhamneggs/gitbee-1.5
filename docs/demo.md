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

The data workspace requires Admin membership. The other accounts are available for existing role dashboards. All names, addresses, projects, and IDs are synthetic. The email domain `example.test` does not send email.

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

Seeding skips a database that already has records. Restarting never clears imported records. Stop with Ctrl+C; Docker users can additionally run `docker stop gitbee-demo-db` to stop the database while retaining its data. The app's older `prisma db seed` command is destructive and is not used by this launcher.

## Five-minute presentation

1. Sign in as the demo Admin. Open `/data-demo`, also linked from Manage Users. A fresh seed has 28 accounts, three projects, 24 roster entries, and 20 application tables.
2. Keep **Students** selected. Download the sample CSV or Excel file. The templates share the same column names and synthetic records.
3. Choose `student-with-errors.xlsx` from `apps/backend/samples/demo/`, or use **Try an Excel file with errors**. Click **Validate & preview**. It contains 10 rows: nine pass field validation and one has a missing name and invalid email. No database writes occur during preview; passwords are hidden.
4. Click **Import to database**. In a fresh demo, eight users are created, one duplicate is skipped, and one invalid row fails. The error list points to worksheet rows 10 and 11.
5. Click **View saved users**. The live `user` table now contains 36 rows, with the imported users first. Password hashes and credential versions are excluded from the explorer.
6. Select the same file again, preview, then import. Zero additional users are created; nine are skipped and one fails validation. Existing accounts are preserved.
7. Switch to **Staff**, download/upload `staff-sample.csv`, preview, and import. Six staff accounts are added. Both formats use the same validation, password hashing, and database-aware duplicate detection.
8. Open **Schema & relationships**, then expand `project_detail`, `project_technology`, and `hop_major` to explain foreign keys. Browse those tables to relate the schema to actual rows.

If these samples were already imported during a previous demonstration, the duplicate counts will reflect that. Use a fresh dedicated demo database, or change the sample email, student/lecturer code, and optional Binusian ID together for a new batch.

## File format and behavior

Student columns:

```csv
nim,name,email,binusian_id,major_code,password
```

Staff columns:

```csv
lecturer_code,name,email,binusian_id,role,major_codes,password
```

- UTF-8 CSV or `.xlsx`; older `.xls` files must be saved as `.xlsx` first.
- Limit: 5 MB, 1,000 data rows per upload. Excel archives are capped at 20 MB expanded, with one worksheet and plain values. Formulas and encrypted files are rejected.
- Headers must match the template. All headers are required, but `binusian_id` cells may be blank. Keep identifiers as text or use an Excel number format that preserves leading zeroes.
- Preview validates row structure and field values. Import revalidates the file, rejects unsupported HoP rows, checks duplicates against the actual database collation, hashes passwords, and inserts valid accounts.
- The report separates created, skipped, and failed rows. Imports are partial: valid, nonduplicate rows are inserted even when other rows fail.
- Staff roles supported by this import are Lecturer, Admin, and SCC. HoP accounts are seeded with a `hop_major` relation for the demo, but bulk HoP import remains unsupported because the schema has no major-code lookup.
- `major_code` / `major_codes` are validated as text but not persisted. There is no student-to-major foreign key in the current schema. Account import does not create class roster entries or projects.
- The existing legacy Excel endpoints remain unchanged. This workspace uses the new protected `/api/user/admin/data-tools` endpoints for both formats.

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

The implementation was tested with the backend suite, including real database tests on a separate `gitbee_demo_test` MariaDB database; eight frontend tests; both TypeScript checks; and a browser walkthrough of local login, Excel and CSV preview/import, persisted rows, and schema details. The seed was also rerun to confirm it preserves existing records. Docker startup and external SSO providers were not tested in this environment.

Frontend production compilation and its TypeScript phase passed, but the full build was blocked by a Windows `EPERM` directory-creation error during static export. Frontend ESLint was blocked before checking files by an installed dependency's missing `zod-validation-error/v4` export. Backend targeted lint passed. The local development demo runs successfully.

Backend tests use `TEST_DATABASE_URL` to opt into database integration checks. Never point test commands at a database containing real data.
