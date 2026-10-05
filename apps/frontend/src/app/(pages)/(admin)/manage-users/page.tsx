"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import { CiSearch } from "react-icons/ci";
import { deleteAllUser, getAllUsers } from "./actions";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import ImportExcel from "@/app/components/manage-users/ImportExcel";
import PopUpUsers from "@/app/components/manage-users/PopUpUsers";
import Loading from "@/app/components/Loading";
import PopUpConfirmation from "@/app/components/manage-users/PopUpConfirmation";

const Page = () => {
  const listRoleUser = ["admin", "hop", "scc", "lecturer"];
  const [selectedRole, setSelectedRole] = useState(0);
  const { scrollYProgress } = useScroll();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any>([]);
  const [openImportExcel, setOpenImportExcel] = useState(false);
  const [openPopUpUsers, setOpenPopUpUsers] = useState(false);
  const [selectedUserToUpdate, setSelectedUserToUpdate] = useState<any>();
  const [openPopUpConfirmation, setOpenPopUpConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const resultUsers = await getAllUsers(search);
    console.log(resultUsers?.data);
    setUsers(resultUsers?.data);
    setLoading(false);
  }, [search]);

  const handleDeleteAllLecturer = async () => {
    setLoading(true);
    const resultDeleteAllLecturer = await deleteAllUser();
    console.log(resultDeleteAllLecturer?.data);
    setOpenPopUpConfirmation(false);
    fetchData();
    setLoading(false);
  };

  useEffect(() => {
    const handleScroll = (currentScrollY: number) => { 

      if (currentScrollY < 0.1) setExpand(true);
      else if (currentScrollY > prevScrollYRef.current) setExpand(false);
      else if (currentScrollY < prevScrollYRef.current) setExpand(true);

      if (
        currentScrollY - prevScrollYRef.current > 0.15 ||
        currentScrollY - prevScrollYRef.current < -0.15
      ) {
        prevScrollYRef.current = currentScrollY;
      }
    };

    const mediaQuery = window.matchMedia("(max-width: 1535px)");

    const scrollListener = () => {
      console.log(mediaQuery);
      if (!mediaQuery.matches) {
        console.log("MASUK");
        scrollYProgress.onChange(handleScroll);
      }
    };
 
    scrollListener();
 
    const resizeListener = () => {
      scrollListener();
    };
    window.addEventListener("resize", resizeListener);

    return () => {
      window.removeEventListener("resize", resizeListener); 
      scrollYProgress.clearListeners();
    };
  }, [scrollYProgress]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <motion.div className="relative min-h-screen flex flex-col pt-20 sm:pt-28 2xl:px-16 pb-10 bg-gray-50">
      <div
        className={`sticky ${
          expand ? "top-20 sm:top-28" : "top-7"
        } z-10 w-full flex flex-wrap lg:flex-nowrap justify-between items-center gap-3 md:gap-5 px-5 sm:px-9 h-full lg:h-[5.25rem] transition-all ease-in-out duration-300 bg-gray-50 pb-7`}
      >
        <div className="relative w-full flex justify-start items-center h-full">
          <CiSearch
            className="absolute ml-3 w-5 h-5 sm:w-7 sm:h-7 pr-2 border-r"
            fill="#6B7280"
          />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`border ${
              expand ? "w-full" : "w-[35.5rem]"
            } h-full p-2 sm:p-3 px-12 sm:px-12 rounded-md text-sm sm:text-base`}
          />
        </div>
        <div className="relative min-w-fit w-full sm:w-auto flex justify-end items-center h-full bg-white border rounded-md py-2 px-2 gap-2">
          <button
            className={`w-full whitespace-nowrap cursor-pointer text-xs sm:text-base py-1 px-2 md:py-2 md:px-4 relative ${
              selectedRole == 0
                ? "bg-primary-binus text-white"
                : "bg-transparent text-primary-binus hover:bg-gray-50"
            } rounded-sm`}
            onClick={() => setSelectedRole(0)}
          >
            Admin
          </button>
          <button
            className={`w-full whitespace-nowrap cursor-pointer text-xs sm:text-base py-1 px-2 md:py-2 md:px-4 relative ${
              selectedRole == 1
                ? "bg-primary-binus text-white"
                : "bg-transparent text-primary-binus hover:bg-gray-50"
            } rounded-sm`}
            onClick={() => setSelectedRole(1)}
          >
            HoP
          </button>
          <button
            className={`w-full whitespace-nowrap cursor-pointer text-xs sm:text-base py-1 px-2 md:py-2 md:px-4 relative ${
              selectedRole == 2
                ? "bg-primary-binus text-white"
                : "bg-transparent text-primary-binus hover:bg-gray-50"
            } rounded-sm`}
            onClick={() => setSelectedRole(2)}
          >
            SCC
          </button>
          <button
            className={`w-full whitespace-nowrap cursor-pointer text-xs sm:text-base py-1 px-2 md:py-2 md:px-4 relative ${
              selectedRole == 3
                ? "bg-primary-binus text-white"
                : "bg-transparent text-primary-binus hover:bg-gray-50"
            } rounded-sm`}
            onClick={() => setSelectedRole(3)}
          >
            Lecturer
          </button>
        </div>
        <div className="relative min-w-fit flex justify-end items-center h-full bg-white border rounded-md py-2 px-2 gap-2">
          <button
            className="w-full whitespace-nowrap cursor-pointer text-xs sm:text-base py-1 px-2 md:py-2 md:px-3 relative text-primary-binus rounded-sm"
            onClick={() => setOpenImportExcel(true)}
          >
            Import Excel Lecturer
          </button>
        </div>
      </div>

      {selectedRole == 3 && (
        <div className="mx-5 sm:mx-9 text-end mb-2">
          <span
            onClick={() => setOpenPopUpConfirmation(true)}
            className="text-red-500 cursor-pointer"
          >
            Delete All Lecturer
          </span>
        </div>
      )}
      <div className="w-auto bg-white shadow-md rounded-md mx-5 sm:mx-9 ">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">No.</TableHead>
              <TableHead className="text-center">User Code</TableHead>
              <TableHead className="text-center">Email</TableHead>
              <TableHead className="text-center">Role</TableHead>
              {selectedRole == 1 && (
                <TableHead className="text-center">Major</TableHead>
              )}
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.[listRoleUser[selectedRole] ?? ""]?.map(
              (user: any, index: number) => (
                <TableRow key={user?.email}>
                  <TableCell className="text-start font-medium">
                    {index + 1}.
                  </TableCell>
                  <TableCell className="text-center">
                    {user?.lecturer_code}
                  </TableCell>
                  <TableCell className="text-center">{user?.email}</TableCell>
                  <TableCell className="text-center">{user?.role}</TableCell>
                  {selectedRole == 1 && (
                    <TableCell className="text-center">
                      {user?.hop_major?.map((major: any, index: number) => (
                        <span key={major?.id ?? major?.name}>
                          {major?.name}
                          {index + 1 < user?.hop_major?.length && ", "}
                        </span>
                      ))}
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    <button
                      className="bg-primary-binus px-2 py-1 text-white rounded-md"
                      onClick={() => {
                        setOpenPopUpUsers(true), setSelectedUserToUpdate(user);
                      }}
                    >
                      Update
                    </button>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
        {users?.[listRoleUser[selectedRole] ?? ""]?.length < 1 && (
          <div className="w-full text-center py-5 text-gray-500">
            No Data . . .
          </div>
        )}
      </div>
      {openImportExcel && (
        <ImportExcel
          setOpenImportExcel={setOpenImportExcel}
          fetchData={fetchData}
        />
      )}
      {openPopUpUsers && (
        <PopUpUsers
          fetchData={fetchData}
          setOpenPopUpUsers={setOpenPopUpUsers}
          selectedUserToUpdate={selectedUserToUpdate}
        />
      )}

      {openPopUpConfirmation && (
        <PopUpConfirmation
          setOpenPopUpConfirmation={setOpenPopUpConfirmation}
          handleDeleteAllLecturer={handleDeleteAllLecturer}
        />
      )}
      {loading && <Loading />}
    </motion.div>
  );
};

export default Page;
