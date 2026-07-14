
import React from 'react'
import Commonbanner from "../components/Commonbanner";
import Seo from "../components/Seo";
import { men } from "../common/common-assets/assets-images";
import { useNavigate } from 'react-router-dom';

const Help = () => {
  const navigate = useNavigate();
  return (
    <div>
            <Seo title="24x7 Support" path="/help" description="VerShip support — get help with quotes, bookings, and shipping barrels from the USA to Jamaica, any time." />
            <Commonbanner title="24X7 Support" />
             <div className=" flex pt-10 pb-15 items-center justify-center bg-gradient-to-b from-[#1f3b2f] to-[#0b1a14] px-4">
      <div className="w-full max-w-[722px] text-center">
        
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className=" flex items-center justify-center">
            <img
              src={men}
              alt="Support"
              className=""
            />
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-white text-[24px] sm:text-[32px] font-semibold mb-8">
          Hello, How can we Help you ?
        </h2>

        {/* Buttons */}
        <div className="space-y-4">
          <button onClick={()=> navigate("/chat")} className="w-full curshor-pointer bg-[#2D413F] hover:bg-[#3a5650] transition-all text-white py-6 px-8 rounded-[13px] flex items-center justify-between text-sm sm:text-[31px] font-medium">
            <span>Contact Live Chat</span>
            <i class="fa-solid fa-chevron-right text-yellow-400"></i>
          </button>

          <button onClick={()=> navigate("/support")} className="w-full bg-[#2D413F] hover:bg-[#3a5650] transition-all text-white py-6 px-8 rounded-[13px] flex items-center justify-between text-sm sm:text-[31px] font-medium">
            <span>Send us an Email</span>
                 <i class="fa-solid fa-chevron-right text-yellow-400"></i>
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}

export default Help
