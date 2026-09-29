import React, { useEffect, useState } from "react";
import Card from "../Card";
import splitStringUsingRegex from "@/app/utlis/splitStringUsingRegex";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const heading = "Discover Our Amazing Projects";
const subHeading = `"Explore our diverse range of projects and find inspiration for you next project"`;

const charVariants = {
  hidden: { opacity: 0 },
  reveal: { opacity: 1 },
};

type KeyedChar = { key: string; char: string };
// The animated strings below are constants, so position-based keys built
// once at module scope stay stable across renders.
const keyChars = (value: string): KeyedChar[] =>
  splitStringUsingRegex(value).map((char, index) => ({
    key: `${index}-${char}`,
    char,
  }));

const headingChars = keyChars(heading);
const subHeadingChars = keyChars(subHeading);

const Project = () => {
  const [showCard, setShowCard] = useState(0);
  const router = useRouter();

  const allCards = [
    {
      image: "/images/1.jpg",
      title: "Portashynska",
      developers: [
        { student_name: "Kelson" },
        { student_name: "Timothy Darren" },
        { student_name: "Nicholas Chandra" },
      ],
      delay: 0.3,
    },
    {
      image: "/images/2.jpg",
      title: "Innovative Space",
      developers: [
        { student_name: "Alice" },
        { student_name: "Bob" },
        { student_name: "Charlie" },
      ],
      delay: 0.6,
    },
    {
      image: "/images/10.jpg",
      title: "Gallery Don't know",
      developers: [
        { student_name: "Kelson" },
        { student_name: "Timothy Darren" },
        { student_name: "Nicholas Chandra" },
      ],
      delay: 0.9,
    },
    {
      image: "/images/3.jpg",
      title: "Veronique",
      developers: [
        { student_name: "Kelson" },
        { student_name: "Timothy Darren" },
        { student_name: "Nicholas Chandra" },
      ],
      delay: 1.2,
    },
    {
      image: "/images/4.jpg",
      title: "Creative Hub",
      developers: [
        { student_name: "Diana" },
        { student_name: "Eve" },
        { student_name: "Frank" },
      ],
      delay: 1.5,
    },
    {
      image: "/images/5.jpg",
      title: "Design Studio",
      developers: [
        { student_name: "Grace" },
        { student_name: "Hank" },
        { student_name: "Ivy" },
      ],
      delay: 1.8,
    },
    {
      image: "/images/6.jpg",
      title: "Tech Haven",
      developers: [
        { student_name: "Jack" },
        { student_name: "Karen" },
        { student_name: "Leo" },
      ],
      delay: 2.1,
    },
    {
      image: "/images/7.jpg",
      title: "Future Vision",
      developers: [
        { student_name: "Mike" },
        { student_name: "Nina" },
        { student_name: "Oscar" },
      ],
      delay: 2.4,
    },
    {
      image: "/images/8.jpg",
      title: "Digital Dreams",
      developers: [
        { student_name: "Paul" },
        { student_name: "Quinn" },
        { student_name: "Ruth" },
      ],
      delay: 2.7,
    },
  ];

  /* eslint-disable @eslint-react/set-state-in-effect, react-you-might-not-need-an-effect/no-initialize-state -- mount-only window read: a lazy initializer would run during SSR prerender where window does not exist */
  useEffect(() => {
    if (window.innerWidth > 1023) {
      setShowCard(3);
    } else if (window.innerWidth < 1024 && window.innerWidth > 639) {
      setShowCard(2);
    } else {
      setShowCard(4);
    }
  }, []);
  /* eslint-enable @eslint-react/set-state-in-effect, react-you-might-not-need-an-effect/no-initialize-state */

  const handleShowMore = () => {
    const increment =
      window.innerWidth < 1024 && window.innerWidth > 639 ? 2 : 3;
    if (
      (window.innerWidth < 1024 && window.innerWidth > 639 && showCard == 8) ||
      (window.innerWidth > 1023 && showCard == 9) ||
      (window.innerWidth < 640 && showCard == 9)
    ) {
      router.push("/explore");
    } else {
      setShowCard(showCard + increment);
    }
  };

  return (
    <div className="relative min-h-[42.5rem] overflow-hidden flex flex-col justify-center items-center gap-10 bg-white mb-10 mx-5 md:mx-16 rounded-xl shadow-xl py-10 px-5 md:p-10">
      <div className="flex flex-col justify-center items-center gap-2">
        <motion.h2
          initial="hidden"
          whileInView="reveal"
          transition={{ staggerChildren: 0.05 }}
          className="font-bold font-montserrat text-4xl sm:text-4xl md:text-5xl text-center text-balance"
        >
          {headingChars.map((c) => (
            <motion.span
              key={c.key}
              transition={{ duration: 0.5 }}
              variants={charVariants}
            >
              {c.char}
            </motion.span>
          ))}
        </motion.h2>
        <motion.h3
          initial="hidden"
          whileInView="reveal"
          className="text-center text-sm sm:text-base"
          transition={{ staggerChildren: 0.03 }}
        >
          {subHeadingChars.map((c) => (
            <motion.span
              className="text-primary-orange"
              key={c.key}
              transition={{ duration: 0.5 }}
              variants={charVariants}
            >
              {c.char}
            </motion.span>
          ))}
        </motion.h3>
      </div>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 xl:gap-10 px-5"
        initial="hidden"
        whileInView="reveal"
        transition={{ staggerChildren: 0.5 }}
      >
        {allCards.slice(0, showCard).map((card) => (
          <Card
            key={card.image}
            image={card.image}
            title={card.title}
            developers={card.developers}
            delay={card.delay}
          />
        ))}
      </motion.div>
      <motion.div
        className="flex gap-5 z-10"
        initial="hidden"
        whileInView="reveal"
        transition={{ staggerChildren: 0.75 }}
      >
        <motion.button
          onClick={handleShowMore}
          transition={{ duration: 0.5 }}
          variants={charVariants}
          className="w-32 cursor-pointer relative isolate whitespace-nowrap flex justify-center items-center border border-primary-binus bg-transparent px-5 py-2.5 hover:text-primary-binus transition-colors before:absolute before:left-0 before:top-0 before:-z-10 before:h-full before:w-full before:origin-bottom-left before:scale-y-100 before:bg-primary-binus before:transition-transform before:duration-300 before:content-[''] text-white before:hover:scale-y-0 rounded-md before:rounded-sm overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-binus"
        >
          {showCard+1 >= allCards?.length ? "Explore" : "Show More"}
        </motion.button>
        <motion.button
          transition={{ duration: 0.5 }}
          variants={charVariants}
          className="w-32 relative isolate whitespace-nowrap flex justify-center items-center border border-primary-binus bg-transparent px-5 py-2.5 text-primary-binus transition-colors before:absolute before:left-0 before:top-0 before:-z-10 before:h-full before:w-full before:origin-top-left before:scale-y-0 before:bg-primary-binus before:transition-transform before:duration-300 before:content-[''] hover:text-white before:hover:scale-y-100 rounded-md before:rounded-sm overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-binus"
        >
          Contact Us
        </motion.button>
      </motion.div>
    </div>
  );
};

export default Project;
