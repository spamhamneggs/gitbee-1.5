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

type DDMenuCoursesProps = {
  filter: string;
  options: { course_code: string; course_name: string }[];
  setSelectedValue: (value: string) => void;
  icon: React.ReactElement<{ className?: string }>;
};

const DDMenuCourses: React.FC<DDMenuCoursesProps> = ({
  filter,
  options,
  icon,
  setSelectedValue,
}) => {
  const [position, setPosition] = React.useState("");

  const handleValueChange = (value: string) => {
    setPosition(value);
    setSelectedValue(value.toString());
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-full w-full sm:max-w-80 flex justify-start items-center gap-3 sm:py-3 group"
        >
          <div className="pr-2 border-r h-full flex justify-center items-center">
            {React.cloneElement(icon, {
              className:
                "w-4 h-4 group-hover:stroke-primary-orange group-hover:fill-primary-orange group-hover:border-primary-orange",
            })}
          </div>
          <div className="truncate text-primary-binus group-hover:text-primary-orange font-poppins font-normal">
            {options.find((option) => option.course_code === position)?.course_name ||
              filter}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full min-w-80">
        <DropdownMenuRadioGroup
          value={position}
          onValueChange={handleValueChange}
        >
          <DropdownMenuRadioItem key={0} value="">
            {filter}
          </DropdownMenuRadioItem>
          {options.map((option, index) => (
            <DropdownMenuRadioItem key={index} value={option.course_code.toString()}>
              {option.course_name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DDMenuCourses;
