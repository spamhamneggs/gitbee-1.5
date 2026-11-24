export interface StudentCsvReport {
  totalParsed: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  errors: { line: number; errors: string[] }[];
}

type StudentCsvResult =
  | { success: true; data: StudentCsvReport }
  | { success: false; message: string };

// Imports student accounts from a CSV file. The response reports every rejected
// row, so the caller can show what to fix.
export const uploadStudentsCsv = async (
  file: File
): Promise<StudentCsvResult> => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/upload-student-csv`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );
    const result = await response.json();

    if (response.ok && result.status && result.data) {
      return { success: true, data: result.data as StudentCsvReport };
    }
    return {
      success: false,
      message:
        typeof result.errors === "string" ? result.errors : "Import failed.",
    };
  } catch {
    return {
      success: false,
      message: "Couldn't reach the server. Please try again.",
    };
  }
};
