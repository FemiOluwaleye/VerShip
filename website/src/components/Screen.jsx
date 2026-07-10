import React, { useState } from "react";
import { FiMoreVertical, FiSend } from "react-icons/fi";
import { message1, message2 } from "../common/common-assets/assets-images";
import ReportPopup from "./ReportPopup";

const Screen = ({ activeChat, setActiveChat }) => {
if (!activeChat) {
  return (
    <div className="hidden lg:flex lg:w-[60%] bg-[#2D413F] rounded-[12px] items-center justify-center text-white text-lg">
      Select a chat to start conversation
    </div>
  );
}
const [isOpen, setIsOpen] = useState(false)
const [show, setshow] = useState(false)
  return (
    <div  className={`w-full bg-[#2D413F] rounded-[10px] flex flex-col
      
  ${activeChat ? "block" : "hidden lg:flex lg:w-[60%]"}`}>

      {/* HEADER */}
        
    <div className="bg-[#162821] rounded-t-[12px]">
      <div className="flex items-center justify-start">
          <button
      onClick={() => setActiveChat(null)}
      className="lg:hidden text-white text-sm px-6 pt-3 font-semibold mr-2"
    >
      ← Back
    </button>
        </div>
        <div className="flex items-center justify-between px-6 py-6 ">
        
        <div className="flex items-center gap-3">
           
          <img
            src={activeChat.img}
            alt=""
            className="w-[55px] h-[55px] rounded-full"
          />
          <p className="text-white font-semibold text-[16px]">
            {activeChat.name}
          </p>
        </div>

       <div className="relative">
         <FiMoreVertical onClick={()=> setshow(true)} className="relative text-white text-xl cursor-pointer" />
          {show && (
              <div onClick={()=> setIsOpen(true)} className="absolute top-[20px] right-[-20px] bg-white rounded-[10px]">
            <p className="text-[14px] font-medium py-3 px-8">Report</p>
            <ReportPopup isOpen={isOpen} onClose={()=> setIsOpen(false)}/>
          </div>
           )}
       </div>
      </div>
    </div>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        {/* LEFT MESSAGE */}
        <div className="flex items-start gap-3 max-w-full sm:max-w-[70%]">
          <img
            src={message1}
            className="w-[32px] h-[32px] rounded-full"
            alt=""
          />
          <div className="bg-[#6F7F7B] text-white text-[13px] px-4 py-3 rounded-[100px]">
            Hi John Marker, welcome to Lore, what can I help you?
          </div>
        </div>

        {/* RIGHT MESSAGE */}
        <div className="flex items-start gap-3 justify-end max-w-full sm:max-w-[70%] ml-auto">
          <div className="bg-[#FFC107] text-black text-[13px] px-4 py-3 rounded-[100px]">
            Hi Alex, yes.
          </div>
          <img
            src={message2}
            className="w-[32px] h-[32px] rounded-full"
            alt=""
          />
        </div>

        {/* RIGHT MESSAGE */}
        <div className="flex items-start gap-3 justify-end max-w-full sm:max-w-[70%] ml-auto">
          <div className="bg-[#FFC107] text-black text-[13px] px-4 py-3 rounded-[100px]">
            I want to opening an account
          </div>
          <img
            src={message2}
            className="w-[32px] h-[32px] rounded-full"
            alt=""
          />
        </div>

        {/* LEFT MESSAGE */}
        <div className="flex items-start gap-3 max-w-full sm:max-w-[70%]">
          <img
            src={message1}
            className="w-[32px] h-[32px] rounded-full"
            alt=""
          />
          <div className="bg-[#6F7F7B] text-white text-[13px] px-4 py-3 rounded-[100px]">
            Hi John Marker, welcome to Lore, what can I help you?
          </div>
        </div>
      </div>

      {/* INPUT */}
      <div className="px-6 py-5">
        <div className="relative bg-white rounded-[15px]">
          <input
            type="text"
            placeholder="Write message..."
            className="w-full rounded-[14px] py-4 pl-5 pr-14 text-[14px] outline-none"
          />
          <button className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#FFC107] p-2 rounded-full">
            <FiSend className="text-black" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Screen;
