import {
  getAllMajor,
  updateUserRole,
} from "@/app/(pages)/(admin)/manage-users/actions";
import React, { useEffect, useState } from "react";

interface PopUpUsersProps {
  setOpenPopUpUsers: (value: boolean) => void;
  selectedUserToUpdate: any;
  fetchData: any;
}

function PopUpUsers(props: PopUpUsersProps) {
  const [role, setRole] = useState<string>(
    props.selectedUserToUpdate?.role || "Lecturer"
  );
  const [selectedMajors, setSelectedMajors] = useState<number[]>(
    props.selectedUserToUpdate?.hop_major?.map((major: any) => major.id) || []
  );
  const [majors, setMajors] = useState<{ id: number; name: string }[]>([]);

  /* eslint-disable react-you-might-not-need-an-effect/no-initialize-state -- server fetch: majors can only be populated asynchronously after mount */
  useEffect(() => {
    const fetchMajors = async () => {
      try {
        const result = await getAllMajor();
        setMajors(result?.data);
      } catch (error) {
        console.error("Failed to fetch majors:", error);
      }
    };
    fetchMajors();
  }, []);
  /* eslint-enable react-you-might-not-need-an-effect/no-initialize-state */

  const handleMajorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setSelectedMajors((prev) =>
      prev.includes(value)
        ? prev.filter((majorId) => majorId !== value)
        : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (!props.selectedUserToUpdate?.id) {
      console.error("User ID is required to update");
      return;
    }

    try {
      if (role == "HoP" && selectedMajors.length < 1) return;
      const resultUpdate = await updateUserRole(
        props.selectedUserToUpdate.id.toString(),
        role,
        role === "HoP"
          ? selectedMajors.map((major) => major.toString())
          : undefined
      );
      props.fetchData();
      props.setOpenPopUpUsers(false);
      console.log("Update Result:", resultUpdate);
    } catch (error) {
      console.error("Failed to update user role:", error);
    }
  };



  return (
    <div
      className="fixed bg-black/50 w-full h-screen top-0 left-0 z-50 flex justify-center items-center py-10 px-20"
      onClick={() => props.setOpenPopUpUsers(false)}
    >
      <div
        className="bg-white w-full max-h-full h-fit overflow-y-auto rounded-md p-10 flex flex-col max-w-[30rem] gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col justify-start items-start">
          <label
            className="block mb-2 text-sm font-medium text-gray-900"
            htmlFor="name"
          >
            Name:
          </label>
          <input
            className="block w-full text-lg border-b cursor-not-allowed"
            id="name"
            value={props.selectedUserToUpdate?.name}
            readOnly
            type="text"
          />
        </div>

        <div className="flex flex-col justify-start items-start">
          <label
            className="block mb-2 text-sm font-medium text-gray-900"
            htmlFor="role"
          >
            Role:
          </label>
          <select
            id="role"
            className="block w-full text-lg border-b"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="Lecturer">Lecturer</option>
            <option value="SCC">SCC</option>
            <option value="HoP">HOP</option>
            <option value="Admin">Admin</option>
          </select>
        </div>

        {role === "HoP" && (
          <div className="flex flex-col justify-start items-start">
            <label
              className="block mb-2 text-sm font-medium text-gray-900"
              htmlFor="major"
            >
              Major:
            </label>
            <div className="flex flex-col gap-2">
              {majors.map((major) => (
                <div key={major.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`major-${major.id}`}
                    value={major.id}
                    checked={selectedMajors.includes(major.id)}
                    onChange={handleMajorChange}
                  />
                  <label htmlFor={`major-${major.id}`} className="text-lg">
                    {major.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          className="mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          Save
        </button>
      </div>
    </div>
  );
}
export default PopUpUsers;
