import React, { useState } from "react";
import { FaCheckCircle } from "react-icons/fa";

import {visa,creditcardd,bin} from "../common/common-assets/assets-images";
import Commonbanner from "../components/Commonbanner";
import { useNavigate } from "react-router-dom";

const Cards = ({ headingText = "Cards"}) => {
  const [selected, setSelected] = useState("visa");

  const cards = [
    { id: "visa", label: "**** **** **** 1234", icon: visa },
    { id: "master", label: "**** **** **** 1234", icon: creditcardd },

  ];

const navigate = useNavigate();

  return (
   <div className="bg-gradient-to-b from-[#244536] via-[#1b352b] to-[#0b1914]  py-20">
    <Commonbanner title="My Cards"/>
     <div className="container mx-auto text-white flex flex-col lg:flex-row gap-10 mt-20  w-full">
      {/* Left: Existing Cards */}
      <div className="w-full lg:w-1/2 custom-shadow rounded-[30px] p-6 bg-[#2D413F]">
        <h2 className="text-[25px] font-bold mb-5">{headingText}</h2>
        <div className="space-y-3">
          {cards.map((card) => (
            <label
              key={card.id}
              onClick={() => setSelected(card.id)}
              className={`flex items-center justify-between w-full px-4 py-3 border border-[#D9D9D9] rounded-[10px] cursor-pointer ${
                selected === card.id 
              }`}
            >
            <div className="flex items-center gap-3">
  <img src={card.icon} alt={card.id} className="w-[26px]" />

  {card.id === "visa" ? (
    <div className="">{card.label}</div>
  ) : (
    <span className="text-sm font-medium">{card.label}</span>
  )}
</div>

           <div className="rounded-full  p-1.5">
             <img src={bin} className="h-[18px]"  alt="" />
           </div>
            </label>
          ))}
        </div>
             <div className="flex items-center justify-center w-full mt-3 sm:mt-5 xl:mt-10">
              <button onClick={()=> navigate("/profile")}
                type="submit"
                className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
              text-black font-bold text-[17px] sm:text-[19px]
              rounded-full
              h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
              transition-all" 
              >
              Save
              </button>
                        </div>
 
      </div>

      {/* Right: Add New Card Form */}
      <div className="w-full lg:w-1/2 custom-shadow rounded-[30px] bg-[#2D413F]  p-6">
        <h2 className="text-[25px] font-bold mb-5">+ Add New Card</h2>

        <div className="space-y-4">
          <div>
            <label className="text-[14px] font-normal">Card Holder Name</label>
            <input
              type="text"
              placeholder="Enter"
              className="w-full border border-gray-300 rounded-[10px] px-4 py-2 mt-1"
            />
          </div>

          <div>
            <label className="text-[14px] font-normal">Card Number</label>
            <input
              type="text"
              placeholder="Enter"
              className="w-full border border-gray-300 rounded-[10px] px-4 py-2 mt-1"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-[70%]">
              <label className="text-[14px] font-normal">Expiry Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-[10px] text-white px-4 py-2 mt-1"
              />
            </div>

            <div className="w-full sm:w-[30%]">
              <label className="text-[14px] font-normal">CVC</label>
              <input
                type="text"
                placeholder="Enter"
                className="w-full border border-gray-300 rounded-[10px] px-4 py-2 mt-1"
              />
            </div>
          </div>

                <div className="flex items-center justify-center w-full mt-3 sm:mt-5 xl:mt-10">
                               <button onClick={()=> navigate("/profile")}
                type="submit"
                className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
              text-black font-bold text-[17px] sm:text-[19px]
              rounded-full
              h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
              transition-all" 
              >
             Save
              </button>
                        </div>
        </div>
      </div>
    </div>
   </div>
  );
};

export default Cards;
