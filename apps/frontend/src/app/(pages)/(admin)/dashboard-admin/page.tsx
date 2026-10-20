"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import { CiSearch } from "react-icons/ci";
import DDMenu from "../../../components/DDMenu";
import { TbCategory2 } from "react-icons/tb";
import { IoBookOutline } from "react-icons/io5";
import { FaCode } from "react-icons/fa";
import ProjectDetailComponent from "@/app/components/explore/ProjectDetailComponent";
import ExploreComponent from "@/app/components/explore/ExploreComponent";
import {
  getAllCategory,
  getAllMajor,
  getAllProjects,
  getAllSemester,
  getCurrentSemester,
} from "./actions";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DDMenuCourses from "@/app/components/DDMenuCourses";
import { BsCalendar4Range } from "react-icons/bs";
import Link from "next/link";
import Image from "next/image";
import DDMenuSemester from "@/app/components/DDMenuSemester";

const Page = () => {
  const listStatus = ["submitted", "graded", "reviewed", "outstanding"];
  const { scrollYProgress } = useScroll();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [showDevelopers, setShowDevelopers] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    []
  );
  const [search, setSearch] = useState("");
  const [majors, setMajors] = useState<{ id: number; name: string }[]>([]);
  const [projects, setProjects] = useState<any>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  const [selectedMajorFilter, setSelectedMajorFilter] = useState("");
  const [selectedTechnologyFilter, setSelectedTechnologyFilter] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(1);
  const [listSemester, setListSemester] = useState<any>([]);
  const [currentSemester, setCurrentSemester] = useState<any>();

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

  /* eslint-disable react-you-might-not-need-an-effect/no-derived-state -- server fetch: the result depends on an async round-trip and cannot be computed during render */
  useEffect(() => {
    const fetchProjectData = async () => {
      console.log(currentSemester?.data?.SemesterId);
      const resultProject = await getAllProjects(
        search,
        selectedCategoryFilter,
        selectedMajorFilter,
        currentSemester?.data?.SemesterId
      );
      console.log(resultProject?.data);
      if (resultProject?.success) setProjects(resultProject.data);
    };
    fetchProjectData();
  }, [search, selectedCategoryFilter, selectedMajorFilter, currentSemester]);
  /* eslint-enable react-you-might-not-need-an-effect/no-derived-state */

  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state -- server fetch: reference data can only be populated asynchronously after mount */
  useEffect(() => {
    const fetchData = async () => {
      const resultCategory = await getAllCategory();
      if (resultCategory?.success) setCategories(resultCategory.data);

      const resultMajor = await getAllMajor();
      if (resultMajor?.success) setMajors(resultMajor.data);

      const resultListSemester = await getAllSemester();
      setListSemester(resultListSemester);

      const resultCurrentSemester = await getCurrentSemester();
      setCurrentSemester(resultCurrentSemester);
    };
    fetchData();
  }, []);
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <motion.div className="relative min-h-screen flex flex-col pt-20 sm:pt-28 px-5 sm:px-10 2xl:px-24 bg-gray-50 pb-9">
      <div
        className={`bg-gray-50 fixed top-0 ${
          expand ? "h-[12.25rem]" : "h-[7rem]"
        } w-full left-0 z-10`}
      ></div>
      <div
        className={`sticky ${
          expand ? "top-20 sm:top-28" : "top-7"
        } z-10 w-full flex flex-col lg:flex-row justify-between items-center gap-2 sm:gap-5 h-auto lg:h-[5.25rem] transition-all ease-in-out duration-300 bg-gray-50 pb-7`}
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
            } h-full p-3 px-12 rounded-md`}
          />
        </div>
        <div className="relative w-full lg:w-fit flex flex-col sm:flex-row justify-end items-center h-full gap-2 sm:gap-5">
          <DDMenu
            options={categories}
            filter="Category"
            className="max-h-8 sm:max-h-none"
            setSelectedValue={setSelectedCategoryFilter}
            icon={<TbCategory2 className="w-4 h-4" />}
          />
          <DDMenu
            options={majors}
            filter="Major"
            className="max-h-8 sm:max-h-none"
            setSelectedValue={setSelectedMajorFilter}
            icon={<IoBookOutline className="w-4 h-4" />}
          />
          <DDMenuSemester
            className="h-full w-full sm:w-auto sm:max-w-44"
            options={listSemester}
            filter="Semester"
            icon={<BsCalendar4Range className="w-4 h-4" />}
            currentSemester={currentSemester}
            setCurrentSemester={setCurrentSemester}
          />
        </div>
      </div>
      <div className="w-auto bg-white shadow-md rounded-md mb-7 grid grid-cols-2 md:flex justify-around items-center py-7 px-5 gap-2">
        <div
          onClick={() => setSelectedStatus(1)}
          className={`flex flex-col justify-center items-center text-lg gap-3 hover:bg-gray-50 px-3 lg:px-7 py-3 rounded-lg cursor-pointer ${
            selectedStatus == 1 && "border border-primary-binus"
          } `}
        >
          <Image
            src="/icons/submit.png"
            width={96}
            height={96}
            alt="Submitted by student"
            className="w-14 h-14 lg:w-20 lg:h-20 xl:w-24 xl:h-24"
          />
          <div className="flex justify-center items-center gap-2 text-sm lg:text-base 2xl:text-lg">
            Submitted By Student{" "}
            <span className="bg-primary-binus text-white px-1 text-sm rounded-sm">
              {projects?.["count submitted"]}
            </span>
          </div>
        </div>
        <div
          onClick={() => setSelectedStatus(2)}
          className={`flex flex-col justify-center items-center text-lg gap-3 hover:bg-gray-50 px-3 lg:px-7 py-3 rounded-lg cursor-pointer ${
            selectedStatus == 2 && "border border-primary-binus"
          } `}
        >
          <Image
            src="/icons/reviews.png"
            width={96}
            height={96}
            alt="Graded by lecturer"
            className="w-14 h-14 lg:w-20 lg:h-20 xl:w-24 xl:h-24"
          />
          <div className="flex justify-center items-center gap-2 text-sm lg:text-base 2xl:text-lg">
            Graded By Lecturer{" "}
            <span className="bg-primary-binus text-white px-1 text-sm rounded-sm">
              {projects?.["count graded"]}
            </span>
          </div>
        </div>
        <div
          onClick={() => setSelectedStatus(3)}
          className={`flex flex-col justify-center items-center text-lg gap-3 hover:bg-gray-50 px-3 lg:px-7 py-3 rounded-lg cursor-pointer ${
            selectedStatus == 3 && "border border-primary-binus"
          } `}
        >
          <Image
            src="/icons/recommendation.png"
            width={96}
            height={96}
            alt="Reviewed by SCC"
            className="w-14 h-14 lg:w-20 lg:h-20 xl:w-24 xl:h-24"
          />
          <div className="flex justify-center items-center gap-2 text-sm lg:text-base 2xl:text-lg">
            Reviewed By SCC{" "}
            <span className="bg-primary-binus text-white px-1 text-sm rounded-sm">
              {projects?.["count reviewed"]}
            </span>
          </div>
        </div>
        <div
          onClick={() => setSelectedStatus(4)}
          className={`flex flex-col justify-center items-center text-lg gap-3 hover:bg-gray-50 px-3 lg:px-7 py-3 rounded-lg cursor-pointer ${
            selectedStatus == 4 && "border border-primary-binus"
          } `}
        >
          <Image
            src="/icons/outstanding.png"
            width={96}
            height={96}
            alt="Reviewed by HOP"
            className="w-14 h-14 lg:w-20 lg:h-20 xl:w-24 xl:h-24"
          />
          <div className="flex justify-center items-center gap-2 text-sm lg:text-base 2xl:text-lg">
            Reviewed By HOP{" "}
            <span className="bg-primary-binus text-white px-1 text-sm rounded-sm">
              {projects?.["count outstanding"]}
            </span>
          </div>
        </div>
      </div>
      <div className="w-auto bg-white shadow-md rounded-md ">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">Project ID</TableHead>
              <TableHead className="text-center">Project Title</TableHead>
              <TableHead className="text-center">Project Link</TableHead>
              <TableHead className="text-center">Project Github</TableHead>
              <TableHead className="text-center">Total Members</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects?.[listStatus[selectedStatus - 1] ?? ""]?.map(
              (project: any, index: number) => (
                <TableRow key={project?.id}>
                  <TableCell className="text-start font-medium">
                    {index + 1}.
                  </TableCell>
                  <TableCell className="text-center">
                    {project?.projectDetail?.title}
                  </TableCell>
                  <TableCell className="text-center">
                    <Link href={project?.projectDetail?.project_link}>
                      {project?.projectDetail?.project_link}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    <Link href={project?.projectDetail?.github_link}>
                      {project?.projectDetail?.github_link}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="text-nowrap">
                      {project?.projectGroups?.map(
                        (member: any, index: number) => (
                          <span key={member?.student_id}>
                            {index + 1}.{" "}
                            <span className="capitalize">
                              {member?.student_name?.toLowerCase()}
                            </span>{" "}
                            <br />
                          </span>
                        )
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {project?.is_disable ? (
                      <span className="text-red-500">Hidden</span>
                    ) : (
                      <span className="text-green-500">Display</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Link
                      href={`/detail-admin-project/${project?.id}`}
                      className="bg-primary-binus px-2 py-1 text-white rounded-md"
                    >
                      Detail
                    </Link>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
        {projects?.[listStatus[selectedStatus - 1] ?? ""]?.length < 1 && (
          <div className="w-full text-center py-5 text-gray-500">
            No Data . . .
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Page;
