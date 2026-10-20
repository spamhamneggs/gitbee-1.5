"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import { CiSearch } from "react-icons/ci";
import {
  getAllMajor,
  getAllProjects,
  getAllSemester,
  getCurrentSemester,
} from "./actions";
import DashboardSccComponent from "@/app/components/dashboard-scc/DashboardSccComponent";
import ProjectDetailScc from "@/app/components/dashboard-scc/ProjectDetailScc";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { BsCalendar4Range } from "react-icons/bs";
import DDMenuSemester from "@/app/components/DDMenuSemester";
import DDMenu from "@/app/components/DDMenu";
import { IoBookOutline } from "react-icons/io5";

const Page = () => {
  const { scrollYProgress } = useScroll();
  const { toast } = useToast();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [showDevelopers, setShowDevelopers] = useState(false);
  const [selectedDetailProject, setSelectedDetailProject] = useState<any>();
  const [listSemester, setListSemester] = useState<any>([]);
  const [currentSemester, setCurrentSemester] = useState<any>();
  const [search, setSearch] = useState("");
  const [project, setProject] = useState<any>([]);
  const [majors, setMajors] = useState<{ id: number; name: string }[]>([]);
  const [selectedMajorFilter, setSelectedMajorFilter] = useState("");

  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state -- server fetch: reference data can only be populated asynchronously after mount */
  useEffect(() => {
    const fetchData = async () => {
      const resultListSemester = await getAllSemester();
      setListSemester(resultListSemester);

      const resultMajor = await getAllMajor();
      if (resultMajor?.success) setMajors(resultMajor.data);

      const resultCurrentSemester = await getCurrentSemester();
      setCurrentSemester(resultCurrentSemester);
      console.log(resultCurrentSemester);
    };
    fetchData();
  }, []);
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  const fetchProjectData = useCallback(async () => {
    const resultProject = await getAllProjects(
      search,
      selectedMajorFilter,
      currentSemester?.data?.SemesterId
    );

    if (resultProject?.success) {
      console.log();
      setProject(resultProject?.data);
    }
    console.log(resultProject);
  }, [search, selectedMajorFilter, currentSemester]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

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





  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <motion.div className="relative min-h-screen flex flex-col pt-20 sm:pt-28 xl:px-16 bg-gray-50">
      <div
        className={`bg-gray-50 fixed top-0 ${
          !showDevelopers ? "h-60 lg:h-[7rem]" : "h-[7rem]"
        } w-full left-0 z-10`}
      ></div>
      {!showDevelopers && (
        <div
          className={`sticky top-20 sm:top-28 2xl:top-7 z-10 w-full flex flex-col lg:flex-row justify-between items-center gap-2 sm:gap-5 px-5 sm:px-9 h-full sm:h-[5.25rem] transition-all ease-in-out duration-300 bg-gray-50 pb-3 sm:pb-7`}
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
          <div className="relative w-full lg:w-fit flex flex-col sm:flex-row justify-end items-center h-full gap-2 sm:gap-5 ">
            <DDMenu
              options={majors}
              filter="Major Project"
              setSelectedValue={setSelectedMajorFilter}
              icon={<IoBookOutline className="w-4 h-4" />}
              className="max-h-8 sm:max-h-none"
            />
            <DDMenuSemester
              className="h-full w-full sm:w-64"
              options={listSemester}
              filter="Semester"
              icon={<BsCalendar4Range className="w-4 h-4" />}
              currentSemester={currentSemester}
              setCurrentSemester={setCurrentSemester}
            />
          </div>
        </div>
      )}
      <Toaster />
      {showDevelopers ? (
        <ProjectDetailScc
          setShowDevelopers={setShowDevelopers}
          showDevelopers={showDevelopers}
          selectedDetailProject={selectedDetailProject}
          toast={toast}
          expand={expand}
          fetchProjectData={fetchProjectData}
        />
      ) : (
        <DashboardSccComponent
          setShowDevelopers={setShowDevelopers}
          setSelectedDetailProject={setSelectedDetailProject}
          showDevelopers={showDevelopers}
          expand={expand}
          handleScrollToTop={handleScrollToTop}
          projects={project}
        />
      )}
    </motion.div>
  );
};

export default Page;
