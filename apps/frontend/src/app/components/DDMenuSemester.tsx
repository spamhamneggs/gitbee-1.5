"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DDMenuSemesterProps = {
  filter: string;
  options: any;
  icon: React.ReactElement;
  className?: string;
  currentSemester: any;
  setCurrentSemester: any;
};

const DDMenuSemester: React.FC<DDMenuSemesterProps> = ({
  filter,
  options,
  icon,
  className,
  currentSemester,
  setCurrentSemester,
}) => {
  const [position, setPosition] = React.useState("");

  const [prevSemester, setPrevSemester] = React.useState(currentSemester);
  if (currentSemester !== prevSemester) {
    setPrevSemester(currentSemester);
    setPosition(currentSemester?.data?.Description);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`h-full flex justify-between items-center gap-3 sm:py-3 ${
            className == null ? null : className
          }`}
        >
          <div className="pr-2 border-r h-full flex justify-center items-center">
            {icon}
          </div>
          <div className="truncate text-primary-binus hover:text-primary-orange font-poppins font-normal text-xs sm:text-base">
            {position}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <DropdownMenuRadioGroup
          value={position}
          onValueChange={(newValue) => {
            setPosition(newValue);
            const selectedOption = options?.data?.find(
              (option: any) => option.Description === newValue
            );
            if (selectedOption) {
              setCurrentSemester({
                data: {
                  SemesterId: selectedOption?.SemesterID,
                  Description: selectedOption?.Description,
                },
              });
            }
          }}
        >
          {options?.data?.map((option: any) => (
            <DropdownMenuRadioItem
              key={option?.SemesterId ?? option?.Description}
              value={option.Description}
            >
              {option.Description}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DDMenuSemester;
