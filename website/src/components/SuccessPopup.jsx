import React from "react";
import { createPortal } from "react-dom";
import { success } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";


const SuccessPopup = ({ isOpen, onClose, title, message, buttonText }) => {
  if (!isOpen) return null;
  const navigate = useNavigate();
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
      <div className="bg-white rounded-[35px] shadow-lg px-6 py-8 w-[320px] sm:w-[400px] text-center relative">

        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 text-2xl text-red-500 hover:text-red-700"
        >
          ✕
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4">
          <img src={success} alt="" />
        </div>

        {/* Title */}
        <h2 className="text-[30px] font-bold mb-2">{title || "Success"}</h2>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          {message || "Congratulations, your account has been successfully updated."}
        </p>

        {/* Buttons */}
        <div className="flex justify-center w-full gap-4">
          <button onClick={(e) => {
            e.stopPropagation();
            onClose();
            navigate("/request")
          }}
            type="submit"
            className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]


              text-black font-bold text-[17px] sm:text-[19px]
              rounded-full
              h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
              transition-all"
          >
            {buttonText || "OK"}
          </button>


        </div>
      </div>
    </div>,
    document.body
  );
};

export default SuccessPopup;
