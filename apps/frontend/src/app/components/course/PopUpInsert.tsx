"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CiCircleQuestion } from "react-icons/ci";
import { TiTick } from "react-icons/ti";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getStudentDataInClass,
  insertProject,
} from "@/app/(pages)/(student)/course/actions";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { IoIosArrowRoundBack, IoIosVideocam } from "react-icons/io";
import { SiGithub } from "react-icons/si";
import { BsGlobe2 } from "react-icons/bs";
import { useAuth } from "@/app/context/AuthContext";
import { IoArrowBack } from "react-icons/io5";
import PopUpJoinGroup from "./PopUpJoinGroup";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { off } from "process";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface PopUpInsertProps {
  fetchData: any;
  groupMembers: any;
  group: number;
  setShowInsertForm: (value: boolean) => void;
  toast: (options: {
    title: string;
    description: string;
    variant?: "default" | "destructive" | null;
  }) => void;
  categories: any;
  technologies: any;
  userId?: string | undefined;
  course_code: string;
  semester_id: string;
  class_id: string;
  lecturer_id: string;
}

function PopUpInsert(props: PopUpInsertProps) {
  const steps = [
    "Create Group",
    "Preview Group",
    "Insert Project",
    "Preview Project",
  ];
  const [currentStep, setCurrentStep] = useState(1);
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [githubLink, setGithubLink] = useState("");
  const [projectLink, setProjectLink] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [thumbnail, setThumbnail] = useState<File | undefined>(undefined);
  const thumbnailUrl = useMemo(
    () => (thumbnail ? URL.createObjectURL(thumbnail) : undefined),
    [thumbnail]
  );
  useEffect(() => {
    if (!thumbnailUrl) return;
    return () => URL.revokeObjectURL(thumbnailUrl);
  }, [thumbnailUrl]);
  const [documentation, setDocumentation] = useState<File | undefined>(
    undefined
  );
  const [pdfUrl, setPdfUrl] = useState<string | undefined>(undefined);
  const [gallery, setGallery] = useState<File[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>(
    []
  );
  const [dropdownsTechno, setDropdownsTechno] = useState<number[]>([0]);
  const [openStatesTechno, setOpenStatesTechno] = useState<boolean[]>([false]);
  const [majorId, setMajorId] = useState(0);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [listStudent, setListStudent] = useState();

  const [prevGroupMembers, setPrevGroupMembers] = useState(props.groupMembers);
  if (props.groupMembers !== prevGroupMembers) {
    setPrevGroupMembers(props.groupMembers);
    console.log(props.groupMembers.length);
    if (props.groupMembers?.length > 0) {
      setCurrentStep(2);
    }
  }

  /* eslint-disable react-you-might-not-need-an-effect/no-derived-state -- server fetch: the result depends on an async round-trip and cannot be computed during render */
  useEffect(() => {
    const fetchStudentList = async () => {
      const resultStudentList = await getStudentDataInClass(
        props.semester_id,
        props.course_code,
        props.class_id
      );
      console.log(resultStudentList);
      setListStudent(resultStudentList?.data);
    };
    fetchStudentList();
  }, [props.semester_id, props.course_code, props.class_id]);
  /* eslint-enable react-you-might-not-need-an-effect/no-derived-state */

  const isValidUrl = (urlString: string) => {
    var urlPattern = new RegExp(
      "^(https?:\\/\\/)?" +
        "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" +
        "((\\d{1,3}\\.){3}\\d{1,3}))" +
        "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" +
        "(\\?[;&a-z\\d%_.~+=-]*)?" +
        "(\\#[-a-z\\d_]*)?$",
      "i"
    );
    return !!urlPattern.test(urlString);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 1 } },
  };

  const MAX_FILE_SIZE = 500 * 1024;
  const isFileUnderMaxSize = (file: File | undefined): boolean => {
    return !!file && file.size <= MAX_FILE_SIZE;
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!title) errors.title = "Project name is required";
    else if (title.length < 5)
      errors.title = "Project name length must be at least 5 characters";

    if (!description) errors.description = "Project description is required";
    else if (description.length < 100)
      errors.description =
        "Project description length must be at least 100 characters";

    if (!githubLink) errors.githubLink = "GitHub link is required";
    else if (!isValidUrl(githubLink))
      errors.githubLink = "GitHub link is format is incorrect";

    if (!projectLink) errors.projectLink = "Project link is required";
    else if (!isValidUrl(projectLink))
      errors.projectLink = "Project link is format is incorrect";

    if (!thumbnail) errors.thumbnail = "Project cover is required";

    if (!isFileUnderMaxSize(thumbnail))
      errors.thumbnail = "Thumbnail exceeds the maximum size of 500KB.";

    if (gallery.length === 0)
      errors.gallery = "At least one gallery image is required";

    const invalidGalleryFiles = gallery.filter(
      (file) => !isFileUnderMaxSize(file)
    );
    if (invalidGalleryFiles.length > 0) {
      errors.gallery =
        "One or more gallery files exceed the maximum size of 500KB.";
    }

    if (!documentation)
      errors.documentation = "Project documentation is required";
    else if (!isFileUnderMaxSize(documentation))
      errors.documentation = "Documentation exceeds the maximum size of 500KB.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const addDropdown = () => {
    const newIndex = dropdownsTechno.length;
    setDropdownsTechno([...dropdownsTechno, newIndex]);
    setSelectedTechnologies([...selectedTechnologies, ""]);
    setOpenStatesTechno([...openStatesTechno, false]);
  };

  const handleSelect = (index: number, id: string) => {
    const updatedTechnologies = [...selectedTechnologies];
    updatedTechnologies[index] = id;
    setSelectedTechnologies(updatedTechnologies);
  };

  const togglePopover = (index: number, isOpen: boolean) => {
    const updatedOpenStatesTechno = [...openStatesTechno];
    updatedOpenStatesTechno[index] = isOpen;
    setOpenStatesTechno(updatedOpenStatesTechno);
  };

  const handleSubmit = async () => {
    if (validateForm()) setCurrentStep(4);
    const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });
    };
    const documentationBase64 = documentation
      ? await fileToBase64(documentation)
      : "";

    setPdfUrl(documentationBase64);
  };

  const handleFinalized = async () => {
    setLoading(true);
    const studentLeaderId = userData?.nim ? userData?.nim : "";
    const groupMembersId = props.groupMembers.map(
      (member: any) => member.student_id
    );
    const result = await insertProject({
      lecturerId: props.lecturer_id ? props.lecturer_id : "",
      studentLeaderId,
      title,
      description,
      semesterId: props.semester_id,
      courseId: props.course_code,
      className: props.class_id,
      githubLink,
      projectLink,
      videoLink,
      thumbnail,
      documentation,
      gallery,
      categoryId,
      selectedTechnologies,
      majorId,
      groupMembersId,
      group: props.groupMembers[0]?.group
        ? props.groupMembers[0]?.group
        : props.group,
    });
    if (result?.success) {
      props.toast({
        title: "Your Project has been successfully submitted.",
        description: `${title} has been successfully submitted`,
      });
    } else {
      props.toast({
        title: "Oops! Something went wrong!",
        description: `${title} hasn't successfully submitted. You can try again later`,
      });
    }
    props.fetchData();
    setLoading(false);
    props.setShowInsertForm(false);
  };

  return (
    <div
      className="fixed w-full h-full top-0 left-0 bg-black/50 flex flex-col justify-center items-center z-50"
      onClick={() => props.setShowInsertForm(false)}
    >
      <div
        className="bg-gray-50 border-x border-t rounded-t-md min-w-96 w-full max-w-[80vw] h-32 flex flex-col px-10 pt-7 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex gap-5">
          {steps?.map((step, i) => (
            <div
              key={step}
              className={`w-full flex flex-col ${
                currentStep >= i + 1 && i !== 0
                  ? "cursor-pointer"
                  : "cursor-not-allowed"
              }`}
              onClick={() => {
                currentStep >= i + 1 && i !== 0 ? setCurrentStep(i + 1) : null;
              }}
            >
              <div
                className={`w-full h-2 bg-gray-300 relative rounded-md overflow-hidden after:absolute after:bg-primary-binus after:h-full after:transition-all after:duration-700 after:ease-in-out transition-all duration-700 ease-in-out ${
                  currentStep >= i + 1 ? "after:w-full" : "after:w-0"
                } `}
              ></div>
              <span
                className={` mt-3 ${
                  currentStep >= i + 1 ? "text-primary-binus" : "text-gray-500"
                }`}
              >
                Step {i + 1}
              </span>
              <span className="text-black">{step}</span>
            </div>
          ))}
        </div>
        <div className="w-full h-px bg-gray-200 mt-7"></div>
      </div>
      {currentStep === 1 && !loading && (
        <PopUpJoinGroup
          listStudent={listStudent ? listStudent : []}
          setLoading={setLoading}
          fetchData={props.fetchData}
          toast={props.toast}
          userId={userData?.nim}
          setCurrentStep={setCurrentStep}
          course_code={props.course_code}
          semester_id={props.semester_id}
          class_id={props.class_id}
        />
      )}
      {currentStep === 2 && !loading && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-50 border-x border-b min-w-96 w-full max-w-[80vw] rounded-b-md h-auto max-h-[calc(80vh-8rem)] flex flex-col px-10 pt-3 pb-7 gap-5 overflow-y-auto"
        >
          <h1 className="text-xl">Group Forming</h1>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35px]">NO</TableHead>
                <TableHead className="w-32">NIM</TableHead>
                <TableHead className="w-96">NAME</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.groupMembers.map((row: any, index: number) => (
                <TableRow key={row?.student_id}>
                  <TableCell className="font-medium text-center">
                    {index + 1}
                  </TableCell>
                  <TableCell className="w-32">{row?.student_id}</TableCell>
                  <TableCell className="w-96 truncate">
                    {row?.student_name}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div
            className="bg-primary-binus w-full text-white text-center py-2 rounded-md text-xl cursor-pointer"
            onClick={() => setCurrentStep(3)}
          >
            Next
          </div>
        </div>
      )}
      {currentStep === 3 && !loading && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-50 border-x border-b rounded-b-md min-w-96 w-full max-w-[80vw] h-auto max-h-[calc(80vh-8rem)] flex flex-col px-10 py-7 gap-5 overflow-y-auto"
        >
          <div className="flex flex-col gap-3">
            <div className="flex justify-start items-center gap-1">
              <Label htmlFor="project_name">
                Project Name <span className="text-primary-orange">*</span>
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleQuestion className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The title of your project.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              type="text"
              placeholder="Project Name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {formErrors.title && (
              <span className="text-red-500 text-sm px-0.5">
                {formErrors.title}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-start items-center gap-1">
              <Label htmlFor="project_description">
                Project Description{" "}
                <span className="text-primary-orange">*</span>
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleQuestion className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Short summary of the project's about, purpose, goals, and
                      features.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              placeholder="Describe Your Project . . ."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {formErrors.description && (
              <span className="text-red-500 text-sm px-0.5">
                {formErrors.description}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-start items-center gap-1">
              <Label htmlFor="github_link">
                GitHub Link <span className="text-primary-orange">*</span>
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleQuestion className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      URL that directs users to your project's repository on
                      GitHub
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              type="text"
              placeholder="GitHub Link"
              value={githubLink}
              onChange={(e) => setGithubLink(e.target.value)}
            />
            {formErrors.githubLink && (
              <span className="text-red-500 text-sm px-0.5">
                {formErrors.githubLink}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-start items-center gap-1">
              <Label htmlFor="project_link">
                Project Link <span className="text-primary-orange">*</span>
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleQuestion className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      URL that directs users to your live project's or
                      <br />
                      downloadable project files
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              type="text"
              placeholder="Project Link"
              value={projectLink}
              onChange={(e) => setProjectLink(e.target.value)}
            />
            {formErrors.projectLink && (
              <span className="text-red-500 text-sm px-0.5">
                {formErrors.projectLink}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-start items-center gap-1">
              <Label htmlFor="project_link">Video Link</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleQuestion className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>URL that directs users to your video project</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              type="text"
              placeholder="Video Link (Optional)"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-start items-center gap-1">
              <Label htmlFor="cover">
                Cover <span className="text-primary-orange">*</span>
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleQuestion className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Image or visual representation that showcases the
                      project's
                      <br />
                      main theme or cover.
                      <br />
                      <span className="text-primary-orange">
                        Recommended (1 : 1) Portrait
                      </span>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div>
              <Input
                type="file"
                accept="image/jpeg, image/png"
                onChange={(event) => {
                  setThumbnail(event.target.files?.[0]);
                }}
              />
              <div className="flex flex-col gap-1">
                <span className="text-[0.7rem] text-primary-orange">
                  * 1 File Only (.jpg .jpeg .png). Max Size 500 Kb
                </span>
                {formErrors.thumbnail && (
                  <span className="text-red-500 text-sm px-0.5">
                    {formErrors.thumbnail}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-start items-center gap-1">
              <Label htmlFor="cover">
                Gallery <span className="text-primary-orange">*</span>
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleQuestion className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Collection of images, screenshots, or media related to the
                      <br />
                      project, providing visual insights into its features,
                      <br />
                      design, and functionality.
                      <br />
                      <span className="text-primary-orange">
                        Recommended (1 : 1) Portrait
                      </span>
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div>
              <Input
                type="file"
                multiple
                accept="image/jpeg, image/png"
                onChange={(event) => {
                  const selectedFiles = event.target.files
                    ? Array.from(event.target.files)
                    : [];

                  if (selectedFiles.length <= 4) {
                    setGallery(selectedFiles);
                    return;
                  }

                  if (selectedFiles.length > 4) {
                    event.target.value = "";
                    alert("You can only upload a maximum of 4 files.");
                    return;
                  }
                }}
              />
              <div className="flex flex-col">
                <span className="text-[0.7rem] text-primary-orange">
                  * Max 4 File Only (.jpg .jpeg .png). Max Size 500 Kb
                </span>
                {formErrors.gallery && (
                  <span className="text-red-500 text-sm px-0.5">
                    {formErrors.gallery}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-start items-center gap-1">
              <Label htmlFor="cover">
                Documentation <span className="text-primary-orange">*</span>
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleQuestion className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      comprehensive collection of written materials that explain
                      <br />
                      the project's structure, functionality, and usage.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(event) => {
                  setDocumentation(event.target.files?.[0]);
                  if (event.target.files?.[0]) {
                    const url = URL.createObjectURL(event.target.files?.[0]);
                    setPdfUrl(url);
                  }
                }}
              />
              <div className="flex flex-col">
                <span className="text-[0.7rem] text-primary-orange">
                  * 1 File Only (.pdf)
                </span>
                {formErrors.documentation && (
                  <span className="text-red-500 text-sm px-0.5">
                    {formErrors.documentation}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-start items-center gap-1">
              <Label htmlFor="cover">
                Category <span className="text-primary-orange">*</span>
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleQuestion className="w-4 h-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Category for your projects</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="border rounded-md">
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background border-r-8 border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {props.categories?.map((category: any) => (
                  <option key={category?.id} value={category.id}>
                    {category?.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="flex justify-start items-center gap-1">
                <Label htmlFor="cover">
                  Technology <span className="text-primary-orange">*</span>
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <CiCircleQuestion className="w-4 h-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Technology you use for your projects</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="pt-1">
                <span
                  className="text-primary-orange text-sm cursor-pointer"
                  onClick={addDropdown}
                >
                  Add Technology +
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {dropdownsTechno.map((techno) => (
                <Popover
                  key={techno}
                  open={openStatesTechno[techno] ?? false}
                  onOpenChange={(isOpen) => togglePopover(techno, isOpen)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openStatesTechno[techno]}
                      className="w-full justify-between"
                    >
                      {selectedTechnologies[techno]
                        ? props.technologies.find(
                            (tech: any) =>
                              tech.id === selectedTechnologies[techno]
                          )?.name || "Select technology"
                        : "Select technology"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="min-w-[300px] w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search technology..." />
                      <CommandList>
                        <CommandEmpty>No technologies found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem key="" value="" disabled>
                            Choose a technology
                          </CommandItem>
                          {props.technologies.map((tech: any) => (
                            <CommandItem
                              key={tech.id}
                              value={tech.id}
                              onSelect={() => {
                                handleSelect(techno, tech.id);
                                togglePopover(techno, false);
                              }}
                              disabled={selectedTechnologies.includes(tech.id)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedTechnologies[techno] === tech.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {tech.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ))}
            </div>
          </div>
          <button
            onClick={handleSubmit}
            type="submit"
            className="bg-primary-binus text-white px-2 py-1 rounded-md"
          >
            Preview
          </button>
        </div>
      )}
      {currentStep === 4 && !loading && (
        <motion.div
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-50 border-x border-b rounded-b-md min-w-96 w-full max-w-[80vw] h-auto max-h-[calc(80vh-8rem)] flex flex-col px-10 py-7 gap-5 overflow-y-auto"
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.div
            className="relative w-full pl-3 flex h-fit py-3 justify-start items-start transition-all ease-in-out duration-500"
            variants={containerVariants}
          >
            <div className="w-full flex flex-col pr-5">
              <div className="w-full flex justify-start items-start border-b pb-5">
                <div className="mx-3 flex flex-col gap-1 w-2/3">
                  <h1 className="text-3xl font-bold">
                    {title}{" "}
                    <span className="text-sm font-normal">
                      (
                      {
                        props.categories?.find(
                          (category: any) => category?.id == categoryId
                        )?.name
                      }
                      )
                    </span>
                  </h1>
                  <h3 className="text-sm text-gray-500">
                    By:{" "}
                    {props.groupMembers.map((row: any, index: number) => {
                      return (
                        <span
                          key={row?.student_id}
                          className="capitalize text-gray-500"
                        >
                          {row?.student_name.toLowerCase()}
                          {index + 1 < props.groupMembers.length ? ", " : ""}
                        </span>
                      );
                    })}
                  </h3>
                  <div className="h-fit flex-grow my-3 pr-10">
                    <h1 className="text-balance text-gray-700 overflow-auto">
                      {description}
                    </h1>
                  </div>
                  <div className="h-fit flex-grow mb-3">
                    <h1 className="text-primary-binus italic">
                      {selectedTechnologies?.map((techId, index) => {
                        const tech = props.technologies.find(
                          (t: any) => t.id === techId
                        );
                        return (
                          <span key={techId}>
                            {tech?.name || "Unknown"}
                            {index + 1 < selectedTechnologies.length
                              ? ", "
                              : ""}
                          </span>
                        );
                      })}
                    </h1>
                  </div>
                  <Link
                    href={githubLink}
                    className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                  >
                    <SiGithub fill="#EB9327" />
                    {githubLink}
                  </Link>
                  <Link
                    href={projectLink}
                    className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                  >
                    <BsGlobe2 fill="#EB9327" /> {projectLink}
                  </Link>
                  {videoLink && videoLink != "" && (
                    <Link
                      href={videoLink}
                      className="flex justify-start items-center gap-2 text-sm my-1 text-primary-binus"
                    >
                      <IoIosVideocam fill="#EB9327" />{" "}
                      {videoLink}
                    </Link>
                  )}
                </div>
                <div className="w-1/3">
                  {thumbnailUrl ? (
                    <Image
                      src={thumbnailUrl}
                      width={960}
                      height={384}
                      alt="Thumbnail preview"
                      className="w-full rounded-md border h-96 object-cover"
                    />
                  ) : null}
                </div>
              </div>
              <div className="w-full h-96 my-3 flex overflow-auto gap-3">
                {gallery.map((file, index) => (
                  <Image
                    key={file.name}
                    src={URL.createObjectURL(file)}
                    width={576}
                    height={384}
                    alt={`Gallery Image ${index + 1}`}
                    className="w-full rounded-md border h-full object-cover"
                  />
                ))}
              </div>
              <h1 className="mt-10">
                {documentation?.name} ~ {documentation?.size}
              </h1>
              <iframe src={pdfUrl} className="w-full h-96" />
            </div>
          </motion.div>
          <button
            onClick={handleFinalized}
            type="submit"
            className="w-full bg-purple-600 text-white py-2 rounded-md"
          >
            Submit
          </button>
        </motion.div>
      )}
      {loading && (
        <div className="bg-gray-50 border-x border-b rounded-b-md min-w-96 w-full max-w-[80vw] h-auto max-h-[calc(80vh-8rem)] flex flex-col px-10 py-7 gap-5 overflow-y-auto justify-center items-center">
          <div className="w-36 h-36 border-8 text-primary-orange text-4xl animate-spin border-gray-300 flex items-center justify-center border-t-primary-orange rounded-full"></div>
        </div>
      )}
    </div>
  );
}

export default PopUpInsert;
