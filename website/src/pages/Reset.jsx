import React, { useState } from 'react'

import { man } from "../common/common-assets/assets-images";
import { RiArrowDropDownLine } from "react-icons/ri";
import { useNavigate } from 'react-router-dom';
import ProfileMain from '../components/ProfileMain';
import Commonbanner from '../components/Commonbanner';
import { FaEye, FaEyeSlash, FaSpinner } from "react-icons/fa";
import { updateProfile } from '../api/cms';
import { toast } from 'sonner';

const Reset = () => {

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();


  let token = localStorage.getItem("token");

  let user = localStorage.getItem("user");

  let userdetail = JSON.parse(user || "{}");

  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "oldPassword":
        if (!value) error = "Old password is required";
        break;
      case "newPassword":
        if (!value) error = "New password is required";
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
        if (!value) error = "Confirm password is required";
        else if (value !== newPassword) error = "Passwords do not match";
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const oldErr = validateField("oldPassword", oldPassword);
    const newErr = validateField("newPassword", newPassword);
    const confErr = validateField("confirmPassword", confirmPassword);

    if (oldErr || newErr || confErr) {
      return;
    }

    setIsLoading(true);
    try {
      let response = await updateProfile({ oldPassword, newPassword, confirmPassword, email: userdetail.email, type: "reset" })
      console.log("response", response);
      if (response.status === 200 || response.success === true) {
        toast.success(response.message || "Password updated successfully");

        localStorage.removeItem("role");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.clear();
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Server error occurred";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <>

      <Commonbanner title="Reset Password" />

      <div className='bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] py-20'>
        <div className='container mx-auto flex flex-col lg:flex-row  justify-center  pb-[20px]  py-20  gap-5'>
          <div className='w-full lg:w-[30%]'><ProfileMain /></div>

          <div className=' w-full shadow-sm bg-[#2D413F] rounded-[18px] lg:w-[70%]'>
            {/* <div className='flex items-center justify-start w-full bg-[#F5F5F5] rounded-[18px] '>
  <p className='fs-20  fw-600 py-5 px-[10px] lg:px-[20px] '>Edit Profile</p>
  </div> */}
            <div className='w-full xl:mt-0 container mx-auto flex flex-col sm:flex-row items-center justify-around gap-10 px-0 py-2 '>

              <div className='w-full sm:w-[50%] '>
                <p className='text-[22px] font-bold text-white '>Reset Password</p>
                <form className="flex flex-col gap-6 py-5 w-full max-w-[500px]" onSubmit={handleSubmit}>

                  {/* Old Password */}
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[18px] font-medium">
                      Old Password
                    </label>

                    <div className="relative">
                      <input
                        type={showOld ? "text" : "password"}
                        value={oldPassword}
                        placeholder='**************'
                        onChange={(e) => {
                          setOldPassword(e.target.value);
                          validateField("oldPassword", e.target.value);
                        }}
                        className={`w-full bg-transparent border ${errors.oldPassword ? 'border-red-500' : 'border-[#4E6B5D]'}
              rounded-[16px] py-4 px-5 pr-12
              text-white font-bold
              focus:outline-none`}
                      />

                      <div
                        onClick={() => setShowOld(!showOld)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 cursor-pointer text-gray-300"
                      >
                        {showOld ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                      </div>
                    </div>
                    {errors.oldPassword && (
                      <p className="text-red-400 text-sm">{errors.oldPassword}</p>
                    )}
                  </div>

                  {/* New Password */}
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[18px] font-medium">
                      New Password
                    </label>

                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        placeholder='**************'
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          validateField("newPassword", e.target.value);
                          if (confirmPassword) validateField("confirmPassword", confirmPassword);
                        }}
                        className={`w-full bg-transparent border ${errors.newPassword ? 'border-red-500' : 'border-[#4E6B5D]'}
              rounded-[16px] py-4 px-5 pr-12
              text-white font-bold
              focus:outline-none`}
                      />

                      <div
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 cursor-pointer text-gray-300"
                      >
                        {showNew ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                      </div>
                    </div>
                    {errors.newPassword && (
                      <p className="text-red-400 text-sm">{errors.newPassword}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="flex flex-col gap-2">
                    <label className="text-white text-[18px] font-medium">
                      Confirm Password
                    </label>

                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        placeholder='**************'
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          validateField("confirmPassword", e.target.value);
                        }}
                        className={`w-full bg-transparent border ${errors.confirmPassword ? 'border-red-500' : 'border-[#4E6B5D]'}
              rounded-[16px] py-4 px-5 pr-12
              text-white font-bold
              focus:outline-none`}
                      />

                      <div
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 cursor-pointer text-gray-300"
                      >
                        {showConfirm ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                      </div>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-red-400 text-sm">{errors.confirmPassword}</p>
                    )}
                  </div>

                  {/* Update Button */}
                  <div className="flex justify-start mt-8">
                    <button
                      disabled={isLoading}
                      type="submit"
                      className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
            text-black font-bold text-[18px]
            rounded-full h-[65px] w-[240px]
            transition-all hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? <FaSpinner className="animate-spin" /> : "Update"}
                    </button>
                  </div>

                </form>
              </div>
              <div className=' h-full w-full sm:w-[50%]  flex items-center justify-center'><img src={man} className='w-[300px] sm:w-full h-full mt-5 sm:mt-10 md:mt-15 mb-5 ' alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Reset
