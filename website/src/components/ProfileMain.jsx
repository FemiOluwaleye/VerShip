import React, { useState } from "react";
import {
  profile,
  profile1,
  edit,
  reset,
  creditCard,
  deleteAccount,
  camera,
  logo,
} from "../common/common-assets/assets-images";
import { FaStar } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../api/axios";
const ProfileMain = () => {
  const rawUser = JSON.parse(localStorage.getItem("user") || "{}");
  const initialDetail = rawUser?.user || rawUser;
  const role = initialDetail?.role;
  const navigate = useNavigate();
  const [active, setActive] = useState("profile");
  let token = localStorage.getItem("token");

  const [detail, setDetail] = useState(initialDetail);

  React.useEffect(() => {
    const handleUserUpdate = () => {
      const updatedRaw = JSON.parse(localStorage.getItem("user") || "{}");
      setDetail(updatedRaw?.user || updatedRaw);
    };
    window.addEventListener('userUpdated', handleUserUpdate);
    return () => window.removeEventListener('userUpdated', handleUserUpdate);
  }, []);
  return (
    <div className="w-full h-fit flex flex-col items-center relative py-8 px-5 lg:px-6 shadow-sm bg-[#2D413F] rounded-[24px]">
      <div className="relative w-full">
        {/* Background image container with more integrated styling */}
        <div className="w-full h-[220px] sm:h-[250px] bg-white/5 rounded-[15px] border border-white/10 flex items-center justify-center overflow-hidden">
          {String(detail.role) === "1" ? (
            <img src={logo} alt="" className="h-full w-auto p-4 object-cover opacity-80" />
          ) : detail.image && detail.image.trim() !== "" ? (
            <img
              src={detail.image.startsWith("http") ? detail.image : `${API_URL}/${detail.image}?t=${new Date().getTime()}`}
              alt=""
              className="h-full w-full object-cover opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white font-bold text-[80px] opacity-60">
                {detail.firstName ? detail.firstName[0].toUpperCase() : "U"}
              </span>
            </div>
          )}
        </div>

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#2D413F] via-transparent to-transparent"></div>

        {/* Text content */}
        <div className="absolute bottom-4 left-4 text-white z-10 w-[calc(100%-2rem)]">
          <p className="text-[18px] font-bold truncate">
            {detail.firstName}
          </p>
          <p className="text-[12px] opacity-60 truncate">
            {detail.email}
          </p>
        </div>
      </div>

      <div className="w-full flex flex-col gap-3 mt-8">
        <button
          onClick={() => {
            role == "1"
              ? navigate("/profile")
              : navigate("/businessProfile");

            setActive("profile");
          }}
          className={`group flex cursor-pointer items-center gap-3 border border-[#4E6B5D] hover:bg-gradient-to-b from-[#2C4736] to-[#09120F] text-white  rounded-[10px] text-[14px] lg:text-[16px] font-medium py-[8px] lg:py-[10px] xl:py-[15px] pl-[20px] w-[100%] 2xl:w-[95%] text-left`}
        >
          <img
            src={profile}
            className="filter transition w-[18px] duration-300 group-hover:invert group-hover:brightness-0"
            alt="Profile"
          />
          My Profile
        </button>

        <button
          onClick={() => {
            role == "1" ? navigate("/edit") : navigate("/businesseditnext");
          }}
          className="group cursor-pointer flex items-center gap-3 border border-[#4E6B5D] hover:bg-gradient-to-b from-[#2C4736] to-[#09120F] text-white rounded-[10px] text-[14px] lg:text-[16px] font-medium py-[8px] lg:py-[10px] xl:py-[15px] pl-[20px] w-[100%] 2xl:w-[95%] text-left"
        >
          <img
            src={edit}
            className="filter transition w-[18px] duration-300 group-hover:invert group-hover:brightness-0"
            alt="Profile"
          />
          Edit Profile
        </button>
        <button
          onClick={() => navigate("/reset")}
          className="group flex items-center gap-3 border cursor-pointer border-[#4E6B5D] hover:bg-gradient-to-b from-[#2C4736] to-[#09120F]  text-white rounded-[10px] text-[14px] lg:text-[16px] font-medium py-[8px] lg:py-[10px] xl:py-[15px] pl-[20px] w-[100%] 2xl:w-[95%] text-left"
        >
          <img
            src={reset}
            className="filter transition w-[18px] duration-300 group-hover:invert group-hover:brightness-0"
            alt="Profile"
          />
          Reset Password
        </button>

        {/* {role && role == "user" && (
          <button
            onClick={() => navigate("/cards")}
            className="group cursor-pointer flex items-center gap-3 border border-[#4E6B5D] hover:bg-gradient-to-b from-[#2C4736] to-[#09120F] text-white rounded-[10px] text-[14px] lg:text-[16px] font-medium py-[8px] lg:py-[10px] xl:py-[15px] pl-[20px] w-[100%] 2xl:w-[95%] text-left"
          >
            <img
              src={creditCard}
              className="filter transition w-[18px] duration-300 group-hover:invert group-hover:brightness-0"
              alt="Profile"
            />
            My Cards
          </button>
        )} */}

        <button
          onClick={() => navigate("/delete")}
          className="group flex cursor-pointer items-center gap-3 border border-[#4E6B5D] hover:bg-gradient-to-b from-[#2C4736] to-[#09120F] text-white rounded-[10px] text-[14px] lg:text-[16px] font-medium py-[8px] lg:py-[10px] xl:py-[15px] pl-[20px] w-[100%] 2xl:w-[95%] text-left"
        >
          <img
            src={deleteAccount}
            className="filter transition w-[16px] duration-300 group-hover:invert group-hover:brightness-0"
            alt="Profile"
          />
          Delete Account
        </button>
      </div>
    </div>
  );
};

export default ProfileMain;
