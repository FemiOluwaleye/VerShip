import React, { useState } from "react";
import { shipp } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaSpinner } from "react-icons/fa";
import { updateProfile } from "../api/cms";
import { toast } from "sonner";

const ForgotPasswordReset = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        newPassword: "",
        confirmPassword: ""
    });
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const validateField = (name, value) => {
        let error = "";
        switch (name) {
            case "newPassword":
                if (!value) error = "Password is required";
                else {
                    const hasUpper = /[A-Z]/.test(value);
                    const hasLower = /[a-z]/.test(value);
                    const hasNumber = /\d/.test(value);
                    const hasSpecial = /[^A-Za-z0-9]/.test(value);
                    const hasNoSpaces = !/\s/.test(value);
                    const isLongEnough = value.length >= 8;

                    if (!(hasUpper && hasLower && hasNumber && hasSpecial && hasNoSpaces && isLongEnough)) {
                        error = "Password must be at least 8 character must contain upper case,lower case, number, special character no spaces.";
                    }
                }
                break;
            case "confirmPassword":
                if (!value) error = "Confirm Password is required";
                else if (value !== formData.newPassword) error = "Passwords do not match";
                break;
            default:
                break;
        }
        setErrors(prev => ({ ...prev, [name]: error }));
        return error;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        validateField(name, value);
        if (name === "newPassword" && formData.confirmPassword) {
            validateField("confirmPassword", formData.confirmPassword);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErr = validateField("newPassword", formData.newPassword);
        const confErr = validateField("confirmPassword", formData.confirmPassword);

        if (newErr || confErr) return;

        setIsLoading(true);
        try {
            let userStr = localStorage.getItem("user");
            let email = "";
            if (userStr) {
                email = JSON.parse(userStr).email;
            }

            const response = await updateProfile({
                newPassword: formData.newPassword,
                confirmPassword: formData.confirmPassword,
                email,
                type: "forgot_reset"
            });

            if (response.success || response.status === 200) {
                toast.success(response.message || "Password updated successfully.");
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                navigate("/login", { replace: true });
            } else {
                toast.error(response.message || "Failed to reset password.");
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || "An unexpected error occurred.";
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen" style={{ backgroundImage: `url(${shipp})`, backgroundSize: "cover", backgroundPosition: "center", width: "100%" }}>
            <div className="flex flex-col text-white gap-5 items-center justify-center bg-[#2D413F] backdrop-blur-md rounded-[22px] shadow-[0_25px_80px_rgba(0,0,0,0.6)] mt-[50px] mb-[50px] w-[90vw] py-10 px-8 sm:w-[500px] lg:w-[600px] 2xl:w-[650px]">
                <h1 className="text-[22px] sm:text-[26px] lg:text-[28px] xl:text-[35px] font-semibold text-center mb-4">Reset Password</h1>
                <form onSubmit={handleSubmit} className="flex flex-col items-start justify-center gap-4 w-full">
                    <div className="flex flex-col gap-1 w-full relative">
                        <label className="text-[13px] sm:text-[14px] xl:text-[18px] font-semibold">New Password</label>
                        <input type={showNew ? "text" : "password"} name="newPassword" value={formData.newPassword} onChange={handleChange} className={`text-[13px] sm:text-[14px] xl:text-[16px] text-white border ${errors.newPassword ? 'border-red-500' : 'border-[#4E6B5D]'} rounded-[16px] bg-transparent py-2 xl:py-3 px-5 w-full focus:outline-none`} placeholder="Enter New Password" />
                        <div onClick={() => setShowNew(!showNew)} className="absolute right-4 top-[50%] -translate-y-[50%] mt-4 cursor-pointer text-white/50 hover:text-white">
                            {showNew ? <FaEyeSlash /> : <FaEye />}
                        </div>
                        {errors.newPassword && <p className="text-red-400 text-xs">{errors.newPassword}</p>}
                    </div>

                    <div className="flex flex-col gap-1 w-full relative">
                        <label className="text-[13px] sm:text-[14px] xl:text-[18px] font-semibold">Confirm Password</label>
                        <input type={showConfirm ? "text" : "password"} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className={`text-[13px] sm:text-[14px] xl:text-[16px] text-white border ${errors.confirmPassword ? 'border-red-500' : 'border-[#4E6B5D]'} rounded-[16px] bg-transparent py-2 xl:py-3 px-5 w-full focus:outline-none`} placeholder="Confirm New Password" />
                        <div onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-[50%] -translate-y-[50%] mt-4 cursor-pointer text-white/50 hover:text-white">
                            {showConfirm ? <FaEyeSlash /> : <FaEye />}
                        </div>
                        {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword}</p>}
                    </div>

                    <div className="flex items-center justify-center w-full mt-5">
                        <button disabled={isLoading} type="submit" className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)] text-black font-bold text-[17px] sm:text-[19px] rounded-full h-[60px] w-[180px] sm:h-[70px] sm:w-[240px] transition-all flex items-center justify-center gap-2 disabled:opacity-70 hover:scale-105">
                            {isLoading ? <FaSpinner className="animate-spin" /> : null}
                            {isLoading ? "Resetting..." : "Reset Password"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ForgotPasswordReset;
