export const getAllMajor = async () => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}major/all`
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

export const getAllUsers = async (search?: string, roleFilter?: string) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/get-user?search=${search}`
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

export const updateUserRole = async (
  id: string,
  role: string,
  major_ids?: string[]
) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/update-role`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, role, major_ids }),
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

export const uploadExcelUsers = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/upload-user-excel`,
      {
        method: "POST",
        body: formData,
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

export const deleteAllUser = async () => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/remove-user-excel`,
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
