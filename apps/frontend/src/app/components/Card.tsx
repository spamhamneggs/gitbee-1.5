import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";

type CardProps = {
  image: string;
  title: string;
  developers: any[];
  delay: number;
  classStyle?: string;
};

const Card: React.FC<CardProps> = ({ image, title, developers, delay, classStyle }) => {
  return (
    <motion.div className={`w-full max-w-full ${classStyle == "full-parent-content" ? "" : "max-w-96"} h-[25rem] bg-white border rounded-lg shadow-sm hover:shadow-lg flex flex-col justify-center gap-4 overflow-hidden px-4 cursor-pointer hover:-translate-y-3 transition-transform duration-300 ease-in-out`}>
      <Image
        src={image}
        width={384}
        height={288}
        alt={title}
        unoptimized
        className="w-full max-w-full h-auto object-cover rounded-lg"
      />
      <div className="w-full flex flex-col gap-1">
        <h2 className="text-2xl sm:text-3xl truncate w-11/12 ms-1 font-montserrat font-semibold text-balance">
          {title}
        </h2>
        <h3 className="text-xs sm:text-sm truncate w-11/12 ms-1 font-montserrat text-gray-700">
          By:{" "}
          {developers.map((developer, index) => (
            <span
              className="font-montserrat text-gray-700 capitalize"
              key={developer?.student_id ?? developer?.student_name}
            >
              {developer?.student_name?.toLowerCase()}
              {index < developers?.length - 1 ? ", " : ""}
            </span>
          ))}
        </h3>
      </div>
    </motion.div>
  );
};

export default Card;
