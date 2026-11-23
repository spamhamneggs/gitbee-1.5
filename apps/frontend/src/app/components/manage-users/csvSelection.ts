// Browsers ignore the input's accept="" for dropped files, so the portal
// enforces the .csv extension itself and lets the server validate the contents.
// Compare the suffix literally instead of with a `.` regex: `.` never matches a
// line separator (e.g. U+2028), so such a name would be rejected here but
// accepted by the server. The stem is required separately, because a bare ".csv"
// has no extension to the server's path.extname().
export const isCsvFile = (file: File) =>
  file.name.length > 4 && file.name.slice(-4).toLowerCase() === ".csv";

export interface CsvSelection {
  file: File | null;
  error: string | null;
}

// A file chosen from the picker, or the single file of a drop.
export function selectCsvFile(file: File | null): CsvSelection {
  if (file && !isCsvFile(file)) {
    return { file: null, error: "Please choose a CSV file (.csv)." };
  }
  return { file, error: null };
}

// A drop can carry any number of files. Keep the current selection when the
// drop is empty, reject multi-file drops instead of silently importing just the
// first, and otherwise treat the drop like a pick.
export function selectDroppedCsvFiles(
  current: File | null,
  files: ArrayLike<File>,
): CsvSelection {
  if (files.length === 0) return { file: current, error: null };
  if (files.length > 1) {
    return { file: current, error: "Please drop a single CSV file." };
  }
  return selectCsvFile(files[0] ?? null);
}
