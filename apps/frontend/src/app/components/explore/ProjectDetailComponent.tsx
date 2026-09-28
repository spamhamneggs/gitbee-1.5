import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { BsGlobe2 } from "react-icons/bs";
import { motion } from "framer-motion";
import { IoIosArrowRoundBack, IoIosVideocam } from "react-icons/io";
import { SiGithub } from "react-icons/si";
import { getProjectById } from "@/app/(pages)/explore/actions";
import { useAuth } from "@/app/context/AuthContext";

interface ProjectDetailProps {
  selectedProjectId: string;
  setSelectedProjectId: (value: string) => void;
  setShowDevelopers: (value: boolean) => void;
  showDevelopers: boolean;
  expand: boolean;
}

function ProjectDetailComponent(props: ProjectDetailProps) {
  const { userData } = useAuth();
  const [detailProject, setDetailProject] = useState<any>();
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 1 } },
  };

  /* eslint-disable react-you-might-not-need-an-effect/no-derived-state -- server fetch: the result depends on an async round-trip and cannot be computed during render */
  useEffect(() => {
    const fetchSelectedProject = async () => {
      const resultProject = await getProjectById(props.selectedProjectId);
      if (resultProject?.success) setDetailProject(resultProject?.data[0]);
      console.log(resultProject?.data[0]);
    };
    fetchSelectedProject();
  }, [props.selectedProjectId]);
  /* eslint-enable react-you-might-not-need-an-effect/no-derived-state */



  return (
    <motion.div
      className="relative flex justify-center items-start w-auto bg-white h-full mx-9 rounded-md px-5 mb-14 pb-7 pt-3"
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      <motion.div
        className={`sticky ${
          props.expand ? "top-52" : "top-32"
        } w-[30rem] h-full py-2 opacity-100 flex flex-col gap-5 transition-all ease-in-out duration-500 overflow-hidden`}
        variants={containerVariants}
      >
        {detailProject?.projectGroups.map((student: any) => (
          <Link
            key={student?.student_id}
            href={{
              pathname: `/profile/${student?.student_id}`,
              query: {
                name: student?.student_name,
              },
            }}
            className="flex justify-start items-center gap-5 border-b pb-5 mr-4 cursor-pointer"
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
                {student?.student_name.toLowerCase()}
              </h1>
              <h1 className="truncate text-sm text-gray-500">
                {student?.student_id}
              </h1>
              <h1 className="truncate text-sm text-gray-500">
                Computer Science
              </h1>
            </div>
          </Link>
        ))}
      </motion.div>
      <motion.div
        className="relative w-full border-l pl-3 flex h-fit py-3 justify-start items-start transition-all ease-in-out duration-500"
        variants={containerVariants}
      >
        <div
          className="hover:bg-gray-100 p-1.5 cursor-pointer rounded-full"
          onClick={() => {
            props.setShowDevelopers(false), props.setSelectedProjectId("");
          }}
        >
          <IoIosArrowRoundBack className="w-7 h-7" />
        </div>
        <div className="w-full flex flex-col pr-5">
          <div className="w-full flex justify-start items-start border-b pb-5">
            <div className="mx-3 flex flex-col gap-1 w-2/3">
              <h1 className="text-3xl font-bold">
                {detailProject?.projectDetail?.title}
              </h1>
              <h3 className="text-sm text-gray-500">
                By Kelson Edbert S, Timothy Darren, Nicholas Chandra
              </h3>
              <div className="h-fit flex-grow my-3 pr-10">
                <h1 className="text-balance text-gray-700">
                  {detailProject?.projectDetail?.description}
                </h1>
              </div>
              {userData && userData?.role != "Student" && (
                <Link
                  href={
                    detailProject?.projectDetail?.github_link
                      ? detailProject?.projectDetail?.github_link
                      : ""
                  }
                  className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                >
                  <SiGithub fill="#EB9327" />
                  {detailProject?.projectDetail?.github_link}
                </Link>
              )}
              <Link
                href={
                  detailProject?.projectDetail?.project_link
                    ? detailProject?.projectDetail?.project_link
                    : ""
                }
                className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
              >
                <BsGlobe2 fill="#EB9327" />{" "}
                {detailProject?.projectDetail?.project_link}
              </Link>

              {detailProject?.projectDetail?.video_link &&
                detailProject?.projectDetail?.video_link != "" && (
                  <Link
                    href={detailProject?.projectDetail?.video_link}
                    className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                  >
                    <IoIosVideocam fill="#EB9327" />{" "}
                    {detailProject?.projectDetail?.video_link}
                  </Link>
                )}
            </div>
            <div className="w-1/3">
              <Image
                src={
                  detailProject?.projectDetail?.thumbnail
                    ? detailProject?.projectDetail?.thumbnail
                    : ""
                }
                width={800}
                height={500}
                alt="Project thumbnail"
                unoptimized
                className="w-full rounded-md border object-cover"
              />
            </div>
          </div>
          <div className="w-full h-96 my-3 flex overflow-auto gap-3 pb-2">
            {detailProject?.galleries.map((gallery: any) => (
              <Image
                key={gallery?.image}
                src={gallery?.image ? gallery?.image : ""}
                width={576}
                height={384}
                alt="Gallery image"
                unoptimized
                className="h-full rounded-md border-2 object-cover"
              />
            ))}
          </div>

          {userData && userData?.role != "Student" && (
            <Link
              href={
                detailProject?.projectDetail?.documentation
                  ? detailProject?.projectDetail?.documentation
                  : ""
              }
              className="mt-10 w-96 truncate"
            >
              Download PDF File
            </Link>
          )}
          {userData && userData?.role != "Student" && (
            <iframe
              src={
                detailProject?.projectDetail?.documentation
                  ? detailProject?.projectDetail?.documentation
                  : ""
              }
              className="w-full h-96"
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ProjectDetailComponent;
