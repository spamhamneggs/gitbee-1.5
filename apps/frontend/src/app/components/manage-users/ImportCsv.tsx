import {
  uploadUsersCsv,
  type UserCsvReport,
  type UserCsvType,
} from "@/app/(pages)/(admin)/manage-users/actions";
import CsvImporter, {
  type CsvImportResult,
  type CsvReport,
  type CsvTypeOption,
} from "@/app/components/csv-import/CsvImporter";

interface ImportCsvProps {
  setOpenImportCsv: (value: boolean) => void;
  fetchData: (type: UserCsvType) => void;
}

const csvTypes: Record<UserCsvType, CsvTypeOption> = {
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

function ImportCsv(props: ImportCsvProps) {
  const uploadFn = async (
    file: File,
    type: string,
  ): Promise<CsvImportResult> => {
    const result = await uploadUsersCsv(file, type as UserCsvType);
    return result as { success: true; data: CsvReport } | { success: false; message: string };
  };

  return (
    <CsvImporter
      title="Import users from CSV"
      options={csvTypes}
      defaultOption="staff"
      uploadFn={uploadFn}
      onClose={() => props.setOpenImportCsv(false)}
      onImported={(type) => props.fetchData(type as UserCsvType)}
    />
  );
}

export default ImportCsv;
