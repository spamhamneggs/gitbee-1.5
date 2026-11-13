import { z } from "zod";
import type { Request, Response } from "express";
import { sendErrorResponse, sendServiceError, sendSuccessResponse } from "../../utils/response/response.js";
import validateSchema from "../../utils/validator/validateSchema.js";
import ProjectService from "../../services/project/projectService.js";
import ProjectDashboardService from "../../services/project/projectDashboardService.js";

const classQuery = {
    semester_id: z.string(),
    course_id: z.string(),
    class: z.string()
};

export default class ProjectHandler {
    static async submitProject(req: Request, res: Response) {
        try {
            const schema = z.object({
                lecturer_id: z.string(),
                student_leader_id: z.string(),
                title: z.string(),
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string(),
                github_link: z.string(),
                project_link: z.string(),
                documentation: z.string(),
                video_link: z.string(),
                thumbnail: z.string(),
                description: z.string(),
                status_id: z.number(),
                category_id: z.number(),
                major_id: z.number(),
                gallery: z.array(z.string()),
                group_members: z.array(z.string()).optional(),
                technology_ids: z.array(z.number()),
                group: z.number()
            });

            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            const requester = res.locals.authPayload as { nim?: unknown } | undefined;
            sendSuccessResponse(res, await ProjectService.submitProject(validationResult.data, requester?.nim));
        } catch (error) {
            sendServiceError(res, error, "Insert Failed");
        }
    }

    static async listExploreProjects(req: Request, res: Response) {
        try {
            const schema = z.object({
                search: z.string().optional(),
                categoryFilter: z.string().optional(),
                majorFilter: z.string().optional(),
                technologyFilter: z.string().optional(),
                semester_id: z.string().optional()
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ProjectService.listExploreProjects(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async getProject(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(z.object({ id: z.string() }), req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ProjectService.getProjectDetail(Number(validationResult.data.id)));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async toggleProjectDisabled(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(z.object({ project_id: z.string() }), req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ProjectService.toggleProjectDisabled(Number(validationResult.data.project_id)));
        } catch (error) {
            sendServiceError(res, error, "Unknown Error");
        }
    }

    static async listLecturerClassProjects(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(z.object(classQuery), req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ProjectService.listLecturerClassProjects(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async listLecturerGradedProjects(req: Request, res: Response) {
        try {
            const schema = z.object({
                semester_id: z.string().optional(),
                lecturer_id: z.string(),
                search: z.string().optional()
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ProjectService.listLecturerGradedProjects(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async listStudentClassProjects(req: Request, res: Response) {
        try {
            const schema = z.object({ ...classQuery, student_id: z.string() });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ProjectService.listStudentClassProjects(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async listStudentProjects(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(z.object({ student_id: z.string() }), req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ProjectService.listStudentProjects(validationResult.data.student_id));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async getAdminDashboard(req: Request, res: Response) {
        try {
            const schema = z.object({
                search: z.string().optional(),
                majorFilter: z.string().optional(),
                categoryFilter: z.string().optional(),
                semester_id: z.string().optional()
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ProjectDashboardService.getAdminDashboard(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async getHopDashboard(req: Request, res: Response) {
        try {
            const schema = z.object({
                major_id: z.string(),
                semester_id: z.string(),
                is_outstanding: z.string().optional(),
                search: z.string().optional()
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ProjectDashboardService.getHopDashboard(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async getSccDashboard(req: Request, res: Response) {
        try {
            const schema = z.object({
                major_id: z.string().optional(),
                semester_id: z.string(),
                is_recommended: z.string().optional(),
                search: z.string().optional()
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ProjectDashboardService.getSccDashboard(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }
}
