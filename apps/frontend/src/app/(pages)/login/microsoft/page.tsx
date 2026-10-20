"use client";
import { useMsal } from "@azure/msal-react";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { login } from "../actions";
import { useAuth } from "@/app/context/AuthContext";

const Page = () => {
  const { userData, setUserData } = useAuth();
  const { instance, inProgress, accounts } = useMsal();
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = async () => {
      if (inProgress === "none" && accounts.length > 0) {
        try {
          const account = accounts[0];
          if (!account) {
            throw new Error("No account found");
          }
          const response = await instance.acquireTokenSilent({
            account,
            scopes: ["user.read"],
          });

          if (!response) {
            throw new Error("Token acquisition failed");
          }

          const idToken = accounts[0]?.idToken ? accounts[0].idToken : "";
          console.log(idToken);
          const result = await login(idToken);
          console.log(result);
          if (result?.success) {
            setUserData({
              nim: result.data.nim,
              name: result.data.Name,
              email: result.data.Email,
              role: result.data.ActiveRole,
              listRole: result.data.Role,
              microsoftToken: result.data.MicrosoftToken,
            });

            console.log(result.data);
            if (result.data.ActiveRole?.toLowerCase() == "student")
              router.push("/dashboard");
            if (result.data.ActiveRole?.toLowerCase() == "lecturer")
              router.push("/dashboard-lecturer");
            if (result.data.ActiveRole?.toLowerCase() == "scc")
              router.push("/dashboard-scc");
            if (result.data.ActiveRole?.toLowerCase() == "hop")
              router.push("/dashboard-hop");
            if (result.data.ActiveRole?.toLowerCase() == "admin")
              router.push("/dashboard-admin");
          } else {
            router.push("/");
          }
        } catch (error) {
          console.error("An error occurred during redirection:", error);
        }
      } else if (inProgress === "none" && accounts.length <= 0) {
        router.push("/");
      }
    };

    handleRedirect();
  }, [instance, accounts, inProgress, router, setUserData]);

  return (
    <div className="fixed z-[100] bg-white w-screen h-screen flex justify-center items-center">
      <div className="flex-col gap-4 w-full flex items-center justify-center">
        <h1 className="font-montserrat font-bold text-2xl text-primary-binus absolute animate-pulse">
          <span className="bg-primary-binus text-white px-2 rounded-md mr-1">
            Git
          </span>
          Bee
        </h1>
        <div className="w-36 h-36 border-8 text-primary-orange text-4xl animate-spin border-gray-300 flex items-center justify-center border-t-primary-orange rounded-full"></div>
      </div>
    </div>
  );
};

export default Page;
