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

type DDMenuProps = {
  filter: string;
  options: { id: number; name: string }[];
  setSelectedValue: (value: string) => void;
  icon: React.ReactElement<{ className?: string }>;
  className?: string;
};

const DDMenu: React.FC<DDMenuProps> = ({
  filter,
  options,
  icon,
  className,
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
          className={`h-fit sm:h-full w-full sm:w-44 flex justify-between text-xs sm:text-base items-center gap-3 py-3 group ${
            className == null ? null : className
          }`}
        >
          <div className="pr-2 border-r h-full flex justify-center items-center">
            {React.cloneElement(icon, {
              className:
                "w-4 h-4 group-hover:stroke-primary-orange group-hover:fill-primary-orange group-hover:border-primary-orange",
            })}
          </div>
          <div className="truncate text-primary-binus group-hover:text-primary-orange font-poppins font-normal text-xs sm:text-base">
            {options.find((option) => option.id === Number(position))?.name ||
              filter}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44">
        <DropdownMenuRadioGroup
          value={position}
          onValueChange={handleValueChange}
        >
          <DropdownMenuRadioItem key={0} value="">
            {filter}
          </DropdownMenuRadioItem>
          {options.map((option, index) => (
            <DropdownMenuRadioItem key={index} value={option.id.toString()}>
              {option.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DDMenu;
