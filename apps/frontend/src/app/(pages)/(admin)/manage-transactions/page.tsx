"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import { CiSearch } from "react-icons/ci";
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
import ImportExcel from "@/app/components/manage-transactions/ImportExcel";
import { deleteAllTransaction, getAllTransactions } from "./actions";
import PopUpConfirmation from "@/app/components/manage-transactions/PopUpConfirmation";
import Loading from "@/app/components/Loading";

const Page = () => {
  const { scrollYProgress } = useScroll();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [search, setSearch] = useState("");
  const [transactions, setTransactions] = useState<any>([]);
  const [openImportExcel, setOpenImportExcel] = useState(false);
  const [openPopUpConfirmation, setOpenPopUpConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const resultTransactions = await getAllTransactions(search);
    console.log(resultTransactions?.data);
    setTransactions(resultTransactions?.data);
  }, [search]);

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

  const handleDeleteAllTransaction = async () => {
    setLoading(true);
    const resultDeleteAllTransaction = await deleteAllTransaction();
    console.log(resultDeleteAllTransaction?.data);
    setOpenPopUpConfirmation(false);
    fetchData();
    setLoading(false);
  };

  return (
    <motion.div className="relative min-h-screen flex flex-col pt-28 2xl:px-16 bg-gray-50 pb-10">
      <div
        className={`bg-gray-50 fixed top-0 ${
          expand ? "h-[10rem] sm:h-[12.25rem]" : "h-[7rem]"
        } w-full left-0 z-10`}
      ></div>
      <div
        className={`sticky ${
          expand ? "top-28" : "top-7"
        } z-10 w-full flex justify-between items-center gap-3 sm:gap-5 px-5 sm:px-9 h-[4.5rem] sm:h-[5.25rem] transition-all ease-in-out duration-300 bg-gray-50 pb-7`}
      >
        <div className="relative w-full flex justify-start items-center h-full">
          <CiSearch
            className="absolute ml-3 w-7 h-7 pr-2 border-r"
            fill="#6B7280"
          />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`border ${
              expand ? "w-full" : "w-[35.5rem]"
            } h-full p-3 px-12 rounded-md text-sm sm:text-base`}
          />
        </div>
        <div className="relative min-w-fit flex justify-end items-center h-full bg-white border rounded-md px-2 gap-2">
          <button
            className="w-full whitespace-nowrap cursor-pointer py-1 sm:py-2 px-2 sm:px-4 relative text-primary-binus rounded-sm text-sm sm:text-base"
            onClick={() => setOpenImportExcel(true)}
          >
            Import Excel
          </button>
        </div>
      </div>

      <div className="mx-5 sm:mx-9 text-end mb-2 text-sm sm:text-base">
        <span
          onClick={() => setOpenPopUpConfirmation(true)}
          className="text-red-500 cursor-pointer"
        >
          Delete All Transactions
        </span>
      </div>
      <div className="w-auto bg-white shadow-md rounded-md mx-5 sm:mx-9">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">No.</TableHead>
              <TableHead className="text-center">Class</TableHead>
              <TableHead className="text-center">Course Code</TableHead>
              <TableHead className="text-center">Course Name</TableHead>
              <TableHead className="text-center">Lecturer Code</TableHead>
              <TableHead className="text-center">Lecturer Name</TableHead>
              <TableHead className="text-center">Lecturer Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions?.map((transaction: any, index: number) => (
              <TableRow
                key={`${transaction?.lecturer_code}-${transaction?.course_code}-${transaction?.class}`}
              >
                <TableCell className="text-start font-medium">
                  {index + 1}.
                </TableCell>
                <TableCell className="text-center">
                  {transaction?.class}
                </TableCell>
                <TableCell className="text-center">
                  {transaction?.course_code}
                </TableCell>
                <TableCell className="text-center">
                  {transaction?.course_name}
                </TableCell>
                <TableCell className="text-center">
                  {transaction?.lecturer_code}
                </TableCell>
                <TableCell className="text-center">
                  {transaction?.lecturer_name}
                </TableCell>
                <TableCell className="text-center">
                  {transaction?.location}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {transactions?.length < 1 && (
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
      {openPopUpConfirmation && (
        <PopUpConfirmation
          setOpenPopUpConfirmation={setOpenPopUpConfirmation}
          handleDeleteAllTransaction={handleDeleteAllTransaction}
        />
      )}
      {loading && <Loading />}
    </motion.div>
  );
};

export default Page;
