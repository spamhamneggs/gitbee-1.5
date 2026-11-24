// Browsers ignore the input's accept="" for dropped files, so the portal
// enforces the .csv extension itself and lets the server validate the contents.
// Compare the suffix literally instead of with a `.` regex: `.` never matches a
// line separator (e.g. U+2028), so such a name would be rejected here but
// accepted by the server. The stem is required separately, because a bare ".csv"
// has no extension to the server's path.extname().
export const isCsvFile = (file: File) =>
  file.name.length > 4 && file.name.slice(-4).toLowerCase() === ".csv";

const notCsvError = "Please choose a CSV file (.csv).";
const multiDropError = "Please drop a single CSV file.";

/**
 * The outcome of a pick or a drop. Keeping the previous import report is a
 * property of the event itself, not of a file-identity comparison:
 *  - "ignored"  the event changes nothing (empty or text-only drop, cancelled picker)
 *  - "rejected" the choice is invalid: show `error` and keep the import report
 *  - "selected" a valid new file replaces both the selection and the report
 */
export type SelectionOutcome =
  | { kind: "ignored" }
  | { kind: "rejected"; file: File | null; error: string }
  | { kind: "selected"; file: File };

function chooseFile(file: File | null): SelectionOutcome {
  if (!file) return { kind: "ignored" };
  if (!isCsvFile(file)) {
    return { kind: "rejected", file: null, error: notCsvError };
  }
  return { kind: "selected", file };
}

// The picker offers a single file.
export function pickCsvFile(file: File | null): SelectionOutcome {
  return chooseFile(file);
}

// A drop can carry any number of files. Keep the current selection when the drop
// is empty, reject multi-file drops instead of silently importing just the
// first, and otherwise treat the drop like a pick.
export function dropCsvFiles(
  current: File | null,
  files: ArrayLike<File>,
): SelectionOutcome {
  if (files.length === 0) return { kind: "ignored" };
  if (files.length > 1) {
    return { kind: "rejected", file: current, error: multiDropError };
  }
  return chooseFile(files[0] ?? null);
}
