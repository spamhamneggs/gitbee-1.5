import { uploadExcelUsers } from "@/app/(pages)/(admin)/manage-users/actions";
import Link from "next/link";
import React, { useState } from "react";
import { LuDownload } from "react-icons/lu";

interface ImportExcelProps {
  setOpenImportExcel: (value: boolean) => void;
  fetchData: any;
}

function ImportExcel(props: ImportExcelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file) {
        setSelectedFile(file);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus("Please select a file to upload.");
      return;
    }

    setUploadStatus("Uploading...");
    try {
      const result = await uploadExcelUsers(selectedFile);
      if (result?.success) {
        setUploadStatus("File uploaded successfully.");
      } else {
        setUploadStatus(`Upload failed: ${result?.message}`);
      }
    } catch (error) {
      setUploadStatus("An error occurred while uploading the file.");
    }
    props.fetchData();
    props.setOpenImportExcel(false);
  };

  return (
    <div
      className="fixed bg-black/50 w-full h-screen top-0 left-0 z-50 flex justify-center items-center py-10 px-20"
      onClick={() => props.setOpenImportExcel(false)}
    >
      <div
        className="bg-white w-full max-w-[30rem] max-h-full h-fit overflow-y-auto rounded-md p-10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <Link
          href="/excel/Header Transaction + Lecturer.xlsx"
          className="self-end text-primary-orange flex justify-center items-center gap-1"
        >
          <LuDownload className="text-primary-orange stroke-primary-orange"/>
          Download Template
        </Link>
        <div className="flex flex-col justify-start items-start">
          <label
            className="block mb-2 text-sm font-medium text-gray-900"
            htmlFor="file_input"
          >
            Upload file
          </label>
          <input
            className="block w-full text-sm text-gray-900 border border-gray-300 cursor-pointer bg-gray-50"
            id="file_input"
            type="file"
            accept=".xlsx, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
            onChange={handleFileChange}
          />
        </div>
        <button
          className="mt-4 bg-primary-binus text-white px-4 py-2 rounded"
          onClick={handleUpload}
        >
          Upload
        </button>
        {uploadStatus && (
          <p className="mt-4 text-sm text-red-500">{uploadStatus}</p>
        )}
      </div>
    </div>
  );
}

export default ImportExcel;
