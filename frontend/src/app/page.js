import React from "react";
import Auth from "./Shared/Auth";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-60px)] w-full flex items-center justify-center bg-[#F8FAFC] p-4">
      <Auth />
    </div>
  );
}
