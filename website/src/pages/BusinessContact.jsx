import React, { useState, useEffect } from 'react'
import { shipp } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import { completeProfile } from "../api/cms";
import { toast } from "sonner";
import { FaSpinner } from "react-icons/fa";
import PhoneInput from "../components/PhoneInput";
import { validatePhoneForCountry } from "../utils/countryPhoneData";

const BuisnessContact = () => {
    const [formData, setFormData] = useState({
        email: "",
        phone: "",
        country: { dialCode: "+1", code: "US" },
        primaryContactPersonFirstName: "",
        primaryContactPersonLastName: "",
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
            case "email":
                if (!value.trim()) error = "Company Email is required";
                else if (!/\S+@\S+\.\S+/.test(value)) error = "Invalid email format";
                break;
            case "phone":
                error = validatePhoneForCountry(formData.country.dialCode, value);
                break;
            case "primaryContactPersonFirstName":
                if (!value.trim()) error = "First Name is required";
                break;
            case "primaryContactPersonLastName":
                if (!value.trim()) error = "Last Name is required";
                break;
            default:
                break;
        }
        setErrors(prev => ({ ...prev, [name]: error }));
        return error;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let formattedValue = value.replace(/^\s+/, "");

        if (name === "phone") {
            formattedValue = formattedValue.replace(/[^0-9]/g, "");
        }

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
            // toast.error("Please fix the errors in the form");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                providerId: userId,
                companyEmail: formData.email,
                phone: formData.phone,
                countryCode: formData.country.dialCode,
                primaryContactPersonFirstName: formData.primaryContactPersonFirstName,
                primaryContactPersonLastName: formData.primaryContactPersonLastName,
                profile_step: 3,
            };

            const response = await completeProfile(payload);
            if (response.status === 200 || response.status === "1") {
                if (response.body && response.body.user) {
                    localStorage.setItem("user", JSON.stringify(response.body.user));
                    window.dispatchEvent(new Event('userUpdated'));
                }
                toast.success(response.message || "Contact details updated!");
                navigate("/businessdoument", { replace: true });
            } else {
                toast.error(response.message || "Something went wrong");
            }
        } catch (error) {
            console.error("Profile update error:", error);
            toast.error(error.response?.data?.message || "Failed to update contact details");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div
                className="min-h-screen flex items-center justify-center"
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
          px-6 sm:px-15 py-10 mb-20 md:mt-35 mt-10"
                >
                    {/* Heading */}
                    <h1 className="text-[22px] lg:text-[32px] font-semibold">
                        Contact Details
                    </h1>
                    <p className="text-lg text-white -mt-3">
                        Please enter required details.
                    </p>

                    <div className="w-full max-w-[480px] mt-4">
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5, 6].map((step) => (
                                <div
                                    key={step}
                                    className={`h-[4px] w-full rounded-full transition-all duration-300 ${step <= 2 ? "bg-yellow-400" : "bg-white/30"
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="w-full max-w-[560px] flex flex-col gap-4">
                        {/* Company Email */}
                        <div>
                            <label className="text-lg font-medium">Company Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="Enter"
                                className="w-full bg-transparent border border-white/20
                text-white placeholder:text-white/40
                rounded-md px-4 py-2.5
                focus:outline-none focus:border-yellow-400"
                            />
                            {errors.email && (
                                <p className="text-red-400 text-sm mt-1">{errors.email}</p>
                            )}
                        </div>

                        {/* Phone Number */}
                        <div>
                            <PhoneInput
                                label="Phone Number"
                                value={formData.phone}
                                onChange={(val) => {
                                    setFormData(prev => ({ ...prev, phone: val }));
                                    validateField("phone", val);
                                }}
                                country={formData.country}
                                onCountryChange={(countryObj) => {
                                    setFormData(prev => ({ ...prev, country: countryObj }));
                                    if (formData.phone) validateField("phone", formData.phone);
                                }}
                                error={errors.phone}
                                placeholder="Enter"
                            />
                        </div>
                        <label className="text-lg font-medium">Primary Contact</label>
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* <div className="flex-1">
                                <label className="text-lg font-medium">First Name</label>
                                <input
                                    type="text"
                                    name="primaryContactPersonFirstName"
                                    value={formData.primaryContactPersonFirstName}
                                    onChange={handleInputChange}
                                    placeholder="First Name"
                                    className="w-full bg-transparent border border-white/20
                    text-white placeholder:text-white/40
                    rounded-md px-4 py-2.5
                    focus:outline-none focus:border-yellow-400"
                                />
                                {errors.primaryContactPersonFirstName && (
                                    <p className="text-red-400 text-sm mt-1">{errors.primaryContactPersonFirstName}</p>
                                )}
                            </div> */}
                            <div className="flex-1">
                                <label className="text-lg font-medium">First Name</label>
                                <input
                                    type="text"
                                    name="primaryContactPersonFirstName"
                                    value={formData.primaryContactPersonFirstName}
                                    onChange={(e) => {
                                        const rawValue = e.target.value;
                                        const formattedValue = rawValue.charAt(0).toUpperCase() + rawValue.slice(1).toLowerCase();
                                        handleInputChange({
                                            ...e,
                                            target: {
                                                ...e.target,
                                                name: "primaryContactPersonFirstName",
                                                value: formattedValue,
                                            },
                                        });
                                    }}
                                    placeholder="First Name"
                                    className="w-full bg-transparent border border-white/20
      text-white placeholder:text-white/40
      rounded-md px-4 py-2.5
      focus:outline-none focus:border-yellow-400"
                                />
                                {errors.primaryContactPersonFirstName && (
                                    <p className="text-red-400 text-sm mt-1">{errors.primaryContactPersonFirstName}</p>
                                )}
                            </div>

                            {/* <div className="flex-1">
                                <label className="text-lg font-medium">Last Name</label>
                                <input
                                    type="text"
                                    name="primaryContactPersonLastName"
                                    value={formData.primaryContactPersonLastName}
                                    onChange={handleInputChange}
                                    placeholder="Last Name"
                                    className="w-full bg-transparent border border-white/20
                    text-white placeholder:text-white/40
                    rounded-md px-4 py-2.5
                    focus:outline-none focus:border-yellow-400"
                                />
                                {errors.primaryContactPersonLastName && (
                                    <p className="text-red-400 text-sm mt-1">{errors.primaryContactPersonLastName}</p>
                                )}
                            </div> */}
                            <div className="flex-1">
                                <label className="text-lg font-medium">Last Name</label>
                                <input
                                    type="text"
                                    name="primaryContactPersonLastName"
                                    value={formData.primaryContactPersonLastName}
                                    onChange={(e) => {
                                        const rawValue = e.target.value;
                                        const formattedValue = rawValue.charAt(0).toUpperCase() + rawValue.slice(1).toLowerCase();
                                        handleInputChange({
                                            ...e,
                                            target: {
                                                ...e.target,
                                                name: "primaryContactPersonLastName",
                                                value: formattedValue,
                                            },
                                        });
                                    }}
                                    placeholder="Last Name"
                                    className="w-full bg-transparent border border-white/20
      text-white placeholder:text-white/40
      rounded-md px-4 py-2.5
      focus:outline-none focus:border-yellow-400"
                                />
                                {errors.primaryContactPersonLastName && (
                                    <p className="text-red-400 text-sm mt-1">{errors.primaryContactPersonLastName}</p>
                                )}
                            </div>

                        </div>

                        {/* Button */}
                        <div className="flex justify-center mt-4">
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
                    </form>

                    {/* Login */}
                    {/* <p className="text-md text-white mt-2">
                        Already have an account?
                        <span
                            onClick={() => navigate("/type", {
                                state: {
                                    mode: "login",
                                    role: "2"
                                }
                            })}
                            className="text-white cursor-pointer font-bold underline"
                        >
                            {" "}
                            Log In
                        </span>
                    </p> */}
                </div>
            </div>
        </div>
    )
}

export default BuisnessContact
