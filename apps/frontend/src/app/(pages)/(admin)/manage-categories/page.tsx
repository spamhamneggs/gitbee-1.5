"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll } from "framer-motion";
import { CiSearch } from "react-icons/ci";
import { AddCategory, AddTech, getAllCategory, getAllTech } from "./actions";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PopUpCategories from "@/app/components/manage-categories/PopUpCategories";
import PopUpTechnologies from "@/app/components/manage-categories/PopUpTechnologies";

const Page = () => {
  const { scrollYProgress } = useScroll();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    []
  );
  const [techs, setTechs] = useState<{ id: number; name: string }[]>([]);
  const [inputCategory, setInputCategory] = useState("");
  const [inputTechnologies, setInputTechnologies] = useState("");
  const [openPopUpCategories, setOpenPopUpCategories] = useState(false);
  const [selectedCategoryToUpdate, setSelectedCategoryToUpdate] =
    useState<any>();
  const [openPopUpTechnologies, setOpenPopUpTechnologies] = useState(false);
  const [selectedTechnologiesToUpdate, setSelectedTechnologiesToUpdate] =
    useState<any>();

  const fetchData = useCallback(async () => {
    const resultCategory = await getAllCategory();
    if (resultCategory?.success) setCategories(resultCategory.data);
    console.log(resultCategory?.data);

    const resultTech = await getAllTech();
    if (resultTech?.success) setTechs(resultTech.data);
  }, []);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCategory = async () => {
    const result = await AddCategory(inputCategory);
    setInputCategory("");
    console.log(result);
    fetchData();
  };

  const handleAddTech = async () => {
    const result = await AddTech(inputTechnologies);
    setInputTechnologies("");
    console.log(result);
    fetchData();
  };

  return (
    <motion.div className="relative min-h-screen flex flex-col pt-28 2xl:px-16 bg-gray-50"> 
      <div
        className={`relative w-full flex flex-col lg:flex-row justify-between items-center lg:items-start gap-5 px-5 sm:px-9 h-full transition-all ease-in-out duration-300 bg-gray-50 pb-7`}
      >
        <div className="flex flex-col w-full lg:w-1/2 gap-5">
          <div className={`relative flex justify-end items-center h-full`}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute ml-3 w-7 h-7 pr-2 border-r left-1"
            >
              <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
              <g
                id="SVGRepo_tracerCarrier"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></g>
              <g id="SVGRepo_iconCarrier">
                {" "}
                <g id="Iconly/Curved/Category">
                  {" "}
                  <g id="Category">
                    {" "}
                    <path
                      id="Stroke 1"
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M21.0003 6.6738C21.0003 8.7024 19.3551 10.3476 17.3265 10.3476C15.2979 10.3476 13.6536 8.7024 13.6536 6.6738C13.6536 4.6452 15.2979 3 17.3265 3C19.3551 3 21.0003 4.6452 21.0003 6.6738Z"
                      stroke="#6B7280"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>{" "}
                    <path
                      id="Stroke 3"
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M10.3467 6.6738C10.3467 8.7024 8.7024 10.3476 6.6729 10.3476C4.6452 10.3476 3 8.7024 3 6.6738C3 4.6452 4.6452 3 6.6729 3C8.7024 3 10.3467 4.6452 10.3467 6.6738Z"
                      stroke="#6B7280"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>{" "}
                    <path
                      id="Stroke 5"
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M21.0003 17.2619C21.0003 19.2905 19.3551 20.9348 17.3265 20.9348C15.2979 20.9348 13.6536 19.2905 13.6536 17.2619C13.6536 15.2333 15.2979 13.5881 17.3265 13.5881C19.3551 13.5881 21.0003 15.2333 21.0003 17.2619Z"
                      stroke="#6B7280"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>{" "}
                    <path
                      id="Stroke 7"
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M10.3467 17.2619C10.3467 19.2905 8.7024 20.9348 6.6729 20.9348C4.6452 20.9348 3 19.2905 3 17.2619C3 15.2333 4.6452 13.5881 6.6729 13.5881C8.7024 13.5881 10.3467 15.2333 10.3467 17.2619Z"
                      stroke="#6B7280"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>{" "}
                  </g>{" "}
                </g>{" "}
              </g>
            </svg>
            <input
              type="text"
              placeholder="Input New Category"
              value={inputCategory}
              onChange={(e) => setInputCategory(e.target.value)}
              className={`border w-full h-full p-3 px-12 rounded-md text-sm sm:text-base`}
            />
            <button
              className="absolute bg-primary-binus text-white px-3 py-1 rounded-sm right-3"
              onClick={handleAddCategory}
            >
              Add Category
            </button>
          </div>
          <div className="w-full bg-white shadow-md rounded-md h-fit">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">Category ID</TableHead>
                  <TableHead className="text-start">Category Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories?.map((category, index) => (
                  <TableRow key={category?.id}>
                    <TableCell className="text-start font-medium w-40">
                      {index + 1}
                    </TableCell>
                    <TableCell className="text-start">
                      {category?.name}
                    </TableCell>
                    <TableCell
                      className="text-end text-yellow-500 cursor-pointer"
                      onClick={() => {
                        setOpenPopUpCategories(true),
                          setSelectedCategoryToUpdate(category);
                      }}
                    >
                      Update
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex flex-col w-full lg:w-1/2 gap-5">
          <div className={`relative  flex justify-end items-center h-full`}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute ml-3 w-7 h-7 pr-2 border-r left-1"
            >
              <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
              <g
                id="SVGRepo_tracerCarrier"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></g>
              <g id="SVGRepo_iconCarrier">
                {" "}
                <g id="Iconly/Curved/Category">
                  {" "}
                  <g id="Category">
                    {" "}
                    <path
                      id="Stroke 1"
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M21.0003 6.6738C21.0003 8.7024 19.3551 10.3476 17.3265 10.3476C15.2979 10.3476 13.6536 8.7024 13.6536 6.6738C13.6536 4.6452 15.2979 3 17.3265 3C19.3551 3 21.0003 4.6452 21.0003 6.6738Z"
                      stroke="#6B7280"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>{" "}
                    <path
                      id="Stroke 3"
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M10.3467 6.6738C10.3467 8.7024 8.7024 10.3476 6.6729 10.3476C4.6452 10.3476 3 8.7024 3 6.6738C3 4.6452 4.6452 3 6.6729 3C8.7024 3 10.3467 4.6452 10.3467 6.6738Z"
                      stroke="#6B7280"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>{" "}
                    <path
                      id="Stroke 5"
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M21.0003 17.2619C21.0003 19.2905 19.3551 20.9348 17.3265 20.9348C15.2979 20.9348 13.6536 19.2905 13.6536 17.2619C13.6536 15.2333 15.2979 13.5881 17.3265 13.5881C19.3551 13.5881 21.0003 15.2333 21.0003 17.2619Z"
                      stroke="#6B7280"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>{" "}
                    <path
                      id="Stroke 7"
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M10.3467 17.2619C10.3467 19.2905 8.7024 20.9348 6.6729 20.9348C4.6452 20.9348 3 19.2905 3 17.2619C3 15.2333 4.6452 13.5881 6.6729 13.5881C8.7024 13.5881 10.3467 15.2333 10.3467 17.2619Z"
                      stroke="#6B7280"
                      stroke-width="1"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>{" "}
                  </g>{" "}
                </g>{" "}
              </g>
            </svg>
            <input
              type="text"
              placeholder="Input New Technology"
              value={inputTechnologies}
              onChange={(e) => setInputTechnologies(e.target.value)}
              className={`border w-full h-full p-3 px-12 rounded-md text-sm sm:text-base`}
            />
            <button
              className="absolute bg-primary-binus text-white px-3 py-1 rounded-sm right-3"
              onClick={handleAddTech}
            >
              Add Tech
            </button>
          </div>
          <div className="w-full bg-white shadow-md rounded-md h-fit">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">Tech ID</TableHead>
                  <TableHead className="text-start">Tech Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {techs.map((tech, index) => (
                  <TableRow key={tech?.id}>
                    <TableCell className="text-start font-medium w-40">
                      {index + 1}
                    </TableCell>
                    <TableCell className="text-start">{tech?.name}</TableCell>
                    <TableCell
                      className="text-end text-yellow-500 cursor-pointer"
                      onClick={() => {
                        setOpenPopUpTechnologies(true),
                          setSelectedTechnologiesToUpdate(tech);
                      }}
                    >
                      Update
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      {/* <div className="flex gap-5 mx-9 pb-10"></div> */}

      {openPopUpCategories && (
        <PopUpCategories
          setOpenPopUpCategories={setOpenPopUpCategories}
          selectedCategoryToUpdate={selectedCategoryToUpdate}
          fetchData={fetchData}
        />
      )}
      {openPopUpTechnologies && (
        <PopUpTechnologies
          setOpenPopUpTechnologies={setOpenPopUpTechnologies}
          selectedTechnologiesToUpdate={selectedTechnologiesToUpdate}
          fetchData={fetchData}
        />
      )}
    </motion.div>
  );
};

export default Page;
