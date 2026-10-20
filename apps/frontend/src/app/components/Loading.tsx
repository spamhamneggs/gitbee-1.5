import React from "react";

const Loading = () => {
  return (
    <div className="fixed z-[100] bg-black/50 w-screen h-screen flex justify-center items-center top-0 left-0">
      <div className="flex-col gap-4 w-full flex items-center justify-center">
        <h1 className="font-montserrat font-bold text-2xl text-primary-binus absolute animate-pulse">
          <span className="bg-primary-binus text-white px-2 rounded-md mr-1">
            Git
          </span>
          Bee
        </h1>
        <div className="w-36 h-36 border-8 text-primary-orange text-4xl animate-spin border-gray-300 flex items-center justify-center border-t-primary-orange rounded-full"></div>
      </div>
    </div>
  );
};

export default Loading;
