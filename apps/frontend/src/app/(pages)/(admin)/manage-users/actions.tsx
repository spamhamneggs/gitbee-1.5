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
      `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/get-user?search=${search}`,
      { credentials: "include" }
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
        credentials: "include",
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

export type UserCsvType = "staff" | "student";

export interface UserCsvReport {
  totalParsed: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  errors: { line: number; errors: string[] }[];
}

type UserCsvResult =
  | { success: true; data: UserCsvReport }
  | { success: false; message: string };

// Imports staff or student accounts from a CSV file. The response reports
// every rejected row, so the caller can show what to fix.
export const uploadUsersCsv = async (
  file: File,
  type: UserCsvType
): Promise<UserCsvResult> => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}user/admin/upload-${type}-csv`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );
    const result = await response.json();

    if (response.ok && result.status && result.data) {
      return { success: true, data: result.data as UserCsvReport };
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
