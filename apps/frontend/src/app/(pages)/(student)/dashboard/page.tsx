"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import DDMenu from "@/app/components/DDMenu";
import { BsCalendar4Range } from "react-icons/bs";
import DDMenuSemester from "@/app/components/DDMenuSemester";
import Card from "@/app/components/Card";
import Link from "next/link";
import {
  getAllSemester,
  getCurrentSemester,
  getTranscationByStudent,
} from "./action";
import Loading from "@/app/components/Loading";
import { useAuth } from "@/app/context/AuthContext";

const Page = () => {
  const { userData } = useAuth();
  const { scrollYProgress } = useScroll();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [listSemester, setListSemester] = useState<any>([]);
  const [currentSemester, setCurrentSemester] = useState<any>();
  const [transactions, setTransactions] = useState<any>([]);
  const [loading, setLoading] = useState(false);

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
      setLoading(true);
      const resultListSemester = await getAllSemester();
      console.log(resultListSemester);
      setListSemester(resultListSemester);

      const resultCurrentSemester = await getCurrentSemester();
      setCurrentSemester(resultCurrentSemester);
      console.log(resultCurrentSemester);
      setLoading(false);
    };
    fetchData();
  }, []);
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  /* eslint-disable react-you-might-not-need-an-effect/no-derived-state -- server fetch: the result depends on an async round-trip and cannot be computed during render */
  useEffect(() => {
    const fetchTransactionData = async () => {
      setLoading(true);
      console.log(userData?.nim);
      console.log(currentSemester?.data?.SemesterId);
      const resultTransactions = await getTranscationByStudent(
        currentSemester?.data?.SemesterId,
        userData?.nim ? userData?.nim : ""
      );
      console.log(resultTransactions?.data);
      setTransactions(resultTransactions?.data);
      setLoading(false);
    };
    fetchTransactionData();
  }, [currentSemester, userData?.nim]);
  /* eslint-enable react-you-might-not-need-an-effect/no-derived-state */





  return (
    <motion.div className="relative min-h-screen flex flex-col justify-start items-center px-5 sm:px-9 xl:px-[6.25rem] ">
      <div
        className={`fixed top-0 w-full flex justify-center items-center transition-all ease-in-out duration-300 px-5 sm:px-9 xl:px-24 z-20 ${
          expand ? "pt-24" : "pt-10"
        } bg-gray-50`}
      >
        <div className="w-full border-b flex justify-between items-center pb-3">
          <div className={`px-1 ${expand ? "w-1/2" : "w-[calc(50%-5rem)]"}`}>
            <h1 className="font-montserrat  text-xl sm:text-3xl font-semibold text-primary-binus">
              My Courses
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 h-fit pt-44 w-full gap-5">
        {transactions?.map((transaction: any) => (
          <Link
            key={`${transaction?.course_code}-${transaction?.class}`}
            href={{
              pathname: `/course`,
              query: {
                course_code: transaction?.course_code,
                course_name: transaction?.course_name,
                semester_id: currentSemester?.data?.SemesterId,
                class_id: transaction?.class,
              },
            }}
            className="h-fit bg-white shadow-md hover:shadow-xl rounded-md p-5 cursor-pointer"
          >
            <div className="flex justify-between w-full">
              <div className="flex flex-col w-9/12">
                <h3 className="text-sm truncate text-primary-orange">
                  {transaction?.course_code}
                </h3>
                <h1 className="text-xl font-semibold truncate">
                  {transaction?.course_name}
                </h1>
              </div>
              <h1 className="text-lg font-semibold truncate max-w-2/12 w-auto min-w-14 text-center bg-secondary-binus rounded-lg h-fit px-2">
                {transaction?.class}
              </h1>
            </div>
            <div className="text-primary-binus text-sm my-3">
              Location:{" "}
              <span className="relative after:absolute after:w-full after:h-px after:bg-primary-orange after:bottom-0 after:left-0">
                {transaction?.location}
              </span>
            </div>
            <div className="flex justify-start items-start">
              <span className="text-md">Lecturer:</span>{" "}
              <span className="text-sm bg-secondary-binus text-primary-binus rounded-md px-1 mx-0.5">
                {transaction?.lecturer_code}
              </span>
              <span className="truncate w-auto">
                - {transaction?.lecturer_name}
              </span>
            </div>
          </Link>
        ))} 
      </div>

      {loading && <Loading />}
    </motion.div>
  );
};

export default Page;
