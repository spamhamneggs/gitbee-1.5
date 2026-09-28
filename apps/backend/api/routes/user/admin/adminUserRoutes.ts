import express from "express";
import AdminUserHandler from "../../../handlers/user/admin/adminUserHandler.js";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

const adminUserRoutes = express.Router();

adminUserRoutes.get("/get-user", AdminUserHandler.getUser);
adminUserRoutes.post("/insert-user", AdminUserHandler.insertUser);
adminUserRoutes.patch("/update-role", AdminUserHandler.updateRole);
adminUserRoutes.post("/upload-user-excel", upload.single("file"), AdminUserHandler.uploadUserExcel);
adminUserRoutes.patch("/remove-user-excel", AdminUserHandler.removeUserExcel);

adminUserRoutes.get("/get-transaction", AdminUserHandler.getAllTransaction);
adminUserRoutes.post("/upload-transaction-excel", upload.single("file"), AdminUserHandler.uploadTransactionExcel);
adminUserRoutes.patch("/remove-transaction-excel", AdminUserHandler.removeTransactionExcel);

adminUserRoutes.get("/get-student", AdminUserHandler.getAllStudent);
adminUserRoutes.post("/upload-student-excel", upload.single("file"), AdminUserHandler.uploadStudentExcel);
adminUserRoutes.patch("/remove-student-excel", AdminUserHandler.removeStudentExcel);

export default adminUserRoutes;