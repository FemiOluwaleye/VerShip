import React, { useRef, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import { arow, arrowss } from "../common/common-assets/assets-images";

import {
    client1, client2,
    logo0, logo1, logo2, logo3, logo4, logo5
} from "../common/common-assets/assets-images";
import { getRatings } from "../api/cms";

const getLetterAvatar = (name, bgColor = "C1A35E") => {
    const firstLetter = name ? name.charAt(0).toUpperCase() : "?";
    return `https://ui-avatars.com/api/?name=${firstLetter}&background=${bgColor}&color=fff&size=96&fontsize=48&bold=true&rounded=true`;
};

const staticTestimonials = [
    {
        id: 1,
        name: "Kathleen Smith",
        role: "Fuel company",
        image: client1,
        review: "Leverage agile frameworks to provide a robust synopsis for strategy foster collaborative thinking to further the overall value proposition. Organically grow the holistic world view of disruptive innovation via workplace diversity and empowerment.",
        rating: 5
    },
    {
        id: 2,
        name: "John Martin",
        role: "Restoration company",
        image: client2,
        review: "Iterate solutions to ensure seamless functionality while maintaining a focus on customer-centric design principles. Enhance user experiences through strategic partnerships and community engagement.",
        rating: 5
    },
    {
        id: 3,
        name: "Kathleen Smith",
        role: "Fuel company",
        image: client1,
        review: "Leverage agile frameworks to provide a robust synopsis for strategy foster collaborative thinking to further the overall value proposition. Organically grow the holistic world view of disruptive innovation via workplace diversity and empowerment.",
        rating: 5
    },
];

const partners = [
    { name: "Partner 1", logo: logo0 },
    { name: "Partner 2", logo: logo1 },
    { name: "Partner 3", logo: logo2 },
    { name: "Partner 4", logo: logo3 },
    { name: "Partner 5", logo: logo4 },
    { name: "Partner 6", logo: logo5 },
];

const ClientTestimonials = () => {
    const prevRef = useRef(null);
    const nextRef = useRef(null);
    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ averageRating: 0, totalReviews: 0 });
    const [useStaticData, setUseStaticData] = useState(false);

    useEffect(() => {
        fetchRatings();
    }, []);

    const fetchRatings = async () => {
        try {
            const response = await getRatings();

            let ratingsData = [];
            let statsData = { averageRating: 0, totalReviews: 0 };

            if (response && response.body) {
                if (response.body.ratings && Array.isArray(response.body.ratings)) {
                    ratingsData = response.body.ratings;
                    if (response.body.stats) {
                        statsData = response.body.stats;
                    }
                } else if (Array.isArray(response.body)) {
                    ratingsData = response.body;
                }
            } else if (response && response.data) {
                if (response.data.ratings && Array.isArray(response.data.ratings)) {
                    ratingsData = response.data.ratings;
                    if (response.data.stats) {
                        statsData = response.data.stats;
                    }
                } else if (Array.isArray(response.data)) {
                    ratingsData = response.data;
                }
            }

            const validRatings = ratingsData.filter(rating =>
                rating.rating &&
                rating.review &&
                rating.review.trim() !== '' &&
                rating.ratedto !== null
            );

            if (validRatings.length === 0) {
                -           setUseStaticData(true);
                -           setRatings(staticTestimonials);
                -           setStats({ averageRating: 4.9, totalReviews: 146822 });
                +           setUseStaticData(false);
                +           setRatings([]);         // ← empty → triggers "No reviews yet" UI
                +           setStats({ averageRating: 0, totalReviews: 0 });
            } else {
                // ... rest unchanged
            }
        } catch (error) {
            console.error("Failed to fetch ratings:", error);
            -       setUseStaticData(true);
            -       setRatings(staticTestimonials);
            -       setStats({ averageRating: 4.9, totalReviews: 146822 });
            +       setUseStaticData(false);
            +       setRatings([]);             // ← same for error case
            +       setStats({ averageRating: 0, totalReviews: 0 });
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (ratingsData) => {
        if (!ratingsData || ratingsData.length === 0) return;

        let totalRating = 0;
        let reviewCount = 0;

        ratingsData.forEach(rating => {
            if (rating.rating) {
                totalRating += parseFloat(rating.rating);
                reviewCount++;
            }
        });

        const average = reviewCount > 0 ? totalRating / reviewCount : 0;
        setStats({
            averageRating: parseFloat(average.toFixed(1)),
            totalReviews: reviewCount
        });
    };

    const renderStars = (ratingValue) => {
        const numRating = parseFloat(ratingValue) || 0;
        const fullStars = Math.floor(numRating);

        return (
            <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                    <Star
                        key={i}
                        size={14}
                        fill={i < fullStars ? "#C1A35E" : "none"}
                        color="#C1A35E"
                        className={i < fullStars ? "fill-[#C1A35E]" : "text-[#C1A35E]"}
                    />
                ))}
            </div>
        );
    };

    const getUserName = (ratedby) => {
        if (useStaticData) return "";
        if (!ratedby) return "Anonymous User";
        const firstName = ratedby.firstName || "";
        const lastName = ratedby.lastName || "";
        if (firstName || lastName) {
            return `${firstName} ${lastName}`.trim();
        }
        if (ratedby.email) {
            return ratedby.email.split('@')[0];
        }
        return "Customer";
    };

    const getUserImage = (ratedby, userName) => {
        if (useStaticData) return "";

        if (ratedby && ratedby.image && ratedby.image !== "" && ratedby.image !== null) {
            if (ratedby.image.startsWith('http')) {
                return ratedby.image;
            }
            return ratedby.image;
        }

        return getLetterAvatar(userName || "Customer");
    };

    const getBusinessName = (ratedto) => {
        if (useStaticData) return "";
        if (!ratedto) return "Service Provider";
        if (ratedto.businessInfo && ratedto.businessInfo.businessName) {
            return ratedto.businessInfo.businessName;
        }
        if (ratedto.working_as) {
            return ratedto.working_as;
        }
        if (ratedto.firstName) {
            return ratedto.firstName;
        }
        return "Service Provider";
    };

    if (loading) {
        return (
            <section id="testimonials" className="bg-[#F6F6F6] py-24 px-6 overflow-hidden">
                <div className="max-w-[1570px] mx-auto text-center">
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C1A35E]"></div>
                    </div>
                    <p className="text-gray-500">Loading testimonials...</p>
                </div>
            </section>
        );
    }

    return (
        <section id="testimonials" className="bg-[#F6F6F6] py-24 px-6 overflow-hidden">
            <div className="max-w-[1570px] mx-auto">

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start mb-20">
                    <div className="md:col-span-3 pt-4">
                        <p className="mx-12 text-[#1A1A1A]/50 text-[12px] leading-relaxed max-w-[280px]">
                            Our clients trust us for reliable, efficient barrel logistics solutions. Their success stories reflect our commitment to timely delivery.
                        </p>
                    </div>

                    <div className="mx-28 md:col-span-6 flex flex-col items-center md:items-start text-center md:text-left">
                        <h2 className="text-[30px] md:text-[40px] font-medium text-[#040b0c] leading-[1.1] mb-8">
                            See what our happy <br className="hidden md:block" />
                            clients are saying
                        </h2>

                        {stats.totalReviews > 0 && (
                            <div className="flex flex-col items-center md:items-start gap-2">
                                <div className="flex gap-1 mb-2">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={18}
                                            fill={i < Math.floor(stats.averageRating) ? "#C1A35E" : "none"}
                                            color="#C1A35E"
                                        />
                                    ))}
                                </div>
                                <p className="text-sm font-medium text-[#8c9090]/40">
                                    {stats.averageRating} based on &nbsp; &nbsp;
                                    <span className="inline-flex items-center border-b border-black text-[#040b0c] font-bold">
                                        {stats.totalReviews.toLocaleString()} reviews
                                        <span className="ml-1 text-[#c8ad71]">↗</span>
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>

                    {!useStaticData && ratings.length >= 1 && (
                        <div className="md:col-span-3 flex justify-center md:justify-start mx-14 gap-4 pt-2">
                            <button
                                ref={prevRef}
                                className="w-10 h-10 rounded-[14px] bg-[#F5F5F5] flex items-center justify-center hover:bg-[#EAEAEA] transition-all disabled:opacity-20"
                            >
                                <img src={arrowss} alt="Previous" style={{ width: '1rem', height: '1rem' }} />
                            </button>
                            <button
                                ref={nextRef}
                                className="w-10 h-10 rounded-[14px] border border-[#16646a] flex items-center justify-center hover:bg-[#05393D]/5 transition-all"
                            >
                                <img src={arow} alt="Next" style={{ width: '1.25rem', height: '1.25rem' }} />
                            </button>
                        </div>
                    )}

                    {(!useStaticData && ratings.length <= 1) && (
                        <div className="md:col-span-3"></div>
                    )}
                </div>

                <div className="mb-32">
                    {ratings.length > 0 ? (
                        <Swiper
                            onBeforeInit={(swiper) => {
                                if (!useStaticData && ratings.length > 1) {
                                    swiper.params.navigation.prevEl = prevRef.current;
                                    swiper.params.navigation.nextEl = nextRef.current;
                                }
                            }}
                            modules={[Navigation, Autoplay]}
                            spaceBetween={60}
                            slidesPerView={1}
                            loop={!useStaticData && ratings.length > 1}
                            autoplay={{
                                delay: 5000,
                                disableOnInteraction: false,
                            }}
                            breakpoints={{
                                1024: { slidesPerView: 2 },
                            }}
                            className="testimonial-swiper"
                        >
                            {ratings.map((rating, i) => {
                                const userName = useStaticData ? rating.name : getUserName(rating.ratedby);
                                const userImage = useStaticData
                                    ? (rating.image && rating.image !== "" && rating.image !== null ? rating.image : getLetterAvatar(rating.name))
                                    : getUserImage(rating.ratedby, userName);

                                return (
                                    <SwiperSlide key={rating.id || i}>
                                        <div className="flex flex-col">
                                            <div className="flex justify-start md:ml-48">
                                                <span className="text-[#c1a35e] font-serif text-6xl leading-none">“</span>
                                            </div>

                                            <div className="flex flex-col md:flex-row items-start mx-8">
                                                <div className="flex flex-col items-center md:items-start min-w-[160px] text-center md:text-left ">
                                                    <div className="w-20 h-20 rounded-full overflow-hidden mb-3 mx-4 border-2 border-white shadow-md bg-gray-100 flex items-center justify-center">
                                                        <img
                                                            src={userImage}
                                                            alt={userName || "Customer"}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                e.target.src = getLetterAvatar(userName || "Customer");
                                                            }}
                                                        />
                                                    </div>
                                                    <h4 className="text-[#C1A35E] font-bold text-sm uppercase tracking-wide whitespace-nowrap mb-1">
                                                        {userName}
                                                    </h4>
                                                    <p className="text-[#1A1A1A]/40 text-xs font-medium">
                                                        {useStaticData ? rating.role : getBusinessName(rating.ratedto)}
                                                    </p>
                                                    {renderStars(useStaticData ? rating.rating : (rating.rating || 0))}
                                                </div>

                                                <div className="flex-grow pt-2">
                                                    <p className="text-[#1A1A1A]/70 text-[15px] md:text-base leading-[1.8] font-medium">
                                                        {useStaticData ? rating.review : (rating.review || rating.comment || "No review text provided.")}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </SwiperSlide>
                                );
                            })}
                        </Swiper>
                    ) : (
                        <div className="text-center ">
                            <p className="text-[#1A1A1A]/40 text-base font-medium">
                                No reviews yet — be the first to share your experience!
                            </p>
                        </div>
                    )}
                </div>

                {/* <div className="border-black/5 pt-12">
                    <Swiper
                        modules={[Autoplay]}
                        spaceBetween={50}
                        slidesPerView={2}
                        loop={true}
                        speed={3000}
                        allowTouchMove={false}
                        autoplay={{
                            delay: 0,
                            disableOnInteraction: false,
                        }}
                        breakpoints={{
                            640: { slidesPerView: 3 },
                            1024: { slidesPerView: 6 },
                        }}
                        className="partner-swiper"
                    >
                        {[...partners, ...partners].map((p, i) => (
                            <SwiperSlide key={i}>
                                <div className="flex items-center justify-center transition-all cursor-pointer h-12">
                                    <img src={p.logo} alt={p.name} className="max-h-full max-w-full object-contain transition-all" />
                                    {i !== [...partners, ...partners].length - 1 && (
                                        <span className="mx-6 text-[#b9ced0]">|</span>
                                    )}
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div> */}
            </div>

            <style jsx global>{`
                .partner-swiper .swiper-wrapper {
                    transition-timing-function: linear !important;
                }
            `}</style>
        </section>
    );
};

export default ClientTestimonials;