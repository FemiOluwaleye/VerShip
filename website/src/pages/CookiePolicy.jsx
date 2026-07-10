import React, { useEffect, useState } from "react";
import Commonbanner from "../components/Commonbanner";
import { getCookiePolicy } from "../api/cms";

const CookiePolicy = () => {
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const data = await getCookiePolicy();
                if (data && data.body) {
                    setContent(data.body.content);
                }
            } catch (error) {
                console.error("Failed to fetch cookie policy:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, []);

    return (
        <div className="bg-[linear-gradient(180deg,#2C4736_0%,#09120F_100%)] min-h-screen">
            <Commonbanner title="Cookie Policy" />
            <div className="container mx-auto flex flex-col items-start justify-center gap-5 text-white/80">
                <div className="w-full py-10 lg:py-20">
                    {loading ? (
                        <p className="text-center">Loading...</p>
                    ) : (
                        <div
                            className="text-[16px] lg:text-[18px] font-normal leading-relaxed cms-content"
                            dangerouslySetInnerHTML={{ __html: content }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default CookiePolicy;
