import {
  uploadUsersCsv,
  type UserCsvReport,
  type UserCsvType,
} from "@/app/(pages)/(admin)/manage-users/actions";
import Link from "next/link";
import React, { useState } from "react";
import { LuDownload } from "react-icons/lu";

interface ImportCsvProps {
  setOpenImportCsv: (value: boolean) => void;
  fetchData: () => void;
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
    columns:
      "nim, name, email, binusian_id (optional), major_code, password",
  },
};

// Shows at most this many rejected rows; the summary still counts them all.
const MAX_LISTED_ERRORS = 50;

function ImportCsv(props: ImportCsvProps) {
  const [type, setType] = useState<UserCsvType>("staff");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<UserCsvReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please choose a CSV file to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    setReport(null);
    const result = await uploadUsersCsv(selectedFile, type);
    setUploading(false);
    if (result.success) {
      setReport(result.data);
      props.fetchData();
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
              role="radio"
              aria-checked={type === option}
              onClick={() => {
                setType(option);
                setReport(null);
                setError(null);
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

        <div className="flex flex-col">
          <label
            className="block mb-2 text-sm font-medium text-gray-900"
            htmlFor="csv_file_input"
          >
            CSV file
          </label>
          <input
            className="block w-full text-sm text-gray-900 border border-gray-300 cursor-pointer bg-gray-50"
            id="csv_file_input"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setReport(null);
              setError(null);
            }}
          />
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
              <ul className="max-h-48 overflow-y-auto border rounded-sm p-2 bg-gray-50">
                {report.errors.slice(0, MAX_LISTED_ERRORS).map((rowError) => (
                  <li
                    key={`${rowError.line}:${rowError.errors.join("|")}`}
                    className="text-red-600"
                  >
                    Line {rowError.line}: {rowError.errors.join("; ")}
                  </li>
                ))}
                {report.errors.length > MAX_LISTED_ERRORS && (
                  <li className="text-gray-600">
                    …and {report.errors.length - MAX_LISTED_ERRORS} more.
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportCsv;
