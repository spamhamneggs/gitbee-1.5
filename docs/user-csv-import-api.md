# User CSV import API

How an admin imports student and staff accounts from CSV, and the GET routes the frontend uses to read those accounts back from the database. All paths are relative to `NEXT_PUBLIC_BACKEND_API` (for example `http://localhost:5001/api/`).

| Method | Path | What it does |
| --- | --- | --- |
| POST | `user/admin/upload-student-csv` | Creates student accounts from a CSV file |
| POST | `user/admin/upload-staff-csv` | Creates staff accounts from a CSV file |
| GET | `user/admin/get-student-accounts` | Lists student accounts, newest first, paged |
| GET | `user/admin/get-staff-accounts` | Lists staff accounts, newest first, paged |

All four need an admin session: the session cookie (`COOKIE_NAME`, sent with `credentials: "include"`) or an `Authorization: Bearer <token>` header. Without a valid one they answer `401`; a session without the Admin role gets `403`. The GET routes use the same guard as `get-user` (`currentAdminMiddleware`), which reads the account from the database on every request, so a demoted or deleted admin is refused straight away. Every response uses the usual envelope, `{ message, status, data, errors }`.

## POST upload-student-csv / upload-staff-csv

**Request.** `multipart/form-data` with one file in the field `file`.

- The name must end in `.csv`, and the MIME type must be one browsers send for CSV (`text/csv`, `application/vnd.ms-excel`, `text/plain`, `application/csv`, `text/x-csv` or `application/octet-stream`).
- At most 5 MB, otherwise `413`.
- UTF-8 only (in Excel, Save As "CSV UTF-8"). A UTF-8 BOM is fine.
- The content is checked too: PDF, ZIP/XLSX, XLS, images and executables are rejected even when named `.csv`, as are control characters and broken quoting.

**Columns.** The first row is the header. Columns are matched by name, so their order doesn't matter and extra columns are ignored. Values are trimmed and blank lines are skipped.

| File | Columns |
| --- | --- |
| Student | `nim`, `name`, `email`, `binusian_id`, `major_code`, `password` |
| Staff | `lecturer_code`, `name`, `email`, `binusian_id`, `role`, `major_codes`, `password` |

Row rules:

- Required: everything except `binusian_id`. A blank `binusian_id` is stored as NULL.
- Maximum lengths match the `user` table: `nim`, `lecturer_code` and `major_code` 50, `name` 150, `email` 150, `binusian_id` 150, `password` and `major_codes` 255.
- `email` must be a valid address.
- `role` (staff) is one of Lecturer, Admin, SCC or HoP, in any case.
- `major_code` / `major_codes` are required and stored as source text. They do not assign majors, because majors have no codes to match them against. HoP rows are still rejected for that reason.
- A row with more or fewer fields than the header is rejected on its own; the rest of the file still imports.

**What it writes.** One `user` row per accepted line, with the password hashed (never returned):

| File | `role` | `user_type` | Identifier column |
| --- | --- | --- | --- |
| Student | `Student` | `student` | `student_id` = `nim` |
| Staff | the CSV `role` | NULL | `lecturer_code` |

**Duplicates.** A row is skipped if its email, Binusian ID, or NIM / lecturer code already belongs to a user, or repeats an earlier row in the same file. The comparison follows the `user` table's collation, so case, accents and trailing spaces don't make two values different.

**Response `200`.** The file is imported even when some rows fail; each rejected or skipped row is listed with its line in the file (the header is line 1):

```json
{
  "totalParsed": 34,
  "createdCount": 25,
  "skippedCount": 2,
  "failedCount": 7,
  "errors": [
    { "line": 4, "errors": ["nim: is required"] },
    { "line": 8, "errors": ["email: must be a valid email address"] }
  ]
}
```

`skippedCount` counts duplicates ("User with email or ID already exists in the system", "Duplicate record within the uploaded file"); `failedCount` counts rows that failed validation, HoP rows, and rows the database refused. One gap: if another import inserts the same user at the same moment, the row is counted in `skippedCount` with no entry in `errors` (issue #39).

**Errors.**

| Status | `errors` |
| --- | --- |
| 400 | `No file uploaded`, `Only CSV files are allowed.`, `CSV file cannot be empty`, the UTF-8 message, `CSV file has no data rows.`, `CSV file must include a header row`, `Missing required CSV columns: …`, `Duplicate CSV columns: …`, or a CSV syntax error |
| 401 | No valid session (`Unauthorized`, or `Forbidden` for an invalid token) |
| 403 | `Forbidden`: signed in, but not as an Admin |
| 413 | `File size exceeds the 5MB limit.` |
| 500 | The error's message, or `Failed to import CSV file.` |

The admin "Manage Users" page calls these through `uploadUsersCsv` in `apps/frontend/src/app/(pages)/(admin)/manage-users/actions.tsx`, and the "Students" page (`/manage-student`) through `uploadStudentsCsv` in `apps/frontend/src/app/(pages)/(admin)/manage-student/actions.tsx`.

## GET get-student-accounts / get-staff-accounts

These read the accounts back so the UI can show what an import created. Both are ordered newest first, so a fresh import is on page 1.

**Query parameters.**

| Parameter | Default | Rules |
| --- | --- | --- |
| `search` | none | Up to 150 characters; blank means no filter. Matches part of the NIM or lecturer code, Binusian ID, email or name, ignoring case. `%` and `_` match themselves, not any character. |
| `page` | `1` | Integer, 1 or more. The rows skipped, (page − 1) × pageSize, can be at most 4294967295; a page past that gets `400`. |
| `pageSize` | `50` | Integer, 1 to 200 |
| `roleFilter` | none | Staff only: `Lecturer`, `Admin`, `SCC` or `HoP` |

**Which accounts.** Exactly the accounts local login lets in, by the same rules (`getLocalRoles` in `apps/backend/api/utils/auth/auth.ts`; the lists use its SQL version in `apps/backend/api/utils/auth/localAccountSql.ts`):

- Students: `role` is `Student`, or `user_type` is `student`.
- Staff: `role` is `Lecturer`, `Admin`, `SCC` or `HoP`, and `user_type` is NULL or `staff`.
- `user_type` is compared after trimming surrounding spaces, ignoring case, so ` Student ` counts as `student`.
- `role` must match exactly, including case and spaces. An account whose role is `admin`, `HOP` or `Student ` can't sign in, so neither list shows it. Nor does an account with any other `user_type`.

**Response `200`.** `total` is the number of matching accounts across all pages.

```json
{
  "items": [
    {
      "id": 30,
      "student_id": "2702000025",
      "name": "Oktavia Putra",
      "email": "oktavia.putra25@binus.ac.id",
      "binusian_id": "BN100000025",
      "created_at": "2026-11-15T07:30:03.481Z"
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 2
}
```

Staff items have `lecturer_code` and `role` instead of `student_id`, plus `hop_major` (the HoP's majors, empty for other roles):

```json
{ "id": 4, "lecturer_code": "RA23-1", "name": "Roger Laurent", "email": "roger.laurent@binus.edu",
  "binusian_id": null, "role": "HoP", "created_at": "2026-11-15T07:29:46.052Z",
  "hop_major": [{ "id": 6, "name": "Computer Science" }] }
```

**Errors.** `400` with a list of problems (for example `["pageSize is Too big: expected number to be <=200"]` or `["page is too high: (page - 1) × pageSize must be at most 4294967295"]`), `401` / `403` as above, `500` `Fetch Failed`.

**Calling them from the frontend.**

```ts
const params = new URLSearchParams({ search, page: String(page), pageSize: "50" });
const response = await fetch(
  `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/get-student-accounts?${params}`,
  { credentials: "include" }
);
const result = await response.json();
if (response.ok && result.status) {
  const { items, total } = result.data;
}
```

Manage Users and the demo use these paged student and staff routes. `get-user` remains available for clients that need staff grouped by role without pagination.

## JSON demo integration

The same accounts can be created by `POST /api/user/admin/data-tools/imports/save` after JSON preview. The demo and Manage Users read them through the account routes above. Student items additionally include nullable `major_code`; staff items include nullable `major_codes`. These retain imported source text and do not create HoP-major assignments. See [the demo guide](demo.md#account-route-integration) for the complete workflow.
