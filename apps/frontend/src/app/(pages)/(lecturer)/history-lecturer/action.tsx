export const getAllSemester = async () => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}semester/all`
    );
    const result = await response.json();

    if (result.status) {
      return {
        success: true,
        data: result.data ? result.data.reverse().slice(0, 7) : "",
      };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error: any) {
    console.error("API call failed:", error.message);
  }
};

export const getCurrentSemester = async () => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}semester/current`
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

export const getHistoryByLecturer = async (
  semester_id: string,
  lecturer_id: string,
  search: string
) => {
  try {
    console.log(semester_id);
    console.log(lecturer_id);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}project/lecturer/all-reviewed?semester_id=${semester_id}&lecturer_id=${lecturer_id}&search=${search}`
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
