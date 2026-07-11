import React from "react";
import { Search, Package, Truck } from "lucide-react";

const steps = [
    {
        icon: <Search size={18} className="text-[#C1A35E]" />,
        title: "Compare rates",
        description: "Browse verified freight forwarders and compare barrel shipping rates to Jamaica.",
    },
    {
        icon: <Package size={18} className="text-[#C1A35E]" />,
        title: "Book your shipment",
        description: "Choose a forwarder, select your barrel count, and book your shipment in minutes.",
    },
    {
        icon: <Truck size={18} className="text-[#C1A35E]" />,
        title: "Track & receive",
        description: "Track your barrels all the way to Jamaica and get notified on delivery.",
    },
];

const HowItWorks = () => {
    return (
        <section id="how-it-works" className="bg-white pt-8 pb-20 md:pt-10 md:pb-32 px-4 md:px-26 relative overflow-hidden">

            {/* Marquee Text Slider */}
            <div aria-hidden="true" className="w-full overflow-hidden whitespace-nowrap opacity-[0.10] pointer-events-none">
                <div className="mb-14 inline-block animate-marquee text-[50px] md:text-[80px] font-medium text-black tracking-tighter">
                    Shipping Simplified.&nbsp; &nbsp; Quotes in Seconds.&nbsp; &nbsp; Delivered with Care. &nbsp; &nbsp;
                    Shipping Simplified.&nbsp; &nbsp; Quotes in Seconds.&nbsp; &nbsp; Delivered with Care. &nbsp; &nbsp;
                </div>
            </div>

            <div className="max-w-[1326px] mx-auto relative z-10">
                {/* Mission Statement */}
                <div className="max-w-4xl mx-auto mb-12 md:mb-16 pt-6 md:pt-10 mt-4">
                    <p className="text-[#040b0c] text-xl md:text-[32px] font-medium leading-relaxed md:leading-snug">
                        Looking to ship freight from USA to Jamaica? VerShip allows you compare rates from trusted shipping companies, book and track your shipment all in one place.
                    </p>
                </div>

                {/* Section Title */}
                <div className="text-center mb-12 md:mb-20">
                    <h6 className="text-[32px] md:text-[42px] font-medium text-[#040b0c] mb-3">How it works</h6>
                    <p className="text-[#1A1A1A]/40 text-xs md:text-sm tracking-wide">Three simple steps to ship your barrels</p>
                </div>

                {/* Divider */}
                <div className="h-[1px] bg-black/5 w-full mb-8 md:mb-12"></div>

                {/* Steps List */}
                <div className="max-w-4xl mx-auto space-y-6 md:space-y-10">
                    {steps.map((step, index) => (
                        <div
                            key={index}
                            className="flex flex-row items-center gap-3 md:gap-10"
                        >
                            {/* Icon */}
                            <div className="flex-shrink-0 w-5">
                                {step.icon}
                            </div>

                            {/* Title — fixed width on each breakpoint */}
                            <h3 className="flex-shrink-0 whitespace-nowrap font-medium text-[#040b0c] leading-tight
                                text-[14px]  w-[120px]
                                sm:text-[18px] sm:w-[200px]
                                md:text-[34px] md:w-[340px]">
                                {step.title}
                            </h3>

                            {/* Description */}
                            <p className="text-[#040b0c]/50 leading-relaxed
                                text-[11px]
                                sm:text-[13px]
                                md:text-lg">
                                {step.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <style jsx>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    display: inline-block;
                    animation: marquee 30s linear infinite;
                }
            `}</style>
        </section>
    );
};

export default HowItWorks;