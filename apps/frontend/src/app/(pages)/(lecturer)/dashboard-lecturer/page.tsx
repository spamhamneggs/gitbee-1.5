"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import DDMenu from "@/app/components/DDMenu";
import { BsCalendar4Range } from "react-icons/bs";
import DDMenuSemester from "@/app/components/DDMenuSemester";
import Card from "@/app/components/Card";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DDMenuCourses from "@/app/components/DDMenuCourses";
import {
  getAllSemester,
  getCoursesByLecturer,
  getCurrentSemester,
  getTranscationByLecturer,
} from "./action";
import { useAuth } from "@/app/context/AuthContext";
import Loading from "@/app/components/Loading";

const Page = () => {
  const { userData } = useAuth();
  const { scrollYProgress } = useScroll();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [listSemester, setListSemester] = useState<any>([]);
  const [transactions, setTransactions] = useState<any>([]);
  const [currentSemester, setCurrentSemester] = useState<any>();
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<
    { course_code: string; course_name: string }[]
  >([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");

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

  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state -- server fetch: reference data can only be populated asynchronously after mount */
  useEffect(() => {
    const fetchData = async () => {
      const resultListSemester = await getAllSemester();
      setListSemester(resultListSemester);

      const resultCurrentSemester = await getCurrentSemester();
      setCurrentSemester(resultCurrentSemester);
    };
    fetchData();
  }, []);
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  /* eslint-disable react-you-might-not-need-an-effect/no-derived-state -- server fetch: the result depends on an async round-trip and cannot be computed during render */
  useEffect(() => {
    const fetchTransactionData = async () => {
      setLoading(true);
      const resultTransactions = await getTranscationByLecturer(
        currentSemester?.data?.SemesterId,
        userData?.nim ? userData?.nim : "",
        selectedCategoryFilter
      );
      console.log(resultTransactions?.data);
      setTransactions(resultTransactions?.data);

    const resultCourses = await getCoursesByLecturer(
      currentSemester?.data?.SemesterId,
      userData?.nim ? userData?.nim : ""
    );
    console.log(resultCourses?.data);
    setCategories(resultCourses?.data);
    setLoading(false);
    };
    fetchTransactionData();
  }, [currentSemester, selectedCategoryFilter, userData?.nim]);
  /* eslint-enable react-you-might-not-need-an-effect/no-derived-state */

  return (
    <motion.div className="relative min-h-screen flex flex-col justify-start items-center px-5 sm:px-10 xl:px-[6.25rem] ">
      <div
        className={`fixed top-0 w-full flex justify-center items-center transition-all ease-in-out duration-300 px-5 sm:px-10 xl:px-24 z-20 ${
          expand ? "pt-24" : "pt-10"
        } bg-gray-50`}
      >
        <div className="w-full border-b flex flex-nowrap justify-between items-start sm:items-center pb-3">
          <div className={`px-1 ${expand ? "w-1/2" : "w-[calc(50%-5rem)]"}`}>
            <h1 className="font-montserrat text-xl sm:text-3xl font-semibold text-primary-binus">
              My Classes
            </h1>
          </div>
          <div
            className={`${
              expand ? "w-0" : "w-40"
            } transition-all ease-in-out duration-700 bg-transparent h-2 mx-2`}
          ></div>
          <div
            className={` ${
              expand ? "w-1/2" : "w-[calc(50%-5rem)]"
            } flex justify-end items-center`}
          >
            {" "}
            <DDMenuSemester
              options={listSemester}
              filter="Semester"
              icon={<BsCalendar4Range className="w-3 h-3 sm:w-4 sm:h-4" />}
              currentSemester={currentSemester}
              setCurrentSemester={setCurrentSemester}
            />
          </div>
        </div>
      </div>
      <div className="w-full mt-44 flex flex-col justify-start items-start gap-3">
        <DDMenuCourses
          options={categories}
          filter="All Courses"
          setSelectedValue={setSelectedCategoryFilter}
          icon={<BsCalendar4Range className="w-4 h-4" />}
        />
        <div className="w-full bg-white shadow-md rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">Class ID</TableHead>
                <TableHead className="text-center">Course ID</TableHead>
                <TableHead className="text-center">Course Name</TableHead>
                <TableHead className="text-center">Start Correction</TableHead>
                <TableHead className="text-center">End Correction</TableHead>
                <TableHead className="text-center">Student</TableHead> 
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions?.map((transaction: any, index: number) => (
                <TableRow
                  key={`${transaction?.lecturer_code}-${transaction?.course_code}-${transaction?.class}`}
                >
                  <TableCell className="text-start font-medium">
                    {transaction?.class}
                  </TableCell>
                  <TableCell className="text-center">
                    {transaction?.course_code}
                  </TableCell>
                  <TableCell className="text-center">
                    {transaction?.course_name}
                  </TableCell>
                  <TableCell className="text-center"> - </TableCell>
                  <TableCell className="text-center"> - </TableCell>
                  <TableCell className="text-center"> {transaction?.total_students} </TableCell> 
                  <TableCell className="text-center">
                    <Link
                      href={{
                        pathname: `/course-lecturer`,
                        query: {
                          course_code: transaction?.course_code,
                          course_name: transaction?.course_name,
                          semester_id: currentSemester?.data?.SemesterId,
                          class_id: transaction?.class,
                        },
                      }}
                      className="bg-primary-binus px-2 py-1 text-white rounded-md"
                    >
                      Detail
                    </Link>
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
      </div>

      {loading && <Loading />}
    </motion.div>
  );
};

export default Page;
