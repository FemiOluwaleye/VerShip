import React from "react";
import { ShieldCheck, DollarSign, Clock } from "lucide-react";

const features = [
    {
        icon: <ShieldCheck size={28} className="text-[#FFBF00]" />,
        title: "Verified Forwarders",
        description: "Every forwarder is vetted and verified",
    },
    {
        icon: <DollarSign size={28} className="text-[#FFBF00]" />,
        title: "Best Rates",
        description: "Compare prices across multiple forwarders",
    },
    {
        icon: <Clock size={28} className="text-[#FFBF00]" />,
        title: "Fast Delivery",
        description: "Most shipments arrive within 7–14 days",
    },
];

const TrustBar = () => {
    return (
        <section className="bg-[#0D1412] border-t border-white/5 py-12 px-6">
            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
                {features.map((f, i) => (
                    <div key={i} className="flex flex-col items-center gap-3">
                        {f.icon}
                        <h3 className="text-white font-semibold text-[18px]">{f.title}</h3>
                        <p className="text-white/40 text-[18px]">{f.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default TrustBar;
