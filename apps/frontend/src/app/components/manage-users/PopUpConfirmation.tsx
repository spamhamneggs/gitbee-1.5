import {
  getAllMajor,
  updateUserRole,
} from "@/app/(pages)/(admin)/manage-users/actions";
import React, { useEffect, useState } from "react";

interface PopUpConfirmationProps {
  setOpenPopUpConfirmation: (value: boolean) => void;
  handleDeleteAllLecturer: any;
}

function PopUpConfirmation(props: PopUpConfirmationProps) {
  return (
    <div
      className="fixed bg-black/50 w-full h-screen top-0 left-0 z-50 flex justify-center items-center py-10 px-20"
      onClick={() => props.setOpenPopUpConfirmation(false)}
    >
      <div
        className="bg-white w-full max-h-full h-fit overflow-y-auto rounded-md p-10 flex flex-col max-w-[30rem] gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="block text-2xl font-medium " htmlFor="name">
          Are you sure you want to{" "}
          <span className="text-primary-orange">delete all</span> the lecturers
          ?
        </label>
        <button
          onClick={props.handleDeleteAllLecturer}
          className="mt-4 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
export default PopUpConfirmation;
