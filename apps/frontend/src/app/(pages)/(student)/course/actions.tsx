const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const getAllCategory = async () => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}category/all`
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

export const getAllTech = async () => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}technology/all`
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

export const insertProject = async ({
  lecturerId,
  studentLeaderId,
  title,
  description,
  semesterId,
  courseId,
  className,
  githubLink,
  projectLink,
  videoLink,
  thumbnail,
  documentation,
  gallery,
  categoryId,
  selectedTechnologies,
  majorId,
  groupMembersId,
  group,
}: {
  lecturerId: string;
  studentLeaderId: string;
  title: string;
  description: string;
  semesterId: string;
  courseId: string;
  className: string;
  githubLink: string;
  projectLink: string;
  videoLink: string;
  thumbnail?: File | undefined;
  documentation?: File | undefined;
  gallery: File[];
  categoryId: string;
  selectedTechnologies: string[];
  majorId: number;
  groupMembersId: string[];
  group: number;
}) => {
  try {
    const thumbnailBase64 = thumbnail ? await fileToBase64(thumbnail) : "";
    const documentationBase64 = documentation
      ? await fileToBase64(documentation)
      : "";
    const galleryBase64 = gallery
      ? await Promise.all(gallery.map(fileToBase64))
      : "";

    const payload = {
      lecturer_id: lecturerId,
      student_leader_id: studentLeaderId,
      title,
      semester_id: semesterId,
      course_id: courseId,
      class: className,
      github_link: githubLink,
      project_link: projectLink,
      video_link: videoLink,
      documentation: documentationBase64,
      thumbnail: thumbnailBase64,
      description,
      status_id: 1,
      category_id: Number(categoryId),
      major_id: 6,
      gallery: galleryBase64,
      group_members: groupMembersId,
      technology_ids: selectedTechnologies,
      group: group,
    };
    console.log(payload);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}project/insert`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    console.log(result);
    if (response.ok && result.status) {
      return { success: true, data: result.data || "" };
    } else {
      return {
        success: false,
        message: result.message || "Failed to insert project",
      };
    }
  } catch (error: any) {
    console.error("API call failed:", error.message);
  }
};

export const createGroup = async ({
  semester_id,
  course_id,
  student_ids,
  class_id,
}: {
  semester_id: string;
  course_id: string;
  class_id: string;
  student_ids: string[];
}) => {
  try {
    const groupData = {
      semester_id,
      course_id,
      class: class_id,
      student_ids,
    };

    console.log(groupData);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}group/student/insert`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(groupData),
      }
    );

    const result = await response.json();

    if (response.ok && result.status) {
      return { success: true, data: result.data || "" };
    } else {
      return {
        success: false,
        message: result.message || "Failed to create group",
      };
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

export const getProjectDetail = async (
  semester_id: string,
  course_id: string,
  class_id: string,
  student_id: string
) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}project/student/history?semester_id=${semester_id}&course_id=${course_id}&class=${class_id}&student_id=${student_id}`
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

export const getGroupDetail = async (
  semester_id: string,
  course_id: string,
  class_id: string,
  student_id: string
) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}group/student/current?semester_id=${semester_id}&course_id=${course_id}&class=${class_id}&student_id=${student_id}`
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

export const getStudentDataInClass = async (
  semester_id: string,
  course_id: string,
  class_id: string
) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}class/student/list?semester_id=${semester_id}&course_id=${course_id}&class=${class_id}`
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
