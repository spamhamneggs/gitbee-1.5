"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./demo.module.css";

type Row = Record<string, string | number | boolean | null>;
type Table = {
  name: string;
  model: string;
  count: number;
  columns: {
    name: string;
    type: string;
    required: boolean;
    primaryKey: boolean;
    unique: boolean;
  }[];
  relationships: { columns: string[]; target: string; references: string[] }[];
};
type Preview = {
  totalRows: number;
  validCount: number;
  rows: Row[];
  failedRows: { row_number: number; error: string }[];
};
type Report = {
  totalParsed: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  errors: { line: number; errors: string[] }[];
};
const base = `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/data-tools`;
const headers = {
  student: ["nim", "name", "email", "binusian_id", "major_code", "password"],
  staff: [
    "lecturer_code",
    "name",
    "email",
    "binusian_id",
    "role",
    "major_codes",
    "password",
  ],
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || !result.status)
    throw new Error(
      response.status === 401
        ? "Your session expired. Sign in again at /demo-login."
        : response.status === 403
          ? "An administrator account is required."
          : typeof result.errors === "string"
            ? result.errors
            : "Request failed. Please retry.",
    );
  return result.data;
}

function Grid({
  rows,
  columns,
}: {
  rows: Row[];
  columns?: string[] | undefined;
}) {
  const keys = columns ?? Object.keys(rows[0] ?? {});
  if (!rows.length)
    return <p className={styles.empty}>No records to display.</p>;
  return (
    <div className={styles.tableScroll}>
      <table>
        <thead>
          <tr>
            {keys.map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)}>
              {keys.map((key) => (
                <td key={key}>
                  {row[key] === null ? (
                    <span className={styles.null}>NULL</span>
                  ) : (
                    String(row[key] ?? "")
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DataDemo() {
  const [tab, setTab] = useState("import");
  const [type, setType] = useState<"student" | "staff">("student");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dbError, setDbError] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [selected, setSelected] = useState("user");
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = tables.find((table) => table.name === selected);

  useEffect(() => {
    const controller = new AbortController();
    api<{ tables: Table[] }>("/database", { signal: controller.signal })
      .then((data) => {
        setTables(data.tables);
        setDbError("");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setDbError(cause.message);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setRows([]);
    api<{ rows: Row[] }>(`/database/${selected}?page=${page}`, {
      signal: controller.signal,
    })
      .then((data) => {
        setRows(data.rows);
        setDbError("");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setDbError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selected, page, revision]);

  function selectFile(next: File | null) {
    setFile(next);
    setPreview(null);
    setReport(null);
    setError("");
  }
  async function upload(action: "preview" | "import") {
    if (!file) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      if (action === "preview")
        setPreview(
          await api<Preview>(`/${type}/preview`, { method: "POST", body }),
        );
      else {
        setReport(
          await api<Report>(`/${type}/import`, { method: "POST", body }),
        );
        setPreview(null);
        setPage(1);
        setRevision((value) => value + 1);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function download(format: "csv" | "xlsx", errors = false) {
    try {
      const response = await fetch(
        `${base}/samples/${type}/${format}?errors=${errors}`,
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Download failed. Check your admin session.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${type}${errors ? "-with-errors" : "-sample"}.${format}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Download failed.");
    }
  }

  return (
    <main className={styles.root}>
      <div className={styles.topline}>
        <span className={styles.eyebrow}>GITBEE / DATA WORKSPACE</span>
        <Link href="/dashboard-admin">Back to dashboard ↗</Link>
      </div>
      <div className={styles.hero}>
        <div>
          <h1>
            From spreadsheet
            <br />
            to something useful.
          </h1>
          <p>
            Import people, inspect the records, and see how the database fits
            together.
          </p>
        </div>
        <div className={styles.connection}>
          <span className={dbError ? styles.offline : styles.dot} />
          {dbError
            ? "Connection needs attention"
            : tables.length
              ? "Connected to MySQL / MariaDB"
              : "Connecting…"}
          <small>Live database · Admin access</small>
        </div>
      </div>
      <div className={styles.stats}>
        {[
          [
            "User accounts",
            tables.find((table) => table.name === "user")?.count,
          ],
          ["Projects", tables.find((table) => table.name === "project")?.count],
          [
            "Roster entries",
            tables.find((table) => table.name === "student_list_transaction")
              ?.count,
          ],
          ["Database tables", tables.length || undefined],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value ?? "—"}</strong>
          </div>
        ))}
      </div>
      <nav className={styles.tabs} aria-label="Demo sections">
        {[
          ["import", "01", "Import data"],
          ["database", "02", "Browse database"],
          ["schema", "03", "Schema & relationships"],
        ].map(([value, number, label]) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value!)}
          >
            <small>{number}</small>
            {label}
          </button>
        ))}
      </nav>
      {dbError && (
        <div role="alert" className={styles.error}>
          {dbError} <Link href="/demo-login">Sign in</Link> ·{" "}
          <button onClick={() => setRevision((value) => value + 1)}>
            Retry connection
          </button>
        </div>
      )}
      {tab === "import" && (
        <>
          <div className={styles.importLayout}>
            <section className={styles.card}>
              <div className={styles.sectionHeading}>
                <span className={styles.step}>1</span>
                <div>
                  <h2>Choose your data</h2>
                  <p>Start with a sample or bring your own file.</p>
                </div>
              </div>
              <div className={styles.segment}>
                {(["student", "staff"] as const).map((value) => (
                  <button
                    disabled={busy}
                    aria-pressed={type === value}
                    key={value}
                    onClick={() => {
                      setType(value);
                      selectFile(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    {value === "student" ? "Students" : "Staff"}
                  </button>
                ))}
              </div>
              <div className={styles.downloads}>
                <button onClick={() => download("csv")}>↓ Sample CSV</button>
                <button onClick={() => download("xlsx")}>↓ Sample Excel</button>
              </div>
              <button
                className={styles.textButton}
                onClick={() => download("xlsx", true)}
              >
                Try an Excel file with errors ↗
              </button>
              <div className={styles.note}>
                <strong>What goes into the database?</strong>
                <p>
                  Valid rows create accounts in <code>user</code>. Passwords are
                  hashed. Existing accounts are skipped. No existing records are
                  replaced.
                </p>
              </div>
              <details>
                <summary>Required columns & import rules</summary>
                <div className={styles.chips}>
                  {headers[type].map((header) => (
                    <code key={header}>{header}</code>
                  ))}
                </div>
                <p className={styles.muted}>
                  Keep identifiers as text to preserve leading zeroes. All
                  headers are required; binusian_id cells may be blank. Excel
                  must have one sheet with plain values.
                </p>
                <p className={styles.muted}>
                  Major codes are validated as text but are not stored: the
                  current schema has no student-major relation or major-code
                  lookup. HoP imports are rejected until that lookup exists.
                </p>
              </details>
            </section>
            <section className={styles.card}>
              <div className={styles.sectionHeading}>
                <span className={styles.step}>2</span>
                <div>
                  <h2>Preview, then import</h2>
                  <p>Check the file before writing to the database.</p>
                </div>
              </div>
              <label className={styles.dropzone}>
                <span className={styles.uploadIcon}>↑</span>
                <strong>{file ? file.name : "Choose a spreadsheet"}</strong>
                <span>CSV or Excel (.xlsx) · Up to 5 MB · 1,000 rows</span>
                <input
                  ref={fileInput}
                  aria-label="Spreadsheet file"
                  type="file"
                  accept=".csv,.xlsx"
                  disabled={busy}
                  onChange={(event) =>
                    selectFile(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              <div className={styles.actions}>
                <button
                  className={styles.secondary}
                  disabled={!file || busy || !!report}
                  onClick={() => upload("preview")}
                >
                  {busy && !preview ? "Checking…" : "Validate & preview"}
                </button>
                <button
                  className={styles.primary}
                  disabled={!preview?.validCount || busy || !!report}
                  onClick={() => upload("import")}
                >
                  {busy && preview ? "Importing…" : "Import to database →"}
                </button>
              </div>
              <p className={styles.muted}>
                Preview checks fields and formatting. Duplicate accounts and HoP
                restrictions are checked during import.
              </p>
              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}
            </section>
          </div>
          {preview && (
            <section className={styles.card} aria-live="polite">
              <h2>Validation preview</h2>
              <p>
                {preview.totalRows} rows found · {preview.validCount} pass field
                validation · {preview.failedRows.length} invalid
              </p>
              <Grid rows={preview.rows} />
              <p className={styles.muted}>
                Showing the first 10 valid rows. Passwords are hidden.
              </p>
              {preview.failedRows.length > 0 && (
                <div className={styles.issues}>
                  {preview.failedRows.map((row) => (
                    <p key={row.row_number}>
                      <strong>Row {row.row_number}</strong> {row.error}
                    </p>
                  ))}
                </div>
              )}
            </section>
          )}
          {report && (
            <section className={styles.card} aria-live="polite">
              <div className={styles.sectionHeading}>
                <span className={styles.step}>✓</span>
                <div>
                  <h2>Import completed</h2>
                  <p>{report.totalParsed} rows processed</p>
                </div>
              </div>
              <div className={styles.resultStats}>
                <span>
                  <strong>{report.createdCount}</strong> created
                </span>
                <span>
                  <strong>{report.skippedCount}</strong> skipped
                </span>
                <span>
                  <strong>{report.failedCount}</strong> failed
                </span>
              </div>
              {report.errors.length > 0 && (
                <div className={styles.issues}>
                  {report.errors.map((row, index) => (
                    <p key={`${row.line}-${index}`}>
                      <strong>Row {row.line}</strong> {row.errors.join("; ")}
                    </p>
                  ))}
                </div>
              )}
              <button
                className={styles.primary}
                onClick={() => {
                  setSelected("user");
                  setPage(1);
                  setTab("database");
                }}
              >
                View saved users →
              </button>
              <p className={styles.muted}>
                Select the file again to demonstrate duplicate handling.
              </p>
            </section>
          )}
        </>
      )}
      {tab === "database" && (
        <section className={styles.card}>
          <div className={styles.toolbar}>
            <div>
              <h2>Inside the database</h2>
              <p>
                Live rows, newest first. Read-only view; credentials are
                excluded.
              </p>
            </div>
            <button
              className={styles.secondary}
              onClick={() => setRevision((value) => value + 1)}
            >
              ↻ Refresh
            </button>
          </div>
          <div className={styles.databaseLayout}>
            <aside className={styles.tableList} aria-label="Database tables">
              {tables.map((table) => (
                <button
                  aria-pressed={selected === table.name}
                  key={table.name}
                  onClick={() => {
                    setSelected(table.name);
                    setPage(1);
                  }}
                >
                  {table.name}
                  <span>{table.count}</span>
                </button>
              ))}
            </aside>
            <div className={styles.records}>
              <div className={styles.toolbar}>
                <h3>{selected}</h3>
                <span className={styles.badge}>
                  {active?.count ?? 0} records
                </span>
              </div>
              {loading ? (
                <p role="status">Loading records…</p>
              ) : (
                <Grid
                  rows={rows}
                  columns={active?.columns.map((column) => column.name)}
                />
              )}
              <div className={styles.pagination}>
                <button
                  disabled={page === 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                >
                  ← Previous
                </button>
                <span>
                  Page {page} of{" "}
                  {Math.max(1, Math.ceil((active?.count ?? 0) / 20))}
                </span>
                <button
                  disabled={page * 20 >= (active?.count ?? 0) || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
      {tab === "schema" && (
        <section className={styles.card}>
          <h2>How the data connects</h2>
          <p>
            The Prisma schema defines {tables.length} application tables.
            Foreign keys below are enforced by the database.
          </p>
          <div className={styles.flow}>
            <div>
              <small>ACCOUNTS</small>
              <strong>user</strong>
              <span>Students & staff</span>
            </div>
            <span>↔</span>
            <div>
              <small>PROJECT HUB</small>
              <strong>project</strong>
              <span>Details · groups · reviews</span>
            </div>
            <span>↔</span>
            <div>
              <small>REFERENCE DATA</small>
              <strong>major · status · category</strong>
              <span>Project classification</span>
            </div>
          </div>
          <p className={styles.muted}>
            Account-to-project links use student IDs and lecturer codes, not
            foreign keys. Class rosters are snapshots. Major codes in imports
            are not currently mapped.
          </p>
          <div className={styles.schemaGrid}>
            {tables.map((table) => (
              <details className={styles.schemaCard} key={table.name}>
                <summary>
                  <strong>{table.name}</strong>
                  <span>{table.columns.length} visible columns</span>
                </summary>
                <table>
                  <tbody>
                    {table.columns.map((column) => (
                      <tr key={column.name}>
                        <td>
                          {column.name}
                          {column.primaryKey ? " 🔑" : ""}
                        </td>
                        <td>
                          {column.type}
                          {column.required ? "" : "?"}
                          {column.unique ? " · unique" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {table.relationships.map((relation, index) => (
                  <p key={index}>
                    <code>{relation.columns.join(", ")}</code> →{" "}
                    <strong>{relation.target}</strong> (
                    {relation.references.join(", ")})
                  </p>
                ))}
                {!table.relationships.length && (
                  <p className={styles.muted}>No outgoing foreign keys.</p>
                )}
              </details>
            ))}
          </div>
        </section>
      )}
      <footer className={styles.workspaceFooter}>
        <span>GitBee data workspace</span>
        <span>CSV / XLSX → validation → account import → MySQL</span>
      </footer>
    </main>
  );
}
