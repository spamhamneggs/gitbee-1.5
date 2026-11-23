import {
  uploadUsersCsv,
  type UserCsvReport,
  type UserCsvType,
} from "@/app/(pages)/(admin)/manage-users/actions";
import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { LuDownload } from "react-icons/lu";
import {
  selectCsvFile,
  selectDroppedCsvFiles,
  type CsvSelection,
} from "./csvSelection";

interface ImportCsvProps {
  setOpenImportCsv: (value: boolean) => void;
  fetchData: (type: UserCsvType) => void;
}

const csvTypes: Record<
  UserCsvType,
  { label: string; template: string; columns: string }
> = {
  staff: {
    label: "Staff",
    template: "/csv/staff-template.csv",
    columns:
      "lecturer_code, name, email, binusian_id (optional), role (Lecturer, SCC, HoP or Admin), major_codes (separate several with ;), password",
  },
  student: {
    label: "Students",
    template: "/csv/students-template.csv",
    columns: "nim, name, email, binusian_id (optional), major_code, password",
  },
};

// The report lists skipped duplicates as well as rejected rows, in file order,
// so a rejected row can sit behind many skipped ones. Show this many lines at
// first; "Show all" reveals the rest.
const INITIAL_LISTED_LINES = 50;

function ImportCsv(props: ImportCsvProps) {
  const [type, setType] = useState<UserCsvType>("staff");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<UserCsvReport | null>(null);
  const [showAllLines, setShowAllLines] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearResult = () => {
    setReport(null);
    setShowAllLines(false);
    setError(null);
  };

  const applySelection = (selection: CsvSelection) => {
    // A rejected drop resolves back to the current file. Keep the existing
    // import report then, and just show the drop error; only a real selection
    // change makes the previous report stale.
    if (selection.file !== selectedFile) clearResult();
    if (selection.error) setError(selection.error);
    setSelectedFile(selection.file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (uploading) return;
    // A drop with no files (e.g. plain text) changes nothing — leave the
    // current selection and the import report untouched.
    if (event.dataTransfer.files.length === 0) return;
    applySelection(selectDroppedCsvFiles(selectedFile, event.dataTransfer.files));
    // Drop bypasses the picker, so clear it too — otherwise the picker keeps
    // showing an older file and re-picking that file raises no change event.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please choose a CSV file to upload.");
      return;
    }

    setUploading(true);
    clearResult();
    const result = await uploadUsersCsv(selectedFile, type);
    setUploading(false);
    if (result.success) {
      setReport(result.data);
      props.fetchData(type);
    } else {
      setError(result.message);
    }
  };

  return (
    <div
      className="fixed bg-black/50 w-full h-screen top-0 left-0 z-50 flex justify-center items-center py-10 px-4 sm:px-20"
      onClick={() => props.setOpenImportCsv(false)}
    >
      <div
        className="bg-white w-full max-w-[34rem] max-h-full h-fit overflow-y-auto rounded-md p-6 sm:p-10 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center gap-4">
          <h2 className="text-xl font-medium">Import users from CSV</h2>
          <Link
            href={csvTypes[type].template}
            download
            className="text-primary-orange flex justify-center items-center gap-1 whitespace-nowrap"
          >
            <LuDownload className="text-primary-orange stroke-primary-orange" />
            Template
          </Link>
        </div>

        <div className="flex gap-2" role="radiogroup" aria-label="Account type">
          {(Object.keys(csvTypes) as UserCsvType[]).map((option) => (
            <button
              key={option}
              type="button"
              disabled={uploading}
              role="radio"
              aria-checked={type === option}
              onClick={() => {
                setType(option);
                clearResult();
              }}
              className={`flex-1 py-2 px-4 rounded-sm border ${
                type === option
                  ? "bg-primary-binus text-white border-primary-binus"
                  : "bg-transparent text-primary-binus hover:bg-gray-50"
              }`}
            >
              {csvTypes[option].label}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-600">
          Columns: {csvTypes[type].columns}
        </p>

        <div
          className={`flex flex-col rounded-md border-2 border-dashed p-4 transition-colors ${
            dragActive ? "border-primary-binus bg-blue-50" : "border-gray-300"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!uploading) setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!uploading) setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={handleDrop}
        >
          <label
            className="block mb-2 text-sm font-medium text-gray-900"
            htmlFor="csv_file_input"
          >
            CSV file — drag &amp; drop here, or choose a file
          </label>
          <input
            className="block w-full text-sm text-gray-900 border border-gray-300 cursor-pointer bg-gray-50"
            id="csv_file_input"
            ref={fileInputRef}
            disabled={uploading}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const input = event.target;
              applySelection(selectCsvFile(input.files?.[0] ?? null));
              // Read the file, then clear the native value so the picker's
              // selection and the React state can never disagree.
              input.value = "";
            }}
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-700">
              Selected: {selectedFile.name}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 bg-primary-binus text-white px-4 py-2 rounded disabled:opacity-60"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? "Importing..." : "Import"}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border text-primary-binus hover:bg-gray-50"
            onClick={() => props.setOpenImportCsv(false)}
          >
            Close
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {report && (
          <div className="text-sm flex flex-col gap-2" aria-live="polite">
            <p>
              Imported <strong>{report.createdCount}</strong> of{" "}
              {report.totalParsed} rows.
              {report.skippedCount > 0 &&
                ` ${report.skippedCount} skipped as already existing.`}
              {report.failedCount > 0 && ` ${report.failedCount} rejected.`}
            </p>
            {report.errors.length > 0 && (
              <ul
                id="csv_report_lines"
                className="max-h-48 overflow-y-auto border rounded-sm p-2 bg-gray-50"
              >
                {(showAllLines
                  ? report.errors
                  : report.errors.slice(0, INITIAL_LISTED_LINES)
                ).map((rowError) => (
                  <li
                    key={`${rowError.line}:${rowError.errors.join("|")}`}
                    className="text-red-600"
                  >
                    Line {rowError.line}: {rowError.errors.join("; ")}
                  </li>
                ))}
              </ul>
            )}
            {report.errors.length > INITIAL_LISTED_LINES && (
              <button
                type="button"
                className="self-start text-primary-binus underline"
                aria-controls="csv_report_lines"
                aria-expanded={showAllLines}
                onClick={() => setShowAllLines(!showAllLines)}
              >
                {showAllLines
                  ? `Show the first ${INITIAL_LISTED_LINES} lines only`
                  : `Show all ${report.errors.length} lines`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportCsv;
