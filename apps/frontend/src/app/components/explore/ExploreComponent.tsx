"use client";
import React, { useEffect } from "react";
import { motion } from "framer-motion";
import Card from "../Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ExploreProps {
  setShowDevelopers: (value: boolean) => void;
  setSelectedProjectId: (value: string) => void;
  showDevelopers: boolean;
  expand: boolean;
  projects: any;
  handleScrollToTop: () => void;
}

function ExploreComponent(props: ExploreProps) {
  const charVariants = {
    hidden: { opacity: 0 },
    reveal: { opacity: 1 },
  };

  useEffect(() => {
    console.log(props.projects);
  }, [props.projects]);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1 },
      }}
      initial="hidden"
      animate="show"
      className="relative h-full bg-white mx-9 rounded-md flex flex-col mb-14 pb-7"
    >
      <div
        className={`w-full h-auto bg-white sticky z-10 px-5 transition-all ease-in-out duration-300 visible ${
          props.expand ? "top-[21rem] sm:top-60 lg:top-[12.25rem]" : "top-28"
        }`}
      >
        <div className="p-2 my-5 rounded-md mb-4 border">
          {props.projects.length} Results Found
        </div>
      </div>

      <motion.div
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 px-5 h-fit gap-5 md:gap-7 lg:gap-5 xl:gap-10 justify-center items-start transition-all ease-in-out duration-500 pt-36 sm:pt-14 lg:pt-3`}
        initial="hidden"
        whileInView="reveal"
        variants={charVariants}
        transition={{ staggerChildren: 0.5, duration: 1 }}
      >
        {props.projects.map((project: any, index: number) => (
          <div key={project.id}
            className="flex justify-center items-center"
            onClick={() => {
              props.setShowDevelopers(!props.showDevelopers);
              props.handleScrollToTop();
              props.setSelectedProjectId(project.id);
            }}
          >
            <Card
              image={project?.projectDetail?.thumbnail}
              delay={0}
              title={project?.projectDetail?.title}
              developers={project?.projectGroups}
              classStyle="full-parent-content"
            />
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

export default ExploreComponent;
