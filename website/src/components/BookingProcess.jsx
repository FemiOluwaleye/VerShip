import React from "react";
import { CalendarCheck, PackageCheck, MapPinCheck } from "lucide-react";

const steps = [
    {
        number: "(01)",
        Icon: CalendarCheck,
        title: "Book",
        description: "Compare rates and book your shipment online.",
    },
    {
        number: "(02)",
        Icon: PackageCheck,
        title: "Pickup",
        description: "Your shipment is collected at your convenience.",
    },
    {
        number: "(03)",
        Icon: MapPinCheck,
        title: "Delivery",
        description: "Your shipment is delivered safely and on time.",
    },
];

const BookingProcess = () => {
    return (
        <section id="booking-process" className="bg-white py-12 md:py-20 px-4 md:px-6 rounded-2xl">
            <div className="max-w-[1326px] mx-auto">
                {/* Header */}
                <div className="mb-8 md:mb-12 md:mx-26">
                    <h2 className="text-[32px] md:text-[48px] font-medium text-[#040b0c] leading-[1.1] mb-4">
                        From booking <br className="hidden md:block" />
                        to delivery.
                    </h2>
                    <p className="text-[#1A1A1A]/40 text-xs md:text-sm tracking-wide">
                        Simple. Fast. Delivered door to door.
                    </p>
                </div>

                {/* Steps */}
                <div className="relative md:mx-26">
                    {/* Connecting line (desktop only) */}
                    <div
                        aria-hidden="true"
                        className="hidden md:block absolute top-[52px] left-[16.66%] right-[16.66%] h-[2px] bg-gradient-to-r from-[#073737] via-[#D4B97C] to-[#073737] opacity-25"
                    />

                    <ol className="relative grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 list-none">
                        {steps.map((step) => {
                            const { Icon } = step;
                            return (
                                <li
                                    key={step.number}
                                    className="group bg-[#073737] rounded-[14px] p-6 md:p-8 flex flex-col h-full transition-transform duration-300 hover:-translate-y-1"
                                >
                                    {/* Icon badge + number */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="w-14 h-14 rounded-full bg-[#0D4D4D] ring-4 ring-white flex items-center justify-center transition-colors duration-300 group-hover:bg-[#D4B97C]">
                                            <Icon
                                                size={24}
                                                aria-hidden="true"
                                                className="text-[#D4B97C] transition-colors duration-300 group-hover:text-[#073737]"
                                            />
                                        </div>
                                        <span className="text-[#D4B97C]/70 font-medium text-sm tracking-wider">
                                            {step.number}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <h3 className="text-2xl font-medium text-white mb-2">
                                        {step.title}
                                    </h3>
                                    <p className="text-[#DCD5C5]/70 text-sm leading-relaxed">
                                        {step.description}
                                    </p>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </div>
        </section>
    );
};

export default BookingProcess;
