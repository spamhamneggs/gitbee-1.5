export const getAllGroupByClass = async (
  semester_id: string,
  course_id: string,
  class_id: string
) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}project/lecturer/class?semester_id=${semester_id}&course_id=${course_id}&class=${class_id}`
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

export const deleteGroup = async (
  semester_id: string,
  course_id: string,
  class_id: string,
  group: string
) => {
  try {
    const groupData = {
      semester_id,
      course_id,
      class: class_id,
      group,
    };

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}group/lecturer/remove`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(groupData),
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

export const finalizeClassProject = async (
  semester_id: string,
  course_id: string,
  class_id: string,
  lecturer_id: string,
  assessments: any[]
) => {
  try {
    const groupData = {
      semester_id,
      course_id,
      class: class_id,
      lecturer_id,
      assessments,
    };

    console.log(groupData);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}assessment/insert`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(groupData),
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
