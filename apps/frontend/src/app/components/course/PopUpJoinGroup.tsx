"use client";
import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createGroup } from "@/app/(pages)/(student)/course/actions";

interface PopUpJoinGroupProps {
  listStudent: any[];
  fetchData: any;
  toast: (options: {
    title: string;
    description: string;
    variant?: "default" | "destructive" | null;
  }) => void;
  userId?: string | undefined;
  setCurrentStep: (value: number) => void;
  setLoading: (value: boolean) => void;
  course_code: string;
  semester_id: string;
  class_id: string;
} 

function PopUpJoinGroup(props: PopUpJoinGroupProps) {
  const [totalMember, setTotalMember] = useState(2);
  const [openStates, setOpenStates] = useState<boolean[]>([false]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([
    props.userId || "",
  ]);
  const [isAgreementChecked, setIsAgreementChecked] = useState(false);

  const handleSelect = (index: number, value: string) => {
    const newSelection = [...selectedStudents];
    newSelection[index] = value;
    setSelectedStudents(newSelection);
  };

  const togglePopover = (index: number, isOpen: boolean) => {
    const updatedOpenStates = [...openStates];
    updatedOpenStates[index] = isOpen;
    setOpenStates(updatedOpenStates);
  };

  const addMember = () => {
    setTotalMember(totalMember + 1);
    setOpenStates([...openStates, false]);
    setSelectedStudents([...selectedStudents, ""]);
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsAgreementChecked(event.target.checked);
  };

  const handleCreate = async () => {
    if (!isAgreementChecked) {
      props.toast({
        title: "Agreement Required",
        description: "You must agree to the terms before creating the group.",
      });
      return;
    }

    props.setLoading(true);
    const result = await createGroup({
      semester_id: props.semester_id,
      course_id: props.course_code,
      student_ids: selectedStudents,
      class_id: props.class_id,
    });
    if (result?.success) {
      props.toast({
        title: "Successfully created.",
        description: `Your Group has been successfully created`,
      });
    } else {
      props.toast({
        title: "Oops! Something went wrong!",
        description: `Your Group hasn't been successfully created. You can try again later`,
      });
    }
    props.fetchData();
    props.setLoading(false);
    props.setCurrentStep(2);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-gray-50 border-x border-b min-w-96 w-full max-w-[80vw] rounded-b-md h-auto max-h-[calc(80vh-8rem)] flex flex-col px-10 pt-3 pb-7 gap-5 overflow-y-auto"
    >
      <div className="w-full flex justify-between items-center">
        <div className="text-center py-3 rounded-md text-xl">
          Group Class B012
        </div>
        <div
          className="text-end text-primary-orange cursor-pointer"
          onClick={addMember}
        >
          + Add member
        </div>
      </div>
      <div className="w-full h-fit flex flex-col gap-5">
        {Array.from({ length: totalMember }).map((_, i) => (
          <Popover
            // eslint-disable-next-line @eslint-react/no-array-index-key -- member slots have no stable id; position is their identity and sibling state (openStates, togglePopover, selectedStudents) is indexed the same way
            key={i}
            open={openStates[i] ?? false}
            onOpenChange={(isOpen) => togglePopover(i, isOpen)}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openStates[i]}
                className="w-full justify-between"
                disabled={i === 0}
              >
                {selectedStudents[i]
                  ? `${
                    props.listStudent?.find(
                        (student) => student.student_id === selectedStudents[i]
                      )?.student_id
                    } - ${
                      props.listStudent?.find(
                        (student) => student.student_id === selectedStudents[i]
                      )?.student_name
                    }`
                  : "Select student..."}

                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="min-w-96 w-[50rem] max-w-[80vw] p-0">
              <Command>
                <CommandInput placeholder="Search student..." />
                <CommandList>
                  <CommandEmpty>No student found.</CommandEmpty>
                  <CommandGroup>
                    {props.listStudent.map((student) => (
                      <CommandItem
                        key={student.student_id}
                        value={student.student_id}
                        onSelect={(currentValue: string) => {
                          handleSelect(
                            i,
                            currentValue === selectedStudents[i]
                              ? ""
                              : currentValue
                          );
                          togglePopover(i, false);
                        }}
                        disabled={
                          selectedStudents.includes(student?.student_id) || 
                          student.is_disable === 1
                        }
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedStudents[i] === student.student_id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {student.student_id} - {student.student_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ))}
      </div>
      <div className="px-1 cursor-pointer flex justify-start items-center gap-2">
        <input
          type="checkbox"
          name="agreement"
          id="agreement"
          value="Agree"
          checked={isAgreementChecked}
          onChange={handleCheckboxChange}
        />
        <label htmlFor="agreement" className="cursor-pointer">
          I acknowledge that I am responsible for moderating the group and
          ensuring discussions remain respectful and lawful.
        </label>
      </div>
      <div
        className="bg-primary-binus w-full text-white text-center py-2 rounded-md text-xl cursor-pointer"
        onClick={handleCreate}
      >
        Create Group
      </div>
    </div>
  );
}

export default PopUpJoinGroup;
