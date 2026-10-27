import express from "express";
import AdminUserHandler from "../../../handlers/user/admin/adminUserHandler.js";
import { AuthMiddleware } from "../../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../../middlewares/roleMiddleware.js";
import { uploadCsv } from "../../../middlewares/uploadMiddleware.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

const adminUserRoutes = express.Router();

adminUserRoutes.get("/get-user", AdminUserHandler.getUser);
adminUserRoutes.post(
  "/insert-user",
  AuthMiddleware(),
  RoleMiddleware("Admin"),
  AdminUserHandler.insertUser
);
adminUserRoutes.post(
  "/set-password",
  AuthMiddleware(),
  RoleMiddleware("Admin"),
  AdminUserHandler.setPassword
);
adminUserRoutes.patch(
  "/update-role",
  AuthMiddleware(),
  RoleMiddleware("Admin"),
  AdminUserHandler.updateRole
);
adminUserRoutes.post(
  "/upload-student-csv",
  AuthMiddleware(),
  RoleMiddleware("Admin"),
  uploadCsv,
  AdminUserHandler.handleStudentCsvUpload
);
adminUserRoutes.post(
  "/upload-staff-csv",
  AuthMiddleware(),
  RoleMiddleware("Admin"),
  uploadCsv,
  AdminUserHandler.handleStaffCsvUpload
);
adminUserRoutes.post("/upload-user-excel", upload.single("file"), AdminUserHandler.uploadUserExcel);
adminUserRoutes.patch("/remove-user-excel", AdminUserHandler.removeUserExcel);

adminUserRoutes.get("/get-transaction", AdminUserHandler.getAllTransaction);
adminUserRoutes.post("/upload-transaction-excel", upload.single("file"), AdminUserHandler.uploadTransactionExcel);
adminUserRoutes.patch("/remove-transaction-excel", AdminUserHandler.removeTransactionExcel);

adminUserRoutes.get("/get-student", AdminUserHandler.getAllStudent);
adminUserRoutes.post("/upload-student-excel", upload.single("file"), AdminUserHandler.uploadStudentExcel);
adminUserRoutes.patch("/remove-student-excel", AdminUserHandler.removeStudentExcel);

export default adminUserRoutes;