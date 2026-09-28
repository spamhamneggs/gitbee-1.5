"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import DDMenuSemester from "@/app/components/DDMenuSemester";
import { BsCalendar4Range, BsGlobe2 } from "react-icons/bs";
import Link from "next/link";
import Image from "next/image";
import { SiGithub } from "react-icons/si";
import { useAuth } from "@/app/context/AuthContext";
import { getCurrStudentProject } from "./actions";
import { IoIosVideocam } from "react-icons/io";

const Page = () => {
  const { userData } = useAuth();
  const [studentProjects, setStudentProjects] = useState<any>();

  useEffect(() => {
    const fetchData = async () => {
      const resultProjectStudent = await getCurrStudentProject(
        userData?.nim ? userData.nim : ""
      );
      setStudentProjects(resultProjectStudent?.data);
      console.log(resultProjectStudent?.data);
    };
    fetchData();
  }, [userData?.nim]);



  return (
    <motion.div className="relative min-h-screen flex flex-col justify-start items-center px-5 sm:px-10 ">
      <div className="h-fit w-full pt-24 flex flex-col justify-start items-center">
        <div className="w-full lg:w-[45rem] flex justify-start items-center gap-3">
          <Image
            src="https://www.shutterstock.com/image-vector/smiling-crazy-face-bright-funny-260nw-2019181259.jpg"
            width={128}
            height={128}
            alt="Profile photo"
            unoptimized
            className="border w-32 h-32 object-cover p-2"
          />
          <div className="flex flex-col">
            <h1 className="text-2xl font-semibold capitalize">
              Hi<span className="text-primary-orange">,</span> I'm{" "}
              {userData?.name.toLowerCase()}
              <span className="text-primary-orange">.</span>
            </h1>
            <span className="text-sm">{userData?.email}</span>
            <span className="text-sm">{userData?.nim}</span>
          </div>
        </div>
      </div>
      <div className="w-full lg:w-[45rem] flex flex-col justify-start items-start gap-3 my-9 border-t pt-9 mb-24">
        <h1 className="text-2xl font-semibold">
          <span className="text-primary-orange">~</span> Portofolio
        </h1>
        {studentProjects?.map((project: any, index: number) => (
          <div key={project?.projectDetail?.thumbnail}
            className={`flex flex-col justify-start ${
              index % 2 == 0 ? "items-end" : "items-start"
            } w-full my-5 gap-2`}
          >
            <h1 className="text-xl font-semibold text-primary-orange relative after:absolute after:bottom-px after:left-0 after:w-full after:h-px after:bg-primary-binus">
              {project?.projectDetail?.title}
            </h1>
            <h3 className="text-justify">
              {project?.projectDetail?.description}
            </h3>
            <Image
              src={project?.projectDetail?.thumbnail}
              width={1280}
              height={720}
              alt="Project thumbnail"
              unoptimized
              className="border w-full max-h-[30rem] object-cover p-5 my-3"
            />
            <div className="h-px w-full bg-gray-300"></div>
            <div className="w-full grid grid-cols-1 md:grid-cols-2 justify-start items-center gap-5">
              {project?.galleries.map((gallery: any) => (
                <Image
                  key={gallery?.image}
                  src={gallery?.image}
                  width={1280}
                  height={320}
                  alt="Gallery image"
                  unoptimized
                  className="border w-full h-80 object-cover p-5 my-3"
                />
              ))}
            </div>
            <div className="h-px w-full bg-gray-300"></div>
            <div className="w-full flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center">
              <Link
                href={project?.projectDetail?.github_link}
                className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
              >
                <SiGithub fill="#EB9327" />
                {project?.projectDetail?.github_link}
              </Link>
              <Link
                href={project?.projectDetail?.project_link}
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
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default Page;
