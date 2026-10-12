/**
 * Static student data lookup for offline seeding
 * Maps student_id -> { name, binusian_id }
 * This replaces the online Atlantis API calls in seed.ts
 */

export interface StudentData {
  student_id: string;
  student_name: string;
  student_binusian_id: string;
}

export const studentLookup: Record<string, StudentData> = {
  "2501959296": {
    student_id: "2501959296",
    student_name: "Alice Johnson",
    student_binusian_id: "B001959296"
  },
  "2501970166": {
    student_id: "2501970166",
    student_name: "Bob Smith",
    student_binusian_id: "B001970166"
  },
  "2540115465": {
    student_id: "2540115465",
    student_name: "Charlie Davis",
    student_binusian_id: "B040115465"
  },
  "2504829348": {
    student_id: "2504829348",
    student_name: "Diana Martinez",
    student_binusian_id: "B004829348"
  },
  "2504938217": {
    student_id: "2504938217",
    student_name: "Ethan Brown",
    student_binusian_id: "B004938217"
  },
  "2504938237": {
    student_id: "2504938237",
    student_name: "Fiona Wilson",
    student_binusian_id: "B004938237"
  },
  "2594059382": {
    student_id: "2594059382",
    student_name: "George Lee",
    student_binusian_id: "B094059382"
  }
};

/**
 * Get student data from static lookup
 * Fallback to student_id if not found
 */
export function getStudentData(student_id: string): StudentData {
  return studentLookup[student_id] ?? {
    student_id,
    student_name: student_id,
    student_binusian_id: student_id
  };
}
