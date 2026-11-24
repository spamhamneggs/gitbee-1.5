import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { LuDownload } from "react-icons/lu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  dropCsvFiles,
  pickCsvFile,
  type SelectionOutcome,
} from "./csvSelection";

export interface CsvReport {
  totalParsed: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  errors: { line: number; errors: string[] }[];
}

export type CsvImportResult =
  | { success: true; data: CsvReport }
  | { success: false; message: string };

export interface CsvTypeOption {
  label: string;
  template: string;
  columns: string;
}

interface CsvImporterProps {
  title: string;
  options: Record<string, CsvTypeOption>;
  defaultOption: string;
  uploadFn: (file: File, type: string) => Promise<CsvImportResult>;
  onClose: () => void;
  onImported: (type: string) => void;
  /** The button that opened the dialog, so focus returns to it on close. */
  restoreFocusRef?: { current: HTMLElement | null } | undefined;
}

// The report lists skipped duplicates as well as rejected rows, in file order,
// so a rejected row can sit behind many skipped ones. Show this many lines at
// first; "Show all" reveals the rest.
const INITIAL_LISTED_LINES = 50;

function CsvImporter({
  title,
  options,
  defaultOption,
  uploadFn,
  onClose,
  onImported,
  restoreFocusRef,
}: CsvImporterProps) {
  const optionKeys = Object.keys(options);
  const [type, setType] = useState(defaultOption);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<CsvReport | null>(null);
  const [showAllLines, setShowAllLines] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetReport = () => {
    setReport(null);
    setShowAllLines(false);
  };

  const applySelection = (outcome: SelectionOutcome) => {
    if (outcome.kind === "ignored") return;
    // A rejected selection keeps the previous import report on screen; only a
    // newly chosen valid file makes it stale.
    if (outcome.kind === "selected") resetReport();
    setError(outcome.kind === "rejected" ? outcome.error : null);
    setSelectedFile(outcome.file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (uploading) return;
    // A drop with no files (e.g. plain text) resolves to "ignored", so the
    // selection, the error and the import report are all left untouched.
    applySelection(dropCsvFiles(selectedFile, event.dataTransfer.files));
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
    setError(null);
    const result = await uploadFn(selectedFile, type);
    setUploading(false);
    if (result.success) {
      setReport(result.data);
      setShowAllLines(false);
      onImported(type);
    } else {
      // Only a successful import replaces the report; a failure leaves the last
      // one visible alongside its reason.
      setError(result.message);
    }
  };

  // `type` starts as `defaultOption` and only ever changes to another key of
  // `options`, so the lookup is always defined; the fallback covers the case
  // where a stored type no longer matches the available options.
  const current = options[type] ?? options[defaultOption]!;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[34rem] max-h-[90vh] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          if (restoreFocusRef?.current) {
            event.preventDefault();
            restoreFocusRef.current.focus();
          }
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Upload a CSV file of accounts.
        </DialogDescription>
        <div className="flex justify-between items-center gap-4">
          <h2 className="text-xl font-medium">{title}</h2>
          <Link
            href={current.template}
            download
            className="text-primary-orange flex justify-center items-center gap-1 whitespace-nowrap"
          >
            <LuDownload className="text-primary-orange stroke-primary-orange" />
            Template
          </Link>
        </div>

        {optionKeys.length > 1 && (
          <div
            className="flex gap-2"
            role="radiogroup"
            aria-label="Account type"
          >
            {optionKeys.map((option) => (
              <button
                key={option}
                type="button"
                disabled={uploading}
                role="radio"
                aria-checked={type === option}
                onClick={() => {
                  if (option === type) return;
                  setType(option);
                  // A staff CSV and a student CSV have incompatible required
                  // columns, so a file chosen for one type can never be valid
                  // for the other. Drop the selection (and the native picker's
                  // value) instead of letting a stale file be re-uploaded to the
                  // wrong endpoint.
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  resetReport();
                  setError(null);
                }}
                className={`flex-1 py-2 px-4 rounded-sm border ${
                  type === option
                    ? "bg-primary-binus text-white border-primary-binus"
                    : "bg-transparent text-primary-binus hover:bg-gray-50"
                }`}
              >
                {options[option]!.label}
              </button>
            ))}
          </div>
        )}

        <p className="text-sm text-gray-600">Columns: {current.columns}</p>

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
              applySelection(pickCsvFile(input.files?.[0] ?? null));
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
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}

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
      </DialogContent>
    </Dialog>
  );
}

export default CsvImporter;
