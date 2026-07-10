import React, { useState, useEffect } from 'react'
import { shipp } from "../common/common-assets/assets-images";
import { useNavigate } from 'react-router-dom';
import { completeProfile } from "../api/cms";
import { toast } from "sonner";
import { FaSpinner } from "react-icons/fa";

const BuisnessPolicies = () => {
    const [formData, setFormData] = useState({
        deliveryTime: "14 Days",
        // policy: "",
    });
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState(null);
    const [errors, setErrors] = useState({});

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
            case "deliveryTime":
                if (!value.trim()) error = "Delivery Time is required";
                break;
            // case "policy":
            //     if (!value.trim()) error = "Policy is required";
            //     break;
            default:
                break;
        }
        setErrors(prev => ({ ...prev, [name]: error }));
        return error;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        const formattedValue = value.replace(/^\s+/, "");
        setFormData((prev) => ({ ...prev, [name]: formattedValue }));
        validateField(name, formattedValue);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate all fields
        const newErrors = {};
        Object.keys(formData).forEach(key => {
            const error = validateField(key, formData[key]);
            if (error) newErrors[key] = error;
        });

        if (Object.values(newErrors).some(err => err)) {
            setErrors(newErrors);
            toast.error("Please fix the errors in the form");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                providerId: userId,
                deliveryTimeline: formData.deliveryTime,
                // deliveryPolicy: formData.policy,
                profile_step: 5,
            };

            const response = await completeProfile(payload);
            if (response.status === 200 || response.status === "1") {
                if (response.body && response.body.user) {
                    localStorage.setItem("user", JSON.stringify(response.body.user));
                    window.dispatchEvent(new Event('userUpdated'));
                }
                toast.success("Policies updated!");
                navigate('/businesstime',{ replace: true });
            } else {
                toast.error(response.message || "Something went wrong");
            }
        } catch (error) {
            console.error("Policy update error:", error);
            toast.error(error.response?.data?.message || "Failed to update policies");
        } finally {
            setLoading(false);
        }
    };

    return (
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
                                    className={`h-[4px] w-full rounded-full transition-all duration-300 ${step <= 4 ? "bg-yellow-400" : "bg-white/30"
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="w-full max-w-[600px] flex flex-col gap-4">
                        {/* Upload Sections */}
                        <div className="flex flex-col gap-6">
                            <div className="w-full max-w-3xl mx-auto text-white space-y-8">
                                {/* Delivery Time */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Delivery Time</h3>
                                    <select
                                        name="deliveryTime"
                                        value={formData.deliveryTime}
                                        onChange={handleInputChange}
                                        className="w-full bg-transparent border border-white/20
                    text-white rounded-md px-4 py-2.5
                    focus:outline-none focus:border-yellow-400"
                                    >
                                        <option value="14 Days" className="text-black">14 Days</option>
                                        <option value="21 Days" className="text-black">21 Days</option>
                                    </select>
                                    {errors.deliveryTime && (
                                        <p className="text-red-400 text-sm mt-1">{errors.deliveryTime}</p>
                                    )}
                                </div>

                                {/* Policy */}
                                {/* <div>
                                    <h3 className="text-lg font-semibold mb-2">Policy</h3>
                                    <div
                                        className="w-full rounded-2xl px-5 py-4
                 border border-white/20
                 bg-white/5
                 space-y-2"
                                    >
                                        <textarea
                                            name="policy"
                                            value={formData.policy}
                                            onChange={handleInputChange}
                                            placeholder="Enter"
                                            className="w-full bg-transparent border border-white/20
                    text-white placeholder:text-white/40
                    rounded-md px-4 py-2.5
                    focus:outline-none focus:border-yellow-400 min-h-[100px]"
                                        />
                                        {errors.policy && (
                                            <p className="text-red-400 text-sm mt-1">{errors.policy}</p>
                                        )}
                                    </div>
                                </div> */}
                            </div>

                            {/* Button */}
                            <div className="flex justify-center mt-10">
                                <button
                                    disabled={loading}
                                    type="submit"
                                    className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
                  text-black font-bold text-[17px] sm:text-[19px]
                  rounded-full
                  h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
                  transition-all flex items-center justify-center gap-2
                  disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? <FaSpinner className="animate-spin" /> : "Next"}
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* Login */}
                    {/* <p className="text-md text-white mt-2">
                        Already have an account?
                        <span onClick={() => navigate('/type', {
                            state: {
                                mode: "login",
                                role: "2"
                            }
                        })} className="text-white cursor-pointer font-bold underline"> Log In</span>
                    </p> */}
                </div>
            </div>
        </div>
    )
}

export default BuisnessPolicies
