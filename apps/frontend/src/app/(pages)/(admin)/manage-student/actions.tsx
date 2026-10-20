export const getAllStudents = async (search: string) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/get-student?search=${search}`
    );
    const result = await response.json();

    if (result.status) {
      return { success: true, data: result.data ? result.data : "" };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error: any) {
    console.error("API call failed:", error.message);
  }
};

export const uploadExcelStudents = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/upload-student-excel`,
      {
        method: "POST",
        body: formData,
      }
    );
    const result = await response.json();

    if (result.status) {
      return { success: true, data: result.data ? result.data : "" };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error: any) {
    console.error("API call failed:", error.message);
  }
};

export const deleteAllStudents = async () => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/remove-student-excel`,
      {
        method: "PATCH",
      }
    );
    const result = await response.json();

    console.log(result);
    if (result.status) {
      return { success: true, data: result.data ? result.data : "" };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error: any) {
    console.error("API call failed:", error.message);
  }
};
