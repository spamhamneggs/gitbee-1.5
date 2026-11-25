import Link from "next/link";
import { useRef, useState } from "react";
import { LuDownload } from "react-icons/lu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImportRosterExcelProps {
  setOpen: (value: boolean) => void;
  restoreFocusRef?: { current: HTMLElement | null } | undefined;
}

// The roster upload writes class enrolments (studentListTransaction), not user
// accounts. It uses the restored POST /user/admin/upload-student-excel endpoint
// so admins can load a new term's lab roster without leaving this page.
function ImportRosterExcel({ setOpen, restoreFocusRef }: ImportRosterExcelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please choose an Excel file to upload.");
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/upload-student-excel`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );
      const result = await response.json();
      if (response.ok && result.status) {
        // createMany skips rows that already exist, so a re-upload reports 0.
        // That is not a failure, so word it as already up to date. The account
        // list is not reloaded: this import only writes class enrolments.
        const count = result.data?.count ?? 0;
        setSuccess(
          count === 0
            ? "Roster is already up to date — no new enrolments added."
            : `Imported ${count} student enrolment${count === 1 ? "" : "s"}.`
        );
      } else {
        setError(
          typeof result.errors === "string"
            ? result.errors
            : "Import failed."
        );
      }
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[34rem] max-h-[90vh] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          if (restoreFocusRef?.current) {
            event.preventDefault();
            restoreFocusRef.current.focus();
          }
        }}
      >
        <DialogTitle className="sr-only">
          Import student lab roster from Excel
        </DialogTitle>
        <DialogDescription className="sr-only">
          Upload an Excel or CSV file of student class enrolments for the
          current term.
        </DialogDescription>
        <div className="flex justify-between items-center gap-4">
          <h2 className="text-xl font-medium">
            Import student lab roster (Excel or CSV)
          </h2>
          <Link
            href="/excel/Header Student.xlsx"
            download
            className="text-primary-orange flex justify-center items-center gap-1 whitespace-nowrap"
          >
            <LuDownload className="text-primary-orange stroke-primary-orange" />
            Template
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          Upload the class roster export from BINUS. Columns are read by
          position (NIM, name, term code, course code, class) and only lab
          classes (class starting with &quot;L&quot;) are kept, so start from the
          template. This loads each student&apos;s course enrolments (used for My
          Courses and project group eligibility). It does not create or modify
          login accounts.
        </p>
        <div className="flex flex-col rounded-md border-2 border-dashed p-4 border-gray-300">
          <label
            className="block mb-2 text-sm font-medium text-gray-900"
            htmlFor="roster_file_input"
          >
            Excel or CSV file — choose a .xlsx or .csv file
          </label>
          <input
            className="block w-full text-sm text-gray-900 border border-gray-300 cursor-pointer bg-gray-50"
            id="roster_file_input"
            ref={fileInputRef}
            disabled={uploading}
            type="file"
            accept=".xlsx, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              const name = file?.name.toLowerCase() ?? "";
              if (file && !name.endsWith(".xlsx") && !name.endsWith(".csv")) {
                setError("Please choose an .xlsx or .csv file.");
                setSelectedFile(null);
                event.target.value = "";
                return;
              }
              setError(null);
              setSuccess(null);
              setSelectedFile(file);
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
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-green-600">
            {success}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ImportRosterExcel;
