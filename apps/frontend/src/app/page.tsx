"use client";
import { useState } from "react";
import Loader from "./components/Loader";
import { Hero } from "./components/home/Hero";
import Card from "./components/Card";
import Project from "./components/home/Project";

export default function Home() {
  const [loading, setLoading] = useState(false);

  if (loading) {
    return <Loader />;
  }

  return (
    <div>
      <Hero />
      <Project />
    </div>
  );
}
