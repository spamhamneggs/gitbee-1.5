"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PopUpInsert from "@/app/components/course/PopUpInsert";
import {
  deleteGroup,
  getAllCategory,
  getAllTech,
  getGroupDetail,
  getProjectDetail,
} from "./actions";
import { useAuth } from "@/app/context/AuthContext";
import Loading from "@/app/components/Loading";
import Link from "next/link";
import Image from "next/image";
import { SiGithub } from "react-icons/si";
import { BsGlobe2 } from "react-icons/bs";
import { useSearchParams } from "next/navigation";
import { FaVideo } from "react-icons/fa";
import { IoIosVideocam } from "react-icons/io";
import { MdDelete } from "react-icons/md";

const Page = () => {
  const searchParams = useSearchParams();
  const course_code = searchParams.get("course_code");
  const course_name = searchParams.get("course_name");
  const semester_id = searchParams.get("semester_id");
  const class_id = searchParams.get("class_id");
  const { userData } = useAuth();
  const { scrollYProgress } = useScroll();
  const prevScrollYRef = useRef(0);
  const { toast } = useToast();
  const [expand, setExpand] = useState(true);
  const [showInsertForm, setShowInsertForm] = useState(false);
  const [groupDetail, setGroupDetail] = useState<any>([]);
  const [projectDetail, setProjectDetail] = useState<any>([]);
  const [classTransactionDetail, setClassTransactionDetail] = useState<any>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any>([]);
  const [technologies, setTechnologies] = useState<any>([]);

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

  const handleDeleteGroup = async () => {
    const resultDeleteGroup = await deleteGroup(
      semester_id ? semester_id : "",
      course_code ? course_code : "",
      class_id ? class_id : "",
      groupDetail[0]?.group
    );

    fetchData();
    console.log(resultDeleteGroup);
  };

  const fetchData = async () => {
    setLoading(true);

    const resultProjectDetail = await getProjectDetail(
      semester_id ? semester_id : "",
      course_code ? course_code : "",
      class_id ? class_id : "",
      userData?.nim ? userData?.nim : ""
    );
    setProjectDetail(resultProjectDetail?.data?.updatedProjects);
    setClassTransactionDetail(resultProjectDetail?.data?.classTransactions);
    console.log(resultProjectDetail?.data);

    if (resultProjectDetail?.data?.updatedProjects?.length > 0) {
      setGroupDetail(
        resultProjectDetail?.data?.updatedProjects[0]?.projectGroups
      );
      console.log(resultProjectDetail?.data?.updatedProjects[0]?.projectGroups);
    } else if (projectDetail?.length == 0) {
      const resultDetailGroup = await getGroupDetail(
        semester_id ? semester_id : "",
        course_code ? course_code : "",
        class_id ? class_id : "",
        userData?.nim ? userData?.nim : ""
      );
      setGroupDetail(resultDetailGroup?.data);
      console.log(resultDetailGroup?.data);
    }

    const resultCategories = await getAllCategory();
    setCategories(resultCategories?.data);

    const resultTechnology = await getAllTech();
    setTechnologies(resultTechnology?.data);

    setLoading(false);
  };

  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state, @eslint-react/exhaustive-deps -- loading flag tracks the mount-snapshot fetch lifecycle; depending on fetchData would refetch in a loop since it reads the initial projectDetail */
  useEffect(() => {
    fetchData();
  }, []);
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state, @eslint-react/exhaustive-deps */

  return (
    <motion.div className="relative min-h-screen flex flex-col justify-start items-center px-5 sm:px-10 xl:px-[6.25rem] ">
      <div
        className={`fixed top-0 w-full flex justify-center items-center transition-all ease-in-out duration-300 px-5 sm:px-10 xl:px-24 z-10 ${
          expand ? "pt-24" : "pt-10"
        } bg-gray-50`}
      >
        <div className="w-full border-b flex flex-col-reverse sm:flex-row justify-between items-start sm:items-center pb-3">
          <div
            className={`px-1 sm:text-nowrap ${
              expand ? "sm:w-1/2" : "sm:w-[calc(50%-5rem)]"
            }`}
          >
            <h1 className="font-montserrat text-base sm:text-lg md:text-xl text-primary-binus font-semibold">
              <span className="text-primary-orange text-base lg:text-lg md:text-xl">
                {course_code}
              </span>{" "}
              - {course_name}
            </h1>
          </div>
          <div
            className={`${
              expand ? "w-0" : "w-40"
            } transition-all ease-in-out duration-700 bg-transparent h-2 mx-2`}
          ></div>
          <div
            className={` ${
              expand ? "sm:w-1/2" : "sm:w-[calc(50%-5rem)]"
            } flex justify-end items-center`}
          >
            <div className="bg-secondary-binus text-lg md:text-xl font-semibold rounded-lg px-2 text-nowrap">
              {class_id?.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`fixed top-0 w-full h-fit hidden sm:flex justify-start items-center transition-all ease-in-out duration-300 px-5 sm:px-10 xl:px-24 pb-3 z-[5] ${
          expand ? "sm:pt-36" : "sm:pt-[5.5rem]"
        } bg-gray-50`}
      >
        <Breadcrumb className="px-1">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/dashboard"
                className="relative text-primary-binus hover:text-primary-binus after:absolute after:bottom-0 after:left-0 after:w-0 hover:after:w-full after:h-px after:bg-primary-orange after:transition-all after:duration-300"
              >
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-primary-orange">
                {course_code} - {course_name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="h-fit w-full pt-52 sm:pt-48 pb-10 flex flex-col gap-5">
        {groupDetail?.length >= 1 && (
          <div className="sm:w-[31rem] max-h-[21rem] h-fit overflow-y-auto shadow-xl border rounded-xl p-5">
            <div className="w-full flex justify-between items-center">
              <h1 className="text-xl">Group Forming</h1>

              <button
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to delete Group " +
                        groupDetail?.group +
                        "?"
                    )
                  ) {
                    handleDeleteGroup();
                  }
                }}
                className="text-white bg-red-500 px-2 py-2 rounded-md flex justify-center items-center gap-2"
              >
                <MdDelete className="text-white fill-white w-5 h-5" />
              </button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35px]">NO</TableHead>
                  <TableHead className="w-32">NIM</TableHead>
                  <TableHead className="w-96">NAME</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupDetail.map((row: any, index: number) => (
                  <TableRow key={row?.student_id}>
                    <TableCell className="font-medium text-center">
                      {index + 1}
                    </TableCell>
                    <TableCell className="w-32">{row?.student_id}</TableCell>
                    <TableCell className="w-96 truncate">
                      {row?.student_name}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {groupDetail < 1 && (
              <div className="w-full text-center py-5 text-gray-500">
                No Data . . .
              </div>
            )}
          </div>
        )}
        <div className="flex-grow max-h-[21rem] h-fit overflow-y-auto shadow-xl border rounded-xl p-5">
          <h1 className="text-xl">Submitted Answer</h1>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">TYPE</TableHead>
                <TableHead className="text-center">DEADLINE</TableHead>
                <TableHead className="text-center">UPLOADED BY</TableHead>
                <TableHead className="text-center">UPLOADED DATE</TableHead>
                <TableHead className="text-center">STATUS</TableHead>
                <TableHead className="text-center">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectDetail?.length > 0 ? (
                projectDetail?.map((project: any, index: number) => (
                  <TableRow key={project?.student_leader_id}>
                    <TableCell className="font-medium text-center">
                      Project-1
                    </TableCell>
                    <TableCell className="text-center">
                      10 December 2024, 18:17:12
                    </TableCell>
                    <TableCell className="text-center">
                      {project?.student_leader_id}
                    </TableCell>
                    <TableCell className="text-center">
                      {new Date(project?.created_at)
                        .toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })
                        .replace(" at ", ", ")}
                    </TableCell>
                    <TableCell className="font-medium text-center">
                      {project?.projectDetail?.status_id == 1 ? (
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md">
                          Submitted
                        </span>
                      ) : project?.projectDetail?.status_id == 2 ? (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md">
                          Graded
                        </span>
                      ) : (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                          Review
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-center">
                      <button
                        className="bg-primary-binus text-white px-2 py-1 rounded-md hover:bg-primary-orange"
                        onClick={() => setShowInsertForm(true)}
                      >
                        Upload
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="font-medium text-center">
                    Project-1
                  </TableCell>
                  <TableCell className="text-center">
                    10 December 2024, 18:17:12
                  </TableCell>
                  <TableCell className="text-center">-</TableCell>
                  <TableCell className="text-center">-</TableCell>
                  <TableCell className="font-medium text-center">-</TableCell>
                  <TableCell className="font-medium text-center">
                    <button
                      className={`bg-primary-binus hover:bg-primary-orange text-white px-2 py-1 rounded-md `}
                      onClick={() => setShowInsertForm(true)}
                    >
                      Upload
                    </button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {projectDetail?.length > 0 && (
          <div className="flex-grow h-fit overflow-y-auto shadow-xl border rounded-xl p-5">
            <h1 className="text-lg sm:text-xl">Detail Project</h1>
            <motion.div className="relative w-full flex h-fit py-5 justify-start items-start transition-all ease-in-out duration-500 sm:px-3">
              <div className="w-full flex flex-col lg:pr-5">
                <div className="w-full flex flex-col lg:flex-row justify-start items-start border-b pb-5 gap-5 lg:gap-0">
                  <div className="flex flex-col gap-1 w-full lg:w-2/3">
                    <h1 className="text-2xl sm:text-3xl font-bold">
                      {projectDetail[0]?.projectDetail?.title}{" "}
                      <span className="text-sm font-normal">
                        (
                        {
                          categories?.find(
                            (category: any) =>
                              category?.id ==
                              projectDetail[0].projectDetail?.category_id
                          )?.name
                        }
                        )
                      </span>
                    </h1>
                    <h3 className="text-sm text-gray-500">
                      By:{" "}
                      {groupDetail?.map((row: any, index: number) => {
                        return (
                          <span
                            key={row?.student_id}
                            className="capitalize text-gray-500"
                          >
                            {row?.student_name.toLowerCase()}
                            {index + 1 < groupDetail?.length ? ", " : ""}
                          </span>
                        );
                      })}
                    </h3>
                    <div className="h-fit flex-grow my-3 lg:pr-10">
                      <h1 className="text-balance text-gray-700 overflow-auto">
                        {projectDetail[0]?.projectDetail?.description}
                      </h1>
                    </div>
                    <div className="h-fit flex-grow mb-3">
                      <h1 className="text-primary-binus italic">
                        {projectDetail[0]?.projectTechnologies?.map(
                          (tech: any, index: number) => (
                            <span key={tech?.technology_name}>
                              {tech?.technology_name}
                              {index + 1 <
                              projectDetail[0]?.projectTechnologies?.length
                                ? ", "
                                : ""}
                            </span>
                          )
                        )}
                      </h1>
                    </div>
                    <Link
                      href={projectDetail[0]?.projectDetail?.github_link}
                      className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                    >
                      <SiGithub fill="#EB9327" />
                      {projectDetail[0]?.projectDetail?.github_link}
                    </Link>
                    <Link
                      href={projectDetail[0]?.projectDetail?.project_link}
                      className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                    >
                      <BsGlobe2 fill="#EB9327" />{" "}
                      {projectDetail[0]?.projectDetail?.project_link}
                    </Link>
                    {projectDetail[0]?.projectDetail?.video_link &&
                      projectDetail[0]?.projectDetail?.video_link != "" && (
                        <Link
                          href={projectDetail[0]?.projectDetail?.video_link}
                          className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                        >
                          <IoIosVideocam fill="#EB9327" />{" "}
                          {projectDetail[0]?.projectDetail?.video_link}
                        </Link>
                      )}
                  </div>
                  <div className="w-full lg:w-1/3">
                    <Image
                      src={projectDetail[0]?.projectDetail?.thumbnail}
                      width={960}
                      height={384}
                      alt="Project thumbnail"
                      unoptimized
                      className="w-full rounded-md border h-96 object-cover"
                    />
                  </div>
                </div>
                <div className="w-full h-96 my-3 flex overflow-auto gap-3">
                  {projectDetail[0]?.galleries?.map(
                    (file: any, index: number) => (
                      <Image
                        key={file?.image}
                        src={file?.image}
                        width={576}
                        height={384}
                        alt={`Gallery Image ${index + 1}`}
                        unoptimized
                        className="w-full rounded-md border h-full object-cover"
                      />
                    )
                  )}
                </div>
                <iframe
                  src={projectDetail[0]?.projectDetail?.documentation}
                  className="w-full h-96"
                />
              </div>
            </motion.div>
          </div>
        )}
      </div>
      <Toaster />
      {showInsertForm && (
        <PopUpInsert
          groupMembers={groupDetail}
          group={projectDetail[0]?.projectDetail?.group}
          fetchData={fetchData}
          setShowInsertForm={setShowInsertForm}
          toast={toast}
          technologies={technologies}
          categories={categories}
          course_code={course_code ? course_code : ""}
          semester_id={semester_id ? semester_id : ""}
          class_id={class_id ? class_id : ""}
          userId={userData?.nim}
          lecturer_id={classTransactionDetail?.lecturer_code}
        />
      )}
      {loading && <Loading />}
    </motion.div>
  );
};

export default Page;
