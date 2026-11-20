import { redirect } from "next/navigation";
import { LOCAL_LOGIN_ENABLED } from "@/lib/auth";
import LocalLoginForm from "./LocalLoginForm";

export default function LoginPage() {
  if (!LOCAL_LOGIN_ENABLED) {
    redirect("/login/microsoft");
  }

  return <LocalLoginForm />;
}