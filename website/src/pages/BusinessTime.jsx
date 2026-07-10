import React, { useState, useEffect } from "react";
import { shipp, submit } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import { completeProfile } from "../api/cms";
import { toast } from "sonner";
import { FaSpinner } from "react-icons/fa";

const BuisnessTime = () => {
    const [countryOpen, setCountryOpen] = useState(false);
    const [selectedCountries, setSelectedCountries] = useState([]);
    const [freightType, setFreightType] = useState("Sea");
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState(null);
    const [errors, setErrors] = useState({});

    const countries = [
        "USA",
    ];

    const navigate = useNavigate();

    useEffect(() => {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user && user.id) {
                    setUserId(user.id);
                }
            } catch (e) {
                console.error("Error parsing user from localStorage", e);
            }
        }
    }, []);

    const validateField = (name, value) => {
        let error = "";
        switch (name) {
            case "selectedCountries":
                if (value.length === 0) error = "Please select at least one country";
                break;
            default:
                break;
        }
        setErrors(prev => ({ ...prev, [name]: error }));
        return error;
    };
    const toggleCountry = (country) => {
        let newSelected;

        if (selectedCountries.includes(country)) {
            newSelected = selectedCountries.filter((c) => c !== country);
        } else {
            newSelected = [...selectedCountries, country];
        }

        setSelectedCountries(newSelected);
        validateField("selectedCountries", newSelected);

        // 👇 Add this line to auto close dropdown
        setCountryOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const error = validateField("selectedCountries", selectedCountries);
        if (error) {
            toast.error(error);
            return;
        }

        setLoading(true);
        try {
            const payload = {
                providerId: userId,
                serviceCountries: selectedCountries,
                freightType: freightType,
                profile_step: 6,
            };

            const response = await completeProfile(payload);
            if (response.status === 200 || response.status === "1") {
                if (response.body && response.body.user) {
                    localStorage.setItem("user", JSON.stringify(response.body.user));
                    window.dispatchEvent(new Event('userUpdated'));
                }
                toast.success("Delivery details updated!");
                navigate('/businessupload',{ replace: true });
            } else {
                toast.error(response.message || "Something went wrong");
            }
        } catch (error) {
            console.error("Time update error:", error);
            toast.error(error.response?.data?.message || "Failed to update delivery details");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div>
                <div
                    className="min-h-screen flex items-center justify-center relative"
                    style={{
                        backgroundImage: ` url(${shipp})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                >
                    {/* Card */}
                    <div
                        className="flex flex-col items-center text-white gap-6
            bg-[#2D413F] backdrop-blur-md
            rounded-[22px]
            shadow-[0_25px_80px_rgba(0,0,0,0.6)]
            w-[90vw] sm:w-[500px] lg:w-[800px]
            px-6 sm:px-15 py-10 mb-20 md:mt-35 mt-15"
                    >
                        {/* Heading */}
                        <h1 className="text-[22px] lg:text-[32px] font-semibold">
                            Delivery Timelines And Policies
                        </h1>
                        <p className="text-lg text-white -mt-3">
                            Please enter required details.
                        </p>

                        <div className="w-full max-w-[480px] mt-4">
                            <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5, 6].map((step) => (
                                    <div
                                        key={step}
                                        className={`h-[4px] w-full rounded-full transition-all duration-300 ${step <= 5 ? "bg-yellow-400" : "bg-white/30"
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="w-full max-w-[600px] mx-auto flex flex-col gap-5 text-white">

                            {/* Countries service */}
                            <div className="relative">
                                <h3 className="text-xs mb-2 text-white/60">Operating Countries</h3>

                                <div
                                    onClick={() => setCountryOpen(!countryOpen)}
                                    className="w-full rounded-lg px-4 py-3
                  border border-white/10 bg-[#324947]
                  cursor-pointer flex justify-between items-center"
                                >
                                    <span className="text-sm text-white/50">
                                        {selectedCountries.length > 0
                                            ? `${selectedCountries.length} Selected`
                                            : "Select"}
                                    </span>
                                    <svg
                                        className={`w-4 h-4 transition-transform ${countryOpen ? "rotate-180" : ""}`}
                                        fill="none"
                                        stroke="white"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>

                                {countryOpen && (
                                    <div
                                        className="absolute mt-2 w-full max-h-[340px] overflow-y-auto
                    rounded-lg border border-white/10 bg-[#2D413F] z-50 shadow-xl"
                                    >
                                        {countries.map((country, i) => (
                                            <div
                                                key={i}
                                                onClick={() => toggleCountry(country)}
                                                className="flex items-center gap-3 px-4 py-2
                        hover:bg-white/5 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCountries.includes(country)}
                                                    readOnly
                                                    className="w-4 h-4 rounded accent-[#FFC400] "
                                                />
                                                <span className="text-sm">{country}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {errors.selectedCountries && (
                                    <p className="text-red-400 text-sm mt-1">{errors.selectedCountries}</p>
                                )}
                            </div>

                            {/* Freight Type */}
                            <div>
                                <h3 className="text-xs mb-2 text-white/60">Freight Type</h3>
                                <div
                                    className="w-full rounded-lg px-4 py-3
                  border border-white/10 bg-[#324947] space-y-3"
                                >
                                    {["Sea"].map((type) => (
                                        <label
                                            key={type}
                                            className="flex items-center gap-3 cursor-pointer text-sm"
                                        >
                                            <input
                                                type="radio"
                                                name="freightType"
                                                selected={true}
                                                value={type}
                                                checked={freightType === type}
                                                onChange={() => setFreightType(type)}
                                                className="w-4 h-4 accent-[#FFC400]"
                                            />
                                            {type}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Button */}
                            <div className="flex justify-center mt-4">
                                <button
                                    disabled={loading}
                                    type="submit"
                                    className="bg-gradient-to-b from-[#FFC400] to-[#FFD95A]
                  text-black font-semibold text-[16px]
                  rounded-full
                  h-[52px] w-[180px]
                  active:scale-95 transition-all flex items-center justify-center gap-2
                  disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? <FaSpinner className="animate-spin" /> : "Next"}
                                </button>
                            </div>
                        </form>

                        {/* <p className="text-md text-white mt-2">
                            Already have an account?
                            <span onClick={() => navigate("/type", {
                                state: {
                                    mode: "login",
                                    role: "2"
                                }
                            })} className="text-white cursor-pointer font-bold underline">
                                {" "}
                                Log In
                            </span>
                        </p> */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuisnessTime;
