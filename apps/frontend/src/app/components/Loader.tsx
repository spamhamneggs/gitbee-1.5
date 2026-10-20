"use client";
import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";

const Loader = () => {
  return (
    <div className="w-screen h-screen flex justify-center items-center">
      <motion.div
        className="flex justify-around items-center w-full"
        initial={{ opacity: 0, scale: 1, y: 150 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <Image
          src={"/images/image-1.webp"}
          alt={"image 1"}
          width={320}
          height={180}
        />
        <Image
          src={"/images/image-1.webp"}
          alt={"image 1"}
          width={320}
          height={180}
        />
      </motion.div>
    </div>
  );
};

export default Loader;
