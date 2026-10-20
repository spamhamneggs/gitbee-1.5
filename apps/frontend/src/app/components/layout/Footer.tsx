import React from "react";

const Footer = () => {
  return (
    <div className="w-full flex flex-col justify-center items-center px-5 sm:px-16">
      <div className="h-px w-full bg-gray-200" />
      <div className="w-full flex flex-col lg:flex-row justify-center items-center my-7 gap-3"> 
        <p className="relative text-xs sm:text-sm text-gray-600 font-montserrat py-1 px-px">
          Copyright &copy; BINUS University. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Footer;
