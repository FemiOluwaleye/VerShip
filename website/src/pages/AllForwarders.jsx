import React, { useState, useEffect } from "react";
import { MapPin, Clock, Star, Package, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getTopForwarders } from "../api/cms";
import { API_URL } from "../api/axios";
import { headlinePrice } from "../utils/pricing";

const AllForwarders = () => {
    const navigate = useNavigate();
    const [forwarders, setForwarders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchForwarders = async () => {
            try {
                const response = await getTopForwarders();
                if (response.status === 200 || response.status === "200") {
                    setForwarders(response.body || []);
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
        <div className="min-h-screen bg-[#0E1614] text-white">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
                {/* Page Header */}
                <div className="mb-10">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                        All Forwarders
                    </h1>
                    <p className="text-white/40 text-[15px]">
                        Browse verified freight forwarders shipping to Jamaica
                    </p>
                </div>

                {/* Forwarder List */}
                <div className="flex flex-col gap-4">
                    {loading ? (
                        [1, 2, 3, 4].map((_, i) => (
                            <div key={i} className="bg-[#162120] border border-white/5 rounded-2xl p-6 h-[120px] animate-pulse" />
                        ))
                    ) : forwarders.length > 0 ? (
                        forwarders.map((f, i) => (
                            <div
                                key={f.id || i}
                                className="bg-[#162120] border border-white/5 rounded-2xl p-5 sm:p-6 hover:border-white/15 transition"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    {/* Left: Avatar + Info */}
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        {/* {f.image ? (
                                            <img
                                                src={f.image.startsWith("http") ? f.image : `${API_URL}/${f.image}`}
                                                alt={f.businessInfo?.businessName || f.firstName}
                                                className="w-11 h-11 rounded-xl object-cover flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-11 h-11 rounded-xl bg-[#FFBF00]/20 flex-shrink-0 flex items-center justify-center text-[#FFBF00] font-bold text-[16px]">
                                                {(f.businessInfo?.businessName?.[0] || f.firstName?.[0] || "?").toUpperCase()}
                                            </div>
                                        )} */}


                                        <div className="w-11 h-11 rounded-xl bg-[#FFBF00]/20 flex-shrink-0 flex items-center justify-center text-[#FFBF00] font-bold text-[16px]">
                                            {(f.businessInfo?.businessName?.[0] || f.firstName?.[0] || "?").toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-white font-bold text-[16px] leading-snug">
                                                {f.businessInfo?.businessName || `${f.firstName} ${f.lastName}`}
                                            </h3>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/40 text-[12px]">
                                                {/* Route */}
                                                <span className="flex items-center gap-1">
                                                    <MapPin size={11} className="flex-shrink-0" />
                                                    {f.businessInfo?.originCountry} → {f.businessInfo?.destinationCountry}
                                                </span>

                                                {/* Days */}
                                                <span className="flex items-center gap-1">
                                                    <Clock size={11} className="flex-shrink-0" />
                                                    {f.businessInfo?.transitTime}
                                                </span>

                                                {/* Services */}
                                                <span className="flex items-center gap-1">
                                                    <Package size={11} className="flex-shrink-0" />
                                                    {f.businessInfo?.shipmentType || "Freight Service"}
                                                </span>
                                            </div>

                                            {/* Price */}
                                            <div className="mt-2">
                                                {headlinePrice(f.businessInfo?.barrelPrices) !== null && (
                                                    <>
                                                        <span className="text-[#FFBF00] font-bold text-[22px]">
                                                            ${headlinePrice(f.businessInfo?.barrelPrices)}
                                                        </span>
                                                        <span className="text-white/40 text-[12px] ml-1">
                                                            /barrel
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Rating */}
                                    <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-3 ml-auto flex-shrink-0">
                                        {/* Rating */}
                                        <div className="flex items-center gap-1 text-[#FFBF00] text-[13px] font-medium whitespace-nowrap">
                                            <Star size={13} fill="#FFBF00" strokeWidth={0} />
                                            {Number(f.avg_rating).toFixed(1)}
                                            <span className="text-white/30 font-normal ml-1">
                                                ({f.review_count || 0})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center text-white/40 border border-dashed border-white/10 rounded-2xl">
                            No forwarders available at the moment.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AllForwarders;
