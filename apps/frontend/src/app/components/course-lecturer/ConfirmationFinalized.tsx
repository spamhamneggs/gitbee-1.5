import React from "react";

interface ConfirmationFinalzedProps {
  setShowConfirmationFinalized: (value: boolean) => void;
  ratings: any;
  groupsClassData: any;
  handleFinalize: any;
}

const ConfirmationFinalized = (props: ConfirmationFinalzedProps) => {
  return (
    <div
      className="fixed w-full h-full top-0 left-0 bg-black/50 flex justify-center items-center z-50"
      onClick={() => props.setShowConfirmationFinalized(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-50 border rounded-md min-w-96 w-[50rem] max-w-[80vw] h-auto max-h-[85vh] flex flex-col px-10 py-7 gap-5 overflow-y-auto"
      >
        <h1 className="text-5xl">Are you sure you want to finalized?</h1>
        <ul>
          {props.groupsClassData?.updatedProjects.map(
            (groupDetail: any, index: number) => (
              <li
                key={groupDetail?.projectDetail?.group}
                className="border-b-2 w-full"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-lg">
                    Group {groupDetail?.projectDetail?.group} -{" "}
                    {groupDetail?.projectDetail?.title}
                  </h3>
                  <h3 className="text-lg">
                    Rating{" "}
                    <span className="text-primary-orange">
                      {props.ratings[index]}
                    </span>{" "}
                    of 5
                  </h3>
                </div>
              </li>
            )
          )}
        </ul>
        <div className="text-xl">
          {props.ratings.some((rating: any) => rating > 3) ? (
            <div>
              There are{" "}
              <span className="text-primary-orange">
                {props.ratings.filter((rating: any) => rating > 3).length}
              </span>{" "}
              Outstanding Project. Are You Sure?
            </div>
          ) : (
            <div>
              There are no group that's above{" "}
              <span className="text-primary-orange">3 stars</span>.{" "}
              <span className="underline">Are You Sure?</span>
            </div>
          )}
        </div>
        <button
          type="submit"
          onClick={props.handleFinalize}
          className="bg-purple-600 text-white px-2 py-2 rounded-md"
        >
          Finalized
        </button>
      </div>
    </div>
  );
};

export default ConfirmationFinalized;
