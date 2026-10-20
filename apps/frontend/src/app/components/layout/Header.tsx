"use client";
import { useAuth } from "@/app/context/AuthContext";
import { useMsal } from "@azure/msal-react";
import { useScroll } from "framer-motion";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FaUser } from "react-icons/fa";
import { IoLogOut } from "react-icons/io5";
import { MdSupportAgent } from "react-icons/md";
import { useRouter } from "next/navigation";
import { login } from "@/app/(pages)/login/actions";
import Loading from "../Loading";

const Header = () => {
  const router = useRouter();
  const { userData, setUserData } = useAuth();
  const { instance, inProgress, accounts } = useMsal();
  const { scrollYProgress } = useScroll();
  const prevScrollYRef = useRef(0);
  const [expand, setExpand] = useState(true);
  const [onTop, setOnTop] = useState(true);
  const [loading, setLoading] = useState(false);
  const [openHamburger, setOpenHamburger] = useState(false);

  useEffect(() => {
    const handleScroll = (currentScrollY: number) => {
      if (currentScrollY == 0) setOnTop(true);
      else if (currentScrollY != 0) setOnTop(false);

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

  const [prevExpand, setPrevExpand] = useState(expand);
  if (expand !== prevExpand) {
    setPrevExpand(expand);
    setOpenHamburger(false);
  }

  const loginMicrosoft = async () => {
    const loginRequest = {
      scopes: ["user.read"],
      prompt: "select_account",
    };

    instance.loginRedirect(loginRequest).catch((error: any) => {
      console.error(error);
    });
  };

  const logoutMircosoft = async () => {
    instance.logoutRedirect();
    Cookies.remove("token");
  };

  const changeRole = async (role: string) => {
    if (userData) {
      setLoading(true);
      Cookies.remove("token");
      console.log(userData?.microsoftToken);
      const result = await login(userData.microsoftToken, role);
      console.log(result);
      if (result?.success) {
        setUserData({
          nim: result.data.nim,
          name: result.data.Name,
          email: result.data.Email,
          role: result.data.ActiveRole,
          listRole: result.data.Role,
          microsoftToken: result.data.MicrosoftToken,
        });

        console.log(result.data);
        if (result.data.ActiveRole?.toLowerCase() == "student")
          router.push("/dashboard");
        if (result.data.ActiveRole?.toLowerCase() == "lecturer")
          router.push("/dashboard-lecturer");
        if (result.data.ActiveRole?.toLowerCase() == "scc")
          router.push("/dashboard-scc");
        if (result.data.ActiveRole?.toLowerCase() == "hop")
          router.push("/dashboard-hop");
        if (result.data.ActiveRole?.toLowerCase() == "admin")
          router.push("/dashboard-admin");
        setLoading(false);
      } else {
        router.push("/");
      }
    }
  };

  return (
    <div
      className={`${
        onTop ? "bg-gray-50 px-0" : "bg-transparent px-3"
      } fixed top-0 left-0 w-screen ${
        openHamburger ? "h-full" : "h-20"
      } flex justify-center items-start lg:px-0 xl:px-16 transition-all ease-in-out duration-700 z-50 pointer-events-none pt-1`}
    >
      <div
        className={`${
          expand ? "w-full px-5 sm:px-9" : "w-40 px-3"
        } transition-all ease-in-out duration-700 flex justify-between items-center ${
          onTop ? "shadow-none" : "shadow-lg"
        } py-3 rounded-md bg-gray-50 overflow-hidden z-50 pointer-events-auto ${
          openHamburger ? "shadow-xl" : ""
        }`}
        onMouseEnter={() => setExpand(true)}
      >
        <div className="bg-gray-50 w-full h-20 top-0 left-0 absolute sm:hidden -z-[5]"></div>
        <div
          className={`${
            expand ? "w-40" : "w-full"
          } flex justify-center items-center transition-all ease-in-out duration-700 z-50`}
        >
          <h1
            className={`font-montserrat font-bold text-2xl text-gray-800 ${
              expand ? "text-start" : "text-center"
            } w-40`}
          >
            <Link href="/" className="text-primary-binus">
              <span className="bg-primary-binus text-white px-2 rounded-md mr-1">
                Git
              </span>
              Bee
            </Link>
          </h1>
        </div>
        <div
          className={`${
            expand ? "w-auto" : "w-0 overflow-x-hidden"
          } flex justify-center items-center gap-5 lg:gap-0 `}
        >
          <ul
            className={`top-0 absolute right-0 lg:relative flex justify-center items-center gap-5 h-full w-full lg:w-auto pt-20 overflow-auto sm:pt-28 lg:pt-0 -z-10 lg:z-0`}
          >
            {!userData && (
              <ul
                className={`${
                  openHamburger
                    ? "opacity-100"
                    : "pointer-events-none opacity-0 lg:opacity-100 lg:pointer-events-auto"
                } flex flex-col lg:flex-row justify-start lg:justify-center items-end lg:items-center gap-5 transition-all duration-300 ease-in-out h-full w-full px-5 sm:px-10`}
              >
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/"
                >
                  <li className="w-20 cursor-pointer py-2 px-1 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Home
                  </li>
                </Link>
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/explore"
                >
                  <li className="w-20 cursor-pointer py-2 px-1 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Explore
                  </li>
                </Link>
              </ul>
            )}
            {userData && userData.role === "Student" && (
              <ul
                className={`${
                  openHamburger
                    ? "opacity-100"
                    : "pointer-events-none opacity-0 lg:opacity-100 lg:pointer-events-auto"
                } flex flex-col lg:flex-row justify-start lg:justify-center items-end lg:items-center gap-5 transition-all duration-300 ease-in-out h-full w-full px-5 sm:px-10`}
              >
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/dashboard"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Dashboard
                  </li>
                </Link>
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/explore"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Explore
                  </li>
                </Link>
              </ul>
            )}
            {userData && userData.role === "Lecturer" && (
              <ul
                className={`${
                  openHamburger
                    ? "opacity-100"
                    : "pointer-events-none opacity-0 lg:opacity-100 lg:pointer-events-auto"
                } flex flex-col lg:flex-row justify-start lg:justify-center items-end lg:items-center gap-5 transition-all duration-300 ease-in-out h-full w-full px-5 sm:px-10`}
              >
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/dashboard-lecturer"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Dashboard
                  </li>
                </Link>
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/history-lecturer"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    History
                  </li>
                </Link>
              </ul>
            )}
            {userData && userData.role.toLowerCase() === "scc" && (
              <ul
                className={`${
                  openHamburger
                    ? "opacity-100"
                    : "pointer-events-none opacity-0 lg:opacity-100 lg:pointer-events-auto"
                } flex flex-col lg:flex-row justify-start lg:justify-center items-end lg:items-center gap-5 transition-all duration-300 ease-in-out h-full w-full px-5 sm:px-10`}
              >
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/dashboard-scc"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Dashboard
                  </li>
                </Link>
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/explore"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Explore
                  </li>
                </Link>
              </ul>
            )}
            {userData && userData.role.toLowerCase() === "hop" && (
              <ul
                className={`${
                  openHamburger
                    ? "opacity-100"
                    : "pointer-events-none opacity-0 lg:opacity-100 lg:pointer-events-auto"
                } flex flex-col lg:flex-row justify-start lg:justify-center items-end lg:items-center gap-5 transition-all duration-300 ease-in-out h-full w-full px-5 sm:px-10`}
              >
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/dashboard-hop"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Dashboard
                  </li>
                </Link>
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/explore"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Explore
                  </li>
                </Link>
              </ul>
            )}
            {userData && userData.role === "Admin" && (
              <ul
                className={`${
                  openHamburger
                    ? "opacity-100"
                    : "pointer-events-none opacity-0 lg:opacity-100 lg:pointer-events-auto"
                } flex flex-col lg:flex-row justify-start lg:justify-center items-end lg:items-center gap-5 transition-all duration-300 ease-in-out h-full w-full px-5 sm:px-10`}
              >
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/dashboard-admin"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Dashboard
                  </li>
                </Link>
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/manage-users"
                >
                  <li className="text-nowrap w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Manage Users
                  </li>
                </Link>
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/manage-categories"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Categories
                  </li>
                </Link>
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/manage-transactions"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Transactions
                  </li>
                </Link>
                <Link
                  onClick={() => setOpenHamburger(false)}
                  className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                  href="/manage-student"
                >
                  <li className="w-fit cursor-pointer py-2 px-3 relative after:absolute after:w-0 hover:after:w-full after:h-[2px] after:bottom-0 after:left-0 after:bg-primary-binus flex justify-center items-center after:transition-all after:ease-in-out after:duration-300">
                    Students
                  </li>
                </Link>
              </ul>
            )}
          </ul>
          {!userData ? (
            <button
              onClick={() => loginMicrosoft()}
              className="relative isolate whitespace-nowrap shrink-0 border border-primary-orange bg-transparent ml-1 px-5 py-1.5 lg:py-2.5 text-primary-orange transition-colors before:absolute before:left-0 before:top-0 before:-z-10 before:h-full before:w-full before:origin-bottom-right before:scale-y-0 before:scale-x-0 before:bg-primary-orange before:transition-transform before:duration-300 before:content-[''] hover:text-white before:hover:scale-y-100 before:hover:scale-x-100 rounded-md before:rounded-sm overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-orange"
            >
              Login
            </button>
          ) : (
            <Popover>
              <PopoverTrigger className="relative border border-primary-orange p-[0.1rem] rounded-full before:absolute before:left-0 before:top-0 before:-z-10 before:h-full before:w-full before:origin-bottom-right before:scale-y-0 before:scale-x-0 before:bg-primary-orange before:transition-transform before:duration-300 before:content-[''] hover:text-white before:hover:scale-y-100 before:hover:scale-x-100 before:rounded-sm overflow-hidden">
                <div className="bg-white rounded-full p-0.5">
                  <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" />
                  </Avatar>
                </div>
              </PopoverTrigger>
              {expand && (
                <PopoverContent className="flex flex-col">
                  <div className="flex justify-between items-center border-b pb-3 px-1">
                    <div className="border border-primary-orange rounded-full p-1">
                      <Avatar>
                        <AvatarImage src="https://github.com/shadcn.png" />
                      </Avatar>
                    </div>
                    <div className="text-end">
                      <h1 className="truncate w-32 capitalize">
                        {userData.name.toLowerCase()}
                      </h1>
                      <h3 className="truncate w-32 text-sm text-primary-orange">
                        {userData.nim}
                      </h3>
                    </div>
                  </div>
                  <div className="bg-gray-50 py-2 px-2 rounded-md my-3">
                    <ul className="flex flex-col justify-center items-center gap-1">
                      {userData?.listRole
                        ?.filter((role) => role !== userData.role)
                        .map((role) => (
                          <div
                            key={role}
                            className="w-full"
                            onClick={() => changeRole(role)}
                          >
                            <li className="hover:bg-white/90 rounded-md w-full cursor-pointer py-2 flex justify-between items-center px-3 hover:text-primary-orange group">
                              <FaUser className="group-hover:fill-primary-orange" />
                              Login as {role}
                            </li>
                          </div>
                        ))}
                      {userData && userData.role === "Student" && (
                        <Link
                          className="py-10 lg:py-0 w-full border-b lg:border-none  flex justify-end items-center pl-auto lg:pl-0"
                          href="/profile"
                        >
                          <li className="hover:bg-white/90 rounded-md w-full cursor-pointer py-2 flex justify-between items-center px-3 hover:text-primary-orange group ">
                            <FaUser className="group-hover:fill-primary-orange" />
                            Profile
                          </li>
                        </Link>
                      )}
                      <li
                        className="hover:bg-white/90 rounded-md w-full cursor-pointer py-2 flex justify-between items-center px-3 hover:text-primary-orange group "
                        onClick={() => logoutMircosoft()}
                      >
                        <IoLogOut className="w-5 h-5 group-hover:fill-primary-orange" />
                        Logout
                      </li>
                    </ul>
                  </div>
                </PopoverContent>
              )}
            </Popover>
          )}
          <button
            type="button"
            aria-label={openHamburger ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={openHamburger}
            className="flex lg:hidden flex-col justify-between items-end h-7 bg-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-binus rounded-sm"
            onClick={() => setOpenHamburger(!openHamburger)}
          >
            <span
              aria-hidden="true"
              className={`transition-[transform,background-color] duration-300 ease-in-out w-8 sm:w-9 h-[0.2rem] sm:h-1 bg-primary-binus rounded-lg ${
                openHamburger
                  ? "rotate-45 translate-y-3.5"
                  : "rotate-0 translate-y-0"
              }`}
            ></span>
            <span
              aria-hidden="true"
              className={`transition-[opacity] duration-300 ease-in-out w-6 sm:w-7 h-[0.2rem] sm:h-1 bg-primary-orange rounded-lg ${
                openHamburger ? "opacity-0" : ""
              }`}
            ></span>
            <span
              aria-hidden="true"
              className={`transition-[transform,width,background-color] duration-300 ease-in-out h-[0.2rem] sm:h-1 bg-primary-binus rounded-lg ${
                openHamburger
                  ? "w-8 sm:w-9 -rotate-45 -translate-y-2.5 bg-primary-orange"
                  : "w-7 sm:w-8 rotate-0 translate-y-0"
              }`}
            ></span>
          </button>
        </div>
      </div>
      {loading && <Loading />}
    </div>
  );
};

export default Header;
