import express from "express";
import multer from "multer";
import UserHandler from "../../handlers/user/userHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../middlewares/roleMiddleware.js";
import { currentAdminMiddleware } from "../../middlewares/currentAdminMiddleware.js";
import { uploadCsv } from "../../middlewares/uploadMiddleware.js";

const uploadExcel = multer({ storage: multer.memoryStorage() }).single("file");

const userRoutes = express.Router();

// Staff accounts
userRoutes.get("/admin/get-user", currentAdminMiddleware, UserHandler.listUsers);
userRoutes.post("/admin/insert-user", currentAdminMiddleware, UserHandler.createUser);
userRoutes.post("/admin/set-password", currentAdminMiddleware, UserHandler.setPassword);
userRoutes.patch("/admin/update-role", currentAdminMiddleware, UserHandler.updateRole);

// User imports
userRoutes.post("/admin/upload-student-csv", AuthMiddleware(), RoleMiddleware("Admin"), uploadCsv, UserHandler.importStudentsCsv);
userRoutes.post("/admin/upload-staff-csv", AuthMiddleware(), RoleMiddleware("Admin"), uploadCsv, UserHandler.importStaffCsv);
userRoutes.post("/admin/upload-user-excel", uploadExcel, UserHandler.importLecturersExcel);
userRoutes.patch("/admin/remove-user-excel", UserHandler.deleteAllLecturers);

// Class transactions (which lecturer teaches which class)
userRoutes.get("/admin/get-transaction", UserHandler.listClassTransactions);
userRoutes.post("/admin/upload-transaction-excel", uploadExcel, UserHandler.importClassTransactionsExcel);
userRoutes.patch("/admin/remove-transaction-excel", UserHandler.deleteAllClassTransactions);

// Student enrolments (class rosters)
userRoutes.get("/admin/get-student", UserHandler.listStudentEnrolments);
userRoutes.post("/admin/upload-student-excel", uploadExcel, UserHandler.importStudentEnrolmentsExcel);
userRoutes.patch("/admin/remove-student-excel", UserHandler.deleteAllStudentEnrolments);

export default userRoutes;
