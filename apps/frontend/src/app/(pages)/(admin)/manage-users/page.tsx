"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import { CiSearch } from "react-icons/ci";
import { deleteAllUser } from "./actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import ImportCsv from "@/app/components/manage-users/ImportCsv";
import PopUpUsers from "@/app/components/manage-users/PopUpUsers";
import { getAccounts, type Account, type StaffRole } from "@/lib/accountApi";
import Loading from "@/app/components/Loading";
import PopUpConfirmation from "@/app/components/manage-users/PopUpConfirmation";

const Page = () => {
  const staffRoles: StaffRole[] = ["Admin", "HoP", "SCC", "Lecturer"];
  const [selectedRole, setSelectedRole] = useState(0);
  const { scrollYProgress } = useScroll();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<Account[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const pageSize = 20;
  const [openImportCsv, setOpenImportCsv] = useState(false);
  const [openPopUpUsers, setOpenPopUpUsers] = useState(false);
  const [selectedUserToUpdate, setSelectedUserToUpdate] = useState<Account>();
  const [openPopUpConfirmation, setOpenPopUpConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    setUsers([]);
    try {
      const roleFilter = (["Admin", "HoP", "SCC", "Lecturer"] as const)[
        selectedRole
      ];
      const result = await getAccounts(
        selectedRole === 4 ? "student" : "staff",
        {
          search,
          page,
          pageSize,
          signal: controller.signal,
          ...(roleFilter ? { roleFilter } : {}),
        },
      );
      if (!controller.signal.aborted) {
        setUsers(result.items);
        setTotal(result.total);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setTotal(0);
        setError(
          cause instanceof Error ? cause.message : "Could not fetch accounts.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [search, page, selectedRole]);

  const refreshAccounts = () => {
    setSearch("");
    setPage(1);
    setRevision((value) => value + 1);
  };

  const handleDeleteAllLecturer = async () => {
    setLoading(true);
    setError("");
    const result = await deleteAllUser();
    setLoading(false);
    setOpenPopUpConfirmation(false);
    if (!result?.success) {
      // Surface the denial (e.g. 401) instead of refreshing to an empty list.
      setError(result?.message ?? "Could not delete lecturers.");
      return;
    }
    refreshAccounts();
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
      if (!mediaQuery.matches) {
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
    void fetchData();
    return () => requestRef.current?.abort();
  }, [fetchData, revision]);

  return (
    <motion.div className="relative min-h-screen flex flex-col pt-20 sm:pt-28 2xl:px-16 pb-10 bg-gray-50">
      <Link
        href="/data-demo"
        className="mx-5 sm:mx-9 mb-5 text-sm text-primary-binus underline w-fit"
      >
        Import CSV / Excel & browse database →
      </Link>
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
            maxLength={150}
            aria-label="Search accounts"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={`border ${
              expand ? "w-full" : "w-[35.5rem]"
            } h-full p-2 sm:p-3 px-12 sm:px-12 rounded-md text-sm sm:text-base`}
          />
        </div>
        <div className="relative min-w-0 w-full sm:w-auto flex flex-wrap justify-start items-center h-full bg-white border rounded-md py-2 px-2 gap-2">
          {[...staffRoles, "Students", "All staff"].map((label, index) => (
            <button
              key={label}
              aria-pressed={selectedRole === index}
              className={`whitespace-nowrap text-xs sm:text-base py-1 px-2 rounded-sm ${selectedRole === index ? "bg-primary-binus text-white" : "text-primary-binus hover:bg-gray-50"}`}
              onClick={() => {
                setSelectedRole(index);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-fit flex justify-end items-center h-full bg-white border rounded-md py-2 px-2 gap-2">
          <button
            className="w-full whitespace-nowrap cursor-pointer text-xs sm:text-base py-1 px-2 md:py-2 md:px-3 relative text-primary-binus rounded-sm"
            onClick={() => setOpenImportCsv(true)}
          >
            Import CSV
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
      {error && (
        <p role="alert" className="mx-5 sm:mx-9 mb-3 text-red-600">
          {error}{" "}
          <button className="underline" onClick={fetchData}>
            Retry
          </button>
        </p>
      )}
      <div className="w-auto bg-white shadow-md rounded-md mx-5 sm:mx-9 ">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">No.</TableHead>
              <TableHead className="text-center">
                {selectedRole === 4 ? "Student ID" : "User Code"}
              </TableHead>
              <TableHead className="text-center">Name</TableHead>
              <TableHead className="text-center">Binusian ID</TableHead>
              <TableHead className="text-center">Email</TableHead>
              <TableHead className="text-center">Role</TableHead>
              {selectedRole == 1 && (
                <TableHead className="text-center">Major</TableHead>
              )}
              {selectedRole !== 4 && (
                <TableHead className="text-center">Action</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user, index) => (
              <TableRow key={user?.email}>
                <TableCell className="text-start font-medium">
                  {(page - 1) * pageSize + index + 1}.
                </TableCell>
                <TableCell className="text-center">
                  {selectedRole === 4 ? user.student_id : user.lecturer_code}
                </TableCell>
                <TableCell className="text-center">{user.name}</TableCell>
                <TableCell className="text-center">
                  {user.binusian_id}
                </TableCell>
                <TableCell className="text-center">{user?.email}</TableCell>
                <TableCell className="text-center">
                  {selectedRole === 4 ? "Student" : user.role}
                </TableCell>
                {selectedRole == 1 && (
                  <TableCell className="text-center">
                    {user?.hop_major?.map((major, index) => (
                      <span key={major?.id ?? major?.name}>
                        {major?.name}
                        {index + 1 < (user.hop_major?.length ?? 0) && ", "}
                      </span>
                    ))}
                  </TableCell>
                )}
                {selectedRole !== 4 && (
                  <TableCell className="text-center">
                    <button
                      className="bg-primary-binus px-2 py-1 text-white rounded-md"
                      onClick={() => {
                        (setOpenPopUpUsers(true),
                          setSelectedUserToUpdate(user));
                      }}
                    >
                      Update
                    </button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && !error && users.length === 0 && (
          <div className="w-full text-center py-5 text-gray-500">
            No Data . . .
          </div>
        )}
      </div>
      <div className="mx-5 sm:mx-9 flex justify-between items-center gap-4 py-4">
        <button
          className="disabled:opacity-40"
          disabled={loading || page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous accounts page
        </button>
        <span>
          {total} accounts · Page {page} of{" "}
          {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <button
          className="disabled:opacity-40"
          disabled={loading || page * pageSize >= total}
          onClick={() => setPage((value) => value + 1)}
        >
          Next accounts page
        </button>
      </div>
      {openImportCsv && (
        <ImportCsv
          setOpenImportCsv={setOpenImportCsv}
          fetchData={(type) => {
            setSelectedRole(type === "student" ? 4 : 5);
            refreshAccounts();
          }}
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
