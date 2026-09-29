"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import { CiSearch } from "react-icons/ci";
import DDMenu from "../../../../components/DDMenu";
import { TbCategory2 } from "react-icons/tb";
import { IoBookOutline } from "react-icons/io5";
import { FaCode } from "react-icons/fa";
import ProjectDetailComponent from "@/app/components/explore/ProjectDetailComponent";
import ExploreComponent from "@/app/components/explore/ExploreComponent";
import {
  getAllCategory,
  getAllMajor,
  getAllTech,
  getProjectDetail,
  toggleIsDisable,
} from "./actions";
import DashboardHopComponent from "@/app/components/dashboard-hop/DashboardHopComponent";
import DDMenuSemester from "@/app/components/DDMenuSemester";
import { BsCalendar4Range, BsGlobe2 } from "react-icons/bs";
import ProjectDetailHop from "@/app/components/dashboard-hop/ProjectDetailHop";
import Link from "next/link";
import Image from "next/image";
import { SiGithub } from "react-icons/si";
import { IoIosArrowRoundBack, IoIosVideocam } from "react-icons/io";
import Loading from "@/app/components/Loading";

const Page: React.FC<{ params: { id: string } }> = ({ params: { id } }) => {
  const { scrollYProgress } = useScroll();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [showDevelopers, setShowDevelopers] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [toggleStatus, setToggleStatus] = useState(-1);
  const [search, setSearch] = useState("");
  const [majors, setMajors] = useState<{ id: number; name: string }[]>([]);
  const [techs, setTechs] = useState<{ id: number; name: string }[]>([]);
  const [project, setProject] = useState<any>();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  const [selectedMajorFilter, setSelectedMajorFilter] = useState("");
  const [selectedTechnologyFilter, setSelectedTechnologyFilter] = useState("");

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 1 } },
  };

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

  const fetchProjectData = useCallback(async () => {
    setLoading(true);
    const resultProject = await getProjectDetail(id);
    if (resultProject?.success) setProject(resultProject.data[0]);
    console.log(resultProject?.data[0]);
    setToggleStatus(resultProject?.data[0]?.is_disable);
    console.log(resultProject?.data[0]?.is_disable);
    setLoading(false);
  }, [id]);

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
    fetchProjectData();
  }, [fetchProjectData]);



  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleToggleIsDisabled = async () => {
    console.log("Masuk");
    const resultToggleIsDisable = await toggleIsDisable(id);
    console.log(resultToggleIsDisable);
    if (resultToggleIsDisable?.success) fetchProjectData();
  };

  return (
    <motion.div className="relative min-h-screen flex flex-col pt-28 2xl:px-16 bg-gray-50">
      <div
        className={`bg-gray-50 fixed top-0 h-[7rem] w-full left-0 z-10`}
      ></div>

      <motion.div
        className="relative flex flex-col lg:flex-row justify-center items-start w-auto bg-white h-full mx-5 sm:mx-9 rounded-md px-3 lg:px-5 mb-14 pb-7 pt-3"
        initial="hidden"
        animate="visible"
        exit="hidden"
      >
        <motion.div
          className={`lg:sticky top-32 w-full md:w-[30rem] h-full py-2 opacity-100 flex flex-col sm:gap-5 transition-all ease-in-out duration-500 overflow-hidden`}
          variants={containerVariants}
        >
          <Link
            href={"/dashboard-admin"}
            className="hover:bg-gray-100 p-1.5 cursor-pointer rounded-md flex justify-start items-center w-fit "
          >
            <IoIosArrowRoundBack className="w-7 h-7" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl border-t pt-5 mr-4 hidden lg:block">
            List Developers
          </h1>

          {project?.projectGroups?.map((projectGroup: any) => (
            <Link
              key={projectGroup?.student_id}
              href={{
                pathname: `/profile/${projectGroup?.student_id}`,
                query: {
                  name: projectGroup?.student_name, 
                },
              }}
              className=" hidden lg:flex justify-start items-center gap-5 border-b pb-5 mr-4 cursor-pointer"
            >
              <Image
                src="/images/1.jpg"
                width={80}
                height={80}
                alt="Student avatar"
                className="rounded-full h-20 w-20 p-1 border object-cover"
              />
              <div className="w-48">
                <h1 className="truncate font-semibold capitalize">
                  {projectGroup?.student_name.toLowerCase()}
                </h1>
                <h1 className="truncate text-sm text-gray-500">
                  {projectGroup?.student_binusian_id}
                </h1>
                <h1 className="truncate text-sm text-gray-500">
                  {projectGroup?.student_id}
                </h1>
              </div>
            </Link>
          ))}
        </motion.div>
        <motion.div
          className="relative w-full lg:border-l pl-3 flex flex-col h-fit pb-3 sm:py-3 justify-start items-start transition-all ease-in-out duration-500"
          variants={containerVariants}
        >
          <div className="w-full flex flex-col pr-2 sm:pr-5">
            <div className="w-full flex flex-col md:flex-row justify-start items-start border-b pb-5 gap-3 md:gap-0">
              <div className="sm:mx-3 flex flex-col gap-1 md:w-2/3">
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {project?.projectDetail?.title}
                </h1>
                <h3 className="text-xs sm:text-sm text-gray-500">
                  By{" "}
                  {project?.projectGroups?.map((member: any, index: number) => (
                    <span key={member?.student_id} className="text-gray-500">
                      {member?.student_name}
                      {index + 1 < project?.projectGroups?.length && ", "}
                    </span>
                  ))}
                </h3>
                <div className="h-fit flex-grow my-3 md:pr-10">
                  <h1 className="text-sm sm:text-base sm:text-balance text-gray-700">
                    {project?.projectDetail?.description}
                  </h1>
                </div>
                <Link
                  href={
                    project?.projectDetail?.github_link
                      ? project?.projectDetail?.github_link
                      : "#"
                  }
                  className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                >
                  <SiGithub fill="#EB9327" />
                  {project?.projectDetail?.github_link}
                </Link>
                <Link
                  href={
                    project?.projectDetail?.project_link
                      ? project?.projectDetail?.project_link
                      : "#"
                  }
                  className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                >
                  <BsGlobe2 fill="#EB9327" />{" "}
                  {project?.projectDetail?.project_link}
                </Link>

                {project?.projectDetail?.video_link &&
                  project?.projectDetail?.video_link != "" && (
                    <Link
                      href={project?.projectDetail?.video_link}
                      className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                    >
                      <IoIosVideocam fill="#EB9327" />{" "}
                      {project?.projectDetail?.video_link}
                    </Link>
                  )}
              </div>
              <div className="px-2 md:w-1/3">
                <Image
                  src={project?.projectDetail?.thumbnail}
                  width={800}
                  height={500}
                  alt="Project thumbnail"
                  unoptimized
                  className="w-full h-auto rounded-md border object-cover"
                />
              </div>
            </div>
            <div className="w-full h-96 my-3 flex overflow-auto gap-3">
              {project?.galleries?.map((file: any) => (
                <Image
                  key={file?.image}
                  src={file?.image}
                  width={576}
                  height={384}
                  alt="Gallery image"
                  unoptimized
                  className="h-full w-auto rounded-md border object-cover"
                />
              ))}
            </div>
            <iframe
              src={project?.projectDetail?.documentation}
              className="w-full h-96"
            />
          </div>
          <div className="w-full h-auto flex justify-end items-center gap-5 mt-10">
            <div className="flex justify-center items-center gap-1 bg-white rounded-md border p-1">
              <div
                onClick={() => {
                  if (toggleStatus === 1) {
                    handleToggleIsDisabled();
                  }
                }}
                className={`px-5 py-1 ${
                  toggleStatus == 0
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-green-500"
                } cursor-pointer rounded-sm sm:text-lg`}
              >
                Show Project
              </div>
              <div
                onClick={() => {
                  if (toggleStatus === 0) {
                    handleToggleIsDisabled();
                  }
                }}
                className={`px-5 py-1 ${
                  toggleStatus == 1
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 text-red-500"
                } cursor-pointer rounded-sm sm:text-lg`}
              >
                Hide Project
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      {loading && <Loading />}
    </motion.div>
  );
};

export default Page;
