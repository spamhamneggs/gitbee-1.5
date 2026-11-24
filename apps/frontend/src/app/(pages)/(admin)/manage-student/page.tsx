"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import { CiSearch } from "react-icons/ci";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ImportCsv from "@/app/components/manage-student/ImportCsv";
import ImportRosterExcel from "@/app/components/manage-student/ImportRosterExcel";
import { getAccounts, type Account } from "@/lib/accountApi";
import Loading from "@/app/components/Loading";

const Page = () => {
  const { scrollYProgress } = useScroll();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<Account[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const pageSize = 20;
  const importCsvRef = useRef<HTMLButtonElement>(null);
  const importRosterRef = useRef<HTMLButtonElement>(null);
  const [openImportCsv, setOpenImportCsv] = useState(false);
  const [openImportRoster, setOpenImportRoster] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    setStudents([]);
    try {
      const result = await getAccounts("student", {
        search,
        page,
        pageSize,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setStudents(result.items);
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
  }, [search, page]);

  const refreshStudents = () => {
    setSearch("");
    setPage(1);
    setRevision((value) => value + 1);
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
            aria-label="Search students"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={`border ${
              expand ? "w-full" : "w-[35.5rem]"
            } h-full p-2 sm:p-3 px-12 sm:px-12 rounded-md text-sm sm:text-base`}
          />
        </div>
        <div className="relative min-w-fit flex justify-end items-center h-full bg-white border rounded-md py-2 px-2 gap-2">
          <button
            ref={importRosterRef}
            className="w-full whitespace-nowrap cursor-pointer text-xs sm:text-base py-1 px-2 md:py-2 md:px-3 relative text-primary-binus rounded-sm"
            onClick={() => setOpenImportRoster(true)}
          >
            Import Lab Roster
          </button>
          <button
            ref={importCsvRef}
            className="w-full whitespace-nowrap cursor-pointer text-xs sm:text-base py-1 px-2 md:py-2 md:px-3 relative text-primary-binus rounded-sm"
            onClick={() => setOpenImportCsv(true)}
          >
            Import CSV
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mx-5 sm:mx-9 mb-3 text-red-600">
          {error}{" "}
          <button className="underline" onClick={fetchData}>
            Retry
          </button>
        </p>
      )}
      <div className="w-auto bg-white shadow-md rounded-md mx-5 sm:mx-9">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">No.</TableHead>
              <TableHead className="text-center">Student ID</TableHead>
              <TableHead className="text-center">Name</TableHead>
              <TableHead className="text-center">Binusian ID</TableHead>
              <TableHead className="text-center">Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student, index) => (
              <TableRow key={student?.email}>
                <TableCell className="text-start font-medium">
                  {(page - 1) * pageSize + index + 1}.
                </TableCell>
                <TableCell className="text-center">
                  {student.student_id}
                </TableCell>
                <TableCell className="text-center">{student.name}</TableCell>
                <TableCell className="text-center">
                  {student.binusian_id}
                </TableCell>
                <TableCell className="text-center">{student.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && !error && students.length === 0 && (
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
          Previous students page
        </button>
        <span>
          {total} students · Page {page} of{" "}
          {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <button
          className="disabled:opacity-40"
          disabled={loading || page * pageSize >= total}
          onClick={() => setPage((value) => value + 1)}
        >
          Next students page
        </button>
      </div>
      {openImportCsv && (
        <ImportCsv
          setOpenImportCsv={setOpenImportCsv}
          fetchData={refreshStudents}
          restoreFocusRef={importCsvRef}
        />
      )}
      {openImportRoster && (
        <ImportRosterExcel
          setOpen={setOpenImportRoster}
          restoreFocusRef={importRosterRef}
        />
      )}
      {loading && <Loading />}
    </motion.div>
  );
};

export default Page;
