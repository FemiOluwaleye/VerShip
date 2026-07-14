import React from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";

const NotFound = () => {
  return (
    <div className="bg-[linear-gradient(180deg,#2C4736_0%,#09120F_100%)] min-h-screen flex items-center justify-center px-4">
      <Seo title="Page not found" noindex />
      <main className="text-center text-white/90 py-20">
        <p className="text-[64px] md:text-[96px] font-bold leading-none">404</p>
        <h1 className="text-[22px] md:text-[28px] font-semibold mt-2">Page not found</h1>
        <p className="text-white/70 mt-3 max-w-md mx-auto">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <Link
          to="/"
          className="inline-block mt-8 px-6 py-3 rounded-xl bg-[#0D4D4D] hover:bg-[#0A3D3D] transition-colors font-semibold"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
};

export default NotFound;
