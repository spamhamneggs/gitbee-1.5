import Link from "next/link";
import Image from "next/image";
import React, { useEffect } from "react";
import { BsGlobe2 } from "react-icons/bs";
import { motion } from "framer-motion";
import { IoIosArrowRoundBack, IoIosVideocam } from "react-icons/io";
import { SiGithub } from "react-icons/si";
import { AiOutlineDownload } from "react-icons/ai";

interface PreviewDetailProps {
  selectedPreviewProject: any;
  setShowPreviewDetailProject: (value: boolean) => void;
  expand: boolean;
}

function PreviewDetailComponent(props: PreviewDetailProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 1 } },
  };

  useEffect(() => {
    console.log(props.selectedPreviewProject);
  }, [props.selectedPreviewProject]);

  return (
    <motion.div
      className="relative flex justify-center items-start w-auto bg-white h-full rounded-md px-3 lg:px-5 mb-14 pb-7 pt-10 sm:pt-3"
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      <motion.div
        className={`sticky ${
          props.expand ? "top-40" : "top-24"
        } w-[30rem] h-full py-2 opacity-100 hidden lg:flex flex-col gap-5 transition-all ease-in-out duration-500 overflow-hidden`}
        variants={containerVariants}
      >
        {props.selectedPreviewProject?.projectGroups.map(
          (student: any, index: number) => (
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
                src="https://github.com/shadcn.png"
                width={80}
                height={80}
                alt="Student avatar"
                unoptimized
                className="rounded-full h-20 w-20 p-1 border object-cover"
              />
              <div className="w-48">
                <h1 className="truncate font-semibold">
                  {student?.student_name}
                </h1>
                <h1 className="truncate text-sm text-gray-500">
                  {student?.student_binusian_id}
                </h1>
                <h1 className="truncate text-sm text-gray-500">
                  {student?.student_id}
                </h1>
              </div>
            </Link>
          )
        )}
      </motion.div>
      <motion.div
        className="relative w-full lg:border-l lg:pl-3 flex flex-col sm:flex-row gap-3 sm:gap-0 h-fit py-3 justify-start items-start transition-all ease-in-out duration-500"
        variants={containerVariants}
      >
        <div
          className="hover:bg-gray-100 p-1.5 cursor-pointer rounded-full flex justify-center items-center gap-1 sm:gap-0 border-b sm:border-none"
          onClick={() => props.setShowPreviewDetailProject(false)}
        >
          <IoIosArrowRoundBack className="w-7 h-7" />
          <span className="text-lg visible sm:hidden">Back</span>
        </div>
        <div className="w-full flex flex-col pr-5">
          <div className="w-full flex md:flex-row flex-col gap-3 lg:gap-0 justify-start items-start border-b pb-5">
            <div className="mx-1 lg:mx-3 flex flex-col gap-1 w-full md:w-2/3">
              <h1 className="text-3xl font-bold">
                {props.selectedPreviewProject?.projectDetail?.title}
              </h1>
              <h3 className="text-sm text-gray-500">
                By.{" "}
                {props.selectedPreviewProject?.projectGroups?.map(
                  (row: any, index: number) => {
                    return (
                      <span
                        key={row?.student_id}
                        className="capitalize text-gray-500"
                      >
                        {row?.student_name.toLowerCase()}
                        {index + 1 <
                        props.selectedPreviewProject?.projectGroups.length
                          ? ", "
                          : ""}
                      </span>
                    );
                  }
                )}
              </h3>
              <div className="h-fit flex-grow my-3 pr-4 lg:pr-10">
                <h1 className="text-balance text-gray-700">
                  {props.selectedPreviewProject?.projectDetail?.description}
                </h1>
              </div>
              <div className="h-fit flex-grow mb-3">
                <h1 className="text-primary-binus italic">
                  {props.selectedPreviewProject?.projectTechnologies?.map(
                    (tech: any, index: number) => (
                      <span key={tech?.technology_name}>
                        {tech?.technology_name}
                        {index + 1 <
                        props.selectedPreviewProject?.projectTechnologies
                          ?.length
                          ? ", "
                          : ""}
                      </span>
                    )
                  )}
                </h1>
              </div>
              <Link
                href={props.selectedPreviewProject?.projectDetail?.github_link}
                className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
              >
                <SiGithub fill="#EB9327" />
                {props.selectedPreviewProject?.projectDetail?.github_link}
              </Link>
              <Link
                href={props.selectedPreviewProject?.projectDetail?.project_link}
                className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
              >
                <BsGlobe2 fill="#EB9327" />{" "}
                {props.selectedPreviewProject?.projectDetail?.project_link}
              </Link>

              {props.selectedPreviewProject?.projectDetail?.video_link &&
                props.selectedPreviewProject?.projectDetail?.video_link !=
                  "" && (
                  <Link
                    href={
                      props.selectedPreviewProject?.projectDetail?.video_link
                    }
                    className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                  >
                    <IoIosVideocam fill="#EB9327" />{" "}
                    {props.selectedPreviewProject?.projectDetail?.video_link}
                  </Link>
                )}
            </div>
            <div className="md:w-1/3">
              {/* <img
                    src="/images/image-1.webp"
                    className="w-full rounded-md"
                    /> */}
              <Image
                src={props.selectedPreviewProject?.projectDetail?.thumbnail}
                width={800}
                height={500}
                alt="Project thumbnail"
                unoptimized
                className="w-full h-auto rounded-md border object-cover"
              />
            </div>
          </div>
          <div className="w-full h-96 my-3 flex overflow-auto gap-3">
            {props.selectedPreviewProject?.galleries.map((gallery: any) => (
              <Image
                key={gallery?.image}
                src={gallery?.image}
                width={576}
                height={384}
                alt="Gallery image"
                unoptimized
                className="h-full w-auto rounded-md border object-cover"
              />
            ))}
          </div>
          <div className="w-full h-[30rem] overflow-auto flex flex-col">
            <a
              className="flex justify-end items-center gap-1 my-2 hover:underline"
              href={props.selectedPreviewProject?.projectDetail?.documentation}
            >
              Download Documentation
              <AiOutlineDownload className="w-5 h-5" />
            </a>
            <iframe
              src={props.selectedPreviewProject?.projectDetail?.documentation}
              className="w-full h-96"
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default PreviewDetailComponent;
