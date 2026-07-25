import React, { useEffect, useState } from "react";
import Commonbanner from "../components/Commonbanner";
import { getAboutUs } from "../api/cms";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import Seo from "../components/Seo";

const About = () => {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const data = await getAboutUs();
        if (data && data.body) {
          setContent(data.body.content);
        }
      } catch (error) {
        console.error("Failed to fetch about us:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, []);
  return (
    <div className="bg-[linear-gradient(180deg,#2C4736_0%,#09120F_100%)] min-h-screen">
      <Seo title="About Us" path="/about" description="Learn how VerShip connects you with verified freight forwarders to ship barrels from the USA to Jamaica — instant quotes, transparent pricing, and door-to-door delivery." />
      <Commonbanner title="About Us" />
      <div className="container mx-auto flex flex-col items-center justify-center gap-5 text-white/80 px-4">
        {/* Brand story video — vertical cut. Muted autoplay + loop so it plays
            on load (incl. mobile); controls let visitors unmute. The file is
            served same-origin from /videos (website/public → dist). */}
        <div className="w-full flex justify-center pt-10 lg:pt-16">
          <div className="w-full max-w-[320px] sm:max-w-[360px]">
            <div className="relative rounded-[24px] overflow-hidden border border-[#C1A35E]/40 shadow-2xl bg-black aspect-[9/16]">
              <video
                className="w-full h-full object-cover"
                poster="/videos/vership-video-2-vertical-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                controls
                preload="metadata"
              >
                {/* MP4/H.264 — universally supported (Safari, iOS, and every
                    modern desktop/mobile browser). */}
                <source src="/videos/vership-video-2-vertical.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
        <div className="w-full py-10 lg:py-20">
          {loading ? (
            <p className="text-center">Loading...</p>
          ) : (
            <div
              className="text-[16px] lg:text-[18px] font-normal leading-relaxed cms-content"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default About;
