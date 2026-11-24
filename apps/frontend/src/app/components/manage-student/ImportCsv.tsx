import {
  uploadStudentsCsv,
  type StudentCsvReport,
} from "@/app/(pages)/(admin)/manage-student/actions";
import CsvImporter, {
  type CsvImportResult,
  type CsvReport,
  type CsvTypeOption,
} from "@/app/components/csv-import/CsvImporter";

interface ImportCsvProps {
  setOpenImportCsv: (value: boolean) => void;
  fetchData: () => void;
}

const studentOptions: Record<string, CsvTypeOption> = {
  student: {
    label: "Students",
    template: "/csv/students-template.csv",
    columns: "nim, name, email, binusian_id (optional), major_code, password",
  },
};

function ImportCsv(props: ImportCsvProps) {
  const uploadFn = async (file: File): Promise<CsvImportResult> => {
    const result = await uploadStudentsCsv(file);
    return result as { success: true; data: CsvReport } | { success: false; message: string };
  };

  return (
    <CsvImporter
      title="Import students from CSV"
      options={studentOptions}
      defaultOption="student"
      uploadFn={uploadFn}
      onClose={() => props.setOpenImportCsv(false)}
      onImported={() => props.fetchData()}
    />
  );
}

export default ImportCsv;
