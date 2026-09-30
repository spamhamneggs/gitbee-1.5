"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  getAllTech,
} from "./actions";
import DDMenuSemester from "@/app/components/DDMenuSemester";
import { BsCalendar4Range } from "react-icons/bs";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import ProjectDetailHop from "@/app/components/dashboard-hop/ProjectDetailHop";
import DashboardHopComponent from "@/app/components/dashboard-hop/DashboardHopComponent";

const Page = () => {
  const { scrollYProgress } = useScroll();
  const { toast } = useToast();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [showDevelopers, setShowDevelopers] = useState(false);
  const [selectedDetailProject, setSelectedDetailProject] = useState<any>();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    []
  );
  const [search, setSearch] = useState("");
  const [majors, setMajors] = useState<{ id: number; name: string }[]>([]);
  const [techs, setTechs] = useState<{ id: number; name: string }[]>([]);
  const [project, setProject] = useState<any>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  const [selectedMajorFilter, setSelectedMajorFilter] = useState("");
  const [selectedTechnologyFilter, setSelectedTechnologyFilter] = useState("");
  const [listSemester, setListSemester] = useState<any>([]);
  const [currentSemester, setCurrentSemester] = useState<any>();

  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state -- server fetch: reference data can only be populated asynchronously after mount */
  useEffect(() => {
    const fetchData = async () => {
      const resultCategory = await getAllCategory();
      if (resultCategory?.success) setCategories(resultCategory.data);

      const resultMajor = await getAllMajor();
      if (resultMajor?.success) setMajors(resultMajor.data);

      const resultTech = await getAllTech();
      if (resultTech?.success) setTechs(resultTech.data);
    };
    fetchData();
  }, []);
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

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

  const fetchProjectData = useCallback(async () => {
    const resultProject = await getAllProjects(
      search,
      "6",
      "be992b30-4b38-4361-8404-25f2d6912754",
      "COMP6100001"
    );

    if (resultProject?.success) {
      console.log();
      setProject(resultProject?.data);
    }
    console.log(resultProject);
  }, [search]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);



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
          !showDevelopers ? "h-48 sm:h-60 lg:h-[7rem]" : "h-[7rem]"
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
        </div>
      )}
      <Toaster />
      {showDevelopers ? (
        <ProjectDetailHop
          setShowDevelopers={setShowDevelopers}
          showDevelopers={showDevelopers}
          selectedDetailProject={selectedDetailProject}
          toast={toast}
          expand={expand}
          fetchProjectData={fetchProjectData}
        />
      ) : (
        <DashboardHopComponent
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
