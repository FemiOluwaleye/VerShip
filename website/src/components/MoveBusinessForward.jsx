import React from "react";
import { largeCargoShip, newTop } from "../common/common-assets/assets-images";

const MoveBusinessForward = ({ variant }) => {
    const scrollToForm = () => {
        const element = document.getElementById("booking-form");
        if (element) {
            element.scrollIntoView({ behavior: "smooth" });
        }
    };

    if (variant === "footer") {
        return (
            <section className="bg-[#0A0D0C] relative overflow-hidden">
                <div className="w-full relative h-[400px] md:h-[600px] lg:h-[700px] overflow-hidden flex flex-col justify-center items-center">
                    {/* Background Image */}
                    <div className="absolute inset-0">
                        <img
                            src={largeCargoShip}
                            alt="Shipping"
                            className="w-full h-full object-cover"
                        />
                        {/* Dark Overlay */}
                        <div className="absolute inset-0 bg-black/60"></div>
                        {/* Bottom Gradient for seamless blend with Footer */}
                        <div className="absolute inset-x-0 bottom-0 h-40 md:h-64 bg-gradient-to-t from-[#0A0D0C] to-transparent"></div>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 p-6 max-w-[1200px] w-full text-center flex flex-col items-center mt-70">
                        <h2 className="text-white text-[28px] md:text-[60px] font-medium leading-[1.1] mb-6 tracking-tight">
                            Let's move your <br />
                            <span className="text-[#C1A35E] italic font-serif">shipment</span> forward.
                        </h2>
                        <p className="text-white/60 text-[12px]  mb-10 max-w-lg mx-auto font-medium">
                            The fast and reliable way to ship
                        </p>
                        <div className="flex justify-center ">
                            <div className="p-2 bg-[#DCD5C5]/5 rounded-2xl md:rounded-[14px]">
                                <button
                                    onClick={scrollToForm}
                                    className="bg-[#c1a35e] hover:bg-[#E5C78A] text-[#071618] 
                                        px-6 md:px-8
                                        py-1.5 md:py-2 
                                        rounded-[12px]
                                        font-medium text-base md:text-lg 
                                        transition-all 
                                        shadow-[0_8px_16px_rgba(212,185,124,0.2)] 
                                        w-auto tracking-wide"
                                >
                                    Get quotes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    // Default "Card" variant for Homepage
    return (
        <section className="bg-[#0A0D0C] relative overflow-hidden">
            <div className="w-full relative h-[600px] md:h-[900px] overflow-hidden flex flex-col justify-center items-center px-4 md:px-0">
                {/* Background Image */}
                <div className="absolute inset-0">
                    <img
                        src={newTop}
                        alt="Shipping Container"
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Central Card */}
                <div className="relative z-10 bg-[#05393d] p-8 md:p-20 max-w-[1100px] w-full rounded-[14px] text-center flex flex-col items-center shadow-2xl">
                    <h2 className="text-[#dcd5c5] text-[36px] md:text-[64px] lg:text-[72px] font-light leading-[1.1] mb-6 tracking-tight">
                        <span className="block  mb-1 font-normal opacity-90">Let's move</span>
                        your <span className="text-[#C1A35E]  italic font-serif">shipment</span> forward.
                    </h2>
                    <p className="text-white/60 text-sm md:text-normal lg:text-lg mb-10 max-w-2xl mx-auto font-normal">
                        The fast and reliable way to ship.
                    </p>
                    <div className="flex justify-center">
                        <div className="p-2 bg-[#DCD5C5]/5 rounded-2xl md:rounded-[14px]">
                            <button
                                onClick={scrollToForm}
                                className="bg-[#c1a35e] hover:bg-[#E5C78A] text-[#071618] 
                                px-6 md:px-8
                                py-1.5 md:py-2 
                                rounded-[8px]
                                font-medium text-20 text-base md:text-lg 
                                transition-all 
                                shadow-[0_8px_16px_rgba(212,185,124,0.2)] 
                                w-auto tracking-wide"
                            >
                                Get quotes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MoveBusinessForward;
