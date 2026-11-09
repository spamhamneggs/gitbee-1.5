import { prisma } from "../../prisma/client.js";

export default class ClassService {
    /** The lecturer's classes in a semester (optionally one course), each with its enrolled student count. */
    static async listLecturerClasses(params: { semester_id: string; lecturer_id: string; course_id?: string | undefined }) {
        const classTransactions = await prisma.classTransaction.findMany({
            where: {
                semester_id: params.semester_id,
                lecturer_code: params.lecturer_id,
                ...(params.course_id ? { course_code: params.course_id } : {})
            }
        });

        const studentCounts = await Promise.all(classTransactions.map(async (classTransaction) => {
            const count = await prisma.studentListTransaction.count({
                where: {
                    semester_id: params.semester_id,
                    class: classTransaction.class,
                    course_code: classTransaction.course_code
                }
            });
            return { classId: classTransaction.id, total_students: count };
        }));

        return classTransactions.map(classTransaction => {
            const studentData = studentCounts.find(sc => sc.classId === classTransaction.id);
            return {
                ...classTransaction,
                total_students: studentData ? studentData.total_students : 0
            };
        });
    }

    /** The distinct courses the lecturer teaches in a semester. */
    static async listLecturerCourses(params: { semester_id: string; lecturer_id: string }) {
        const courses = await prisma.classTransaction.groupBy({
            by: ['course_code', 'course_name'],
            where: {
                semester_id: params.semester_id,
                lecturer_code: params.lecturer_id
            }
        });

        return courses.map((course) => ({
            course_code: course.course_code,
            course_name: course.course_name
        }));
    }

    /** The student's enrolments in a semester, with each class's lecturer, course and location. */
    static async listStudentClasses(params: { semester_id: string; student_id: string }) {
        const studentListTransactions = await prisma.studentListTransaction.findMany({
            where: {
                semester_id: params.semester_id,
                student_id: params.student_id
            }
        });

        const classTransactions = await prisma.classTransaction.findMany({
            where: {
                semester_id: params.semester_id
            }
        });

        return studentListTransactions.map((studentData) => {
            const classData = classTransactions.find(
                (classTransaction) =>
                    classTransaction.class === studentData.class &&
                    classTransaction.semester_id === studentData.semester_id &&
                    classTransaction.course_code === studentData.course_code
            );

            return {
                id: studentData.id,
                semester_id: studentData.semester_id,
                student_id: studentData.student_id,
                student_name: studentData.student_name,
                class: studentData.class,
                lecturer_code: classData?.lecturer_code ?? null,
                lecturer_name: classData?.lecturer_name ?? null,
                course_code: classData?.course_code ?? null,
                course_name: classData?.course_name ?? null,
                location: classData?.location ?? null
            };
        });
    }

    /** The class roster; `is_disable` is 1 for students already in a group or a submitted project. */
    static async listClassStudents(params: { semester_id: string; class: string; course_id: string }) {
        const studentLists = await prisma.studentListTransaction.findMany({
            where: {
                semester_id: params.semester_id,
                class: params.class,
                course_code: params.course_id
            }
        });

        const groupedStudents = await prisma.temporaryGroup.findMany({
            where: {
                semester_id: params.semester_id,
                course_id: params.course_id,
                class: params.class,
            },
            select: { student_id: true }
        });

        const projectsWithDetailsAndGroups = await prisma.project.findMany({
            where: {
                projectDetail: {
                    semester_id: params.semester_id,
                    course_id: params.course_id,
                    class: params.class,
                },
            },
            include: {
                projectGroups: {
                    select: { student_id: true },
                },
                projectDetail: true,
            },
        });

        const groupedStudentIds = new Set(groupedStudents.map((g) => g.student_id));
        const projectStudentIds = new Set(
            projectsWithDetailsAndGroups.flatMap((project) =>
                project.projectGroups.map((group) => group.student_id)
            )
        );

        return studentLists.map((student) => ({
            ...student,
            is_disable:
                groupedStudentIds.has(student.student_id) || projectStudentIds.has(student.student_id)
                    ? 1
                    : 0,
        }));
    }
}
