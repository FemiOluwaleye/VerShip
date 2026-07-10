import React from "react";
import { book1, book2, book3 } from "../common/common-assets/assets-images";

const steps = [
    {
        number: "(01)",
        image: book1,
        title: "Book",
        description: "Compare rates and book your shipment online.",
    },
    {
        number: "(02)",
        image: book2,
        title: "Pickup",
        description: "Your shipment is collected at your convenience.",
    },
    {
        number: "(03)",
        image: book3,
        title: "Delivery",
        description: "Your shipment is delivered safely and on time.",
    },
];

const BookingProcess = () => {
    return (
        <section id="booking-process" className="bg-white py-12 md:py-24 px-4 md:px-6 rounded-2xl">
            <div className="max-w-[1326px] mx-auto">
                {/* Header */}
                <div className="mb-8 md:mb-12">
                    <h2 className="text-[32px] md:text-[48px] font-medium text-[#040b0c] mx-26 leading-[1.1] mb-6">
                        From booking <br className="hidden md:block" />
                        to delivery.
                    </h2>
                    <p className="text-[#1A1A1A]/40 text-xs md:text-sm tracking-wide mx-26">
                        Simple. Fast. Delivered door to door.
                    </p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {steps.map((step, index) => (
                        <div key={index} className="bg-[#F9F9F7] rounded-[14px] p-8 flex flex-col h-full">
                            {/* Number */}
                            <span className="text-[#1A1A1A]/30 font-medium text-base mb-6 block">
                                {step.number}
                            </span>

                            {/* Image Container */}
                            <div className="mb-8 overflow-hidden rounded-[6px]">
                                <img
                                    src={step.image}
                                    alt={step.title}
                                    className="w-full h-[240px] object-cover hover:scale-105 transition-transform duration-500"
                                />
                            </div>

                            {/* Content */}
                            <div className="mt-auto">
                                <h3 className="text-2xl font-medium text-[#1A1A1A] mb-3">
                                    {step.title}
                                </h3>
                                <p className="text-[#1A1A1A]/50 text-sm leading-relaxed">
                                    {step.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default BookingProcess;
