import React, { useState, useEffect } from "react";
import { MapPin, Clock, Star, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import instance, { API_URL } from "../api/axios";
import { getTopForwarders } from "../api/cms";

const TopForwarders = () => {
    const navigate = useNavigate();
    const [forwarders, setForwarders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchForwarders = async () => {
            try {
                const response = await getTopForwarders();
                console.log("response=-------getTopForwarders---->>>", response);
                if (response.status === 200 || response.status === "200") {
                    setForwarders((response.body || []).slice(0, 3)); // Only show top 3 on homepage
                }
            } catch (error) {
                console.error("Error fetching forwarders:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchForwarders();
    }, []);

    return (
        <section className="bg-[#162121] py-16 px-6">
            <div className="max-w-6xl mx-auto">
                {/* Header row */}
                <div className="flex items-start justify-between mb-10 gap-4 flex-wrap">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-white">
                            Top Forwarders
                        </h2>
                        <p className="text-white/40 text-[14px] mt-1">
                            Trusted by hundreds of shippers
                        </p>
                    </div>
                    <button
                        onClick={() => navigate("/forwarders")}
                        className="flex items-center gap-2 border border-white/20 text-white rounded-full px-5 py-2 text-[14px] hover:bg-white/5 transition whitespace-nowrap"
                    >
                        View All <ArrowRight size={15} />
                    </button>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {loading ? (
                        [1, 2, 3].map((_, i) => (
                            <div key={i} className="bg-[#162120] border border-white/5 rounded-2xl p-5 h-[200px] animate-pulse" />
                        ))
                    ) : forwarders.length > 0 ? (
                        forwarders.map((f, i) => (
                            <div
                                key={f.id || i}
                                className="bg-[#162120] border border-white/5 rounded-2xl p-5 flex flex-col gap-4 hover:border-white/15 transition"
                            >
                                {/* Top row: avatar + rating */}
                                <div className="flex items-center justify-between">
                                    {/* {f.image ? (
                                        <img
                                            src={f.image.startsWith("http") ? f.image : `${API_URL}/${f.image}`}
                                            alt={f.businessInfo?.businessName || f.firstName}
                                            className="w-10 h-10 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-[#FFBF00]/20 flex items-center justify-center text-[#FFBF00] font-bold text-[16px]">
                                            {(f.businessInfo?.businessName?.[0] || f.firstName?.[0] || "?").toUpperCase()}
                                        </div>
                                    )} */}

                                    <div className="w-10 h-10 rounded-lg bg-[#FFBF00]/20 flex items-center justify-center text-[#FFBF00] font-bold text-[16px]">
                                        {(f.businessInfo?.businessName?.[0] || f.firstName?.[0] || "?").toUpperCase()}
                                    </div>
                                    <div className="flex items-center gap-1 text-[#FFBF00] text-[13px] font-medium">
                                        <Star size={13} fill="#FFBF00" strokeWidth={0} />
                                        {Number(f.avg_rating).toFixed(1)}
                                    </div>
                                </div>

                                {/* Name */}
                                <h3 className="text-white font-semibold text-[16px] leading-snug">
                                    {f.businessInfo?.businessName || `${f.firstName} ${f.lastName}`}
                                </h3>

                                {/* Route */}
                                <div className="flex items-center gap-1 text-white/40 text-[12px]">
                                    <MapPin size={12} className="flex-shrink-0" />
                                    {f.businessInfo?.originCountry} → {f.businessInfo?.destinationCountry}
                                </div>

                                {/* Price + Days */}
                                <div className="flex items-center justify-between mt-auto pt-2">
                                    {/* <span className="text-[#FFBF00] font-bold text-[20px]">
                                        ${f.businessInfo?.basePrice}
                                        <span className="text-white/40 text-[12px] font-normal ml-1">
                                            /barrel
                                        </span>
                                    </span> */}
                                    <div className="flex items-center gap-1 text-white/40 text-[12px]">
                                        <Clock size={12} />
                                        {f.businessInfo?.transitTime}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-10 text-center text-white/40">
                            No forwarders found.
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default TopForwarders;
