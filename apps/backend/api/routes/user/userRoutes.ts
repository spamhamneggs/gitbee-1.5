import express from "express";
import multer from "multer";
import UserHandler from "../../handlers/user/userHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../middlewares/roleMiddleware.js";
import { currentAdminMiddleware } from "../../middlewares/currentAdminMiddleware.js";
import { uploadCsv } from "../../middlewares/uploadMiddleware.js";
import dataToolsRoutes from "./admin/dataToolsRoutes.js";

const uploadExcel = multer({ storage: multer.memoryStorage() }).single("file");

const userRoutes = express.Router();
const adminAuth = [AuthMiddleware(), RoleMiddleware("Admin")];
if (process.env.DEMO_TOOLS === "true") {
    userRoutes.use("/admin/data-tools", dataToolsRoutes);
}

// Staff accounts
userRoutes.get("/admin/get-user", ...adminAuth, currentAdminMiddleware, UserHandler.listUsers);
userRoutes.post("/admin/insert-user", ...adminAuth, currentAdminMiddleware, UserHandler.createUser);
userRoutes.post("/admin/set-password", ...adminAuth, currentAdminMiddleware, UserHandler.setPassword);
userRoutes.patch("/admin/update-role", ...adminAuth, currentAdminMiddleware, UserHandler.updateRole);

// User imports
userRoutes.post("/admin/upload-student-csv", AuthMiddleware(), RoleMiddleware("Admin"), uploadCsv, UserHandler.importStudentsCsv);
userRoutes.post("/admin/upload-staff-csv", AuthMiddleware(), RoleMiddleware("Admin"), uploadCsv, UserHandler.importStaffCsv);
// Read back the accounts the CSV imports create (paged; ?search=&page=&pageSize=)
userRoutes.get("/admin/get-student-accounts", ...adminAuth, currentAdminMiddleware, UserHandler.listStudentAccounts);
userRoutes.get("/admin/get-staff-accounts", ...adminAuth, currentAdminMiddleware, UserHandler.listStaffAccounts);
userRoutes.patch("/admin/remove-user-excel", ...adminAuth, currentAdminMiddleware, UserHandler.deleteAllLecturers);

// Class transactions (which lecturer teaches which class)
userRoutes.get("/admin/get-transaction", ...adminAuth, UserHandler.listClassTransactions);
userRoutes.post("/admin/upload-transaction-excel", ...adminAuth, uploadExcel, UserHandler.importClassTransactionsExcel);
userRoutes.patch("/admin/remove-transaction-excel", ...adminAuth, UserHandler.deleteAllClassTransactions);

// Student enrolments (class rosters)
userRoutes.get("/admin/get-student", ...adminAuth, UserHandler.listStudentEnrolments);
userRoutes.post("/admin/upload-student-excel", ...adminAuth, uploadExcel, UserHandler.importStudentEnrolmentsExcel);
userRoutes.patch("/admin/remove-student-excel", ...adminAuth, UserHandler.deleteAllStudentEnrolments);
// Student enrolments (class rosters). These rows drive My Courses and project
// group eligibility, and the removal route wipes every enrolment, so all three
// require an admin.
userRoutes.get("/admin/get-student", currentAdminMiddleware, UserHandler.listStudentEnrolments);
userRoutes.post("/admin/upload-student-excel", currentAdminMiddleware, uploadExcel, UserHandler.importStudentEnrolmentsExcel);
userRoutes.patch("/admin/remove-student-excel", currentAdminMiddleware, UserHandler.deleteAllStudentEnrolments);

export default userRoutes;
