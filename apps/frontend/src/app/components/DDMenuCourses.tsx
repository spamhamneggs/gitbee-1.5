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
            <span className="[&>svg]:w-4 [&>svg]:h-4 group-hover:[&>svg]:stroke-primary-orange group-hover:[&>svg]:fill-primary-orange group-hover:[&>svg]:border-primary-orange">
              {icon}
            </span>
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
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.course_code}
              value={option.course_code.toString()}
            >
              {option.course_name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DDMenuCourses;
