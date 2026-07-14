import React, { useState } from 'react'
import Commonbanner from "./Commonbanner";
import { tick } from "../common/common-assets/assets-images";
import { check } from "../common/common-assets/assets-images";
import { box, card, close } from "../common/common-assets/assets-images";

const ShipmentDetailsSection = () => {
  const [openModal, setOpenModal] = useState(false);
  const [openSuccessModal, setOpenSuccessModal] = useState(false);
  const [active, setActive] = useState(1);
  return (
    <div>
      <Commonbanner title="Detail" />
      <div className="w-full bg-[#0E1F17] py-15 px-4 md:px-8">
        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT CONTENT */}
          <div className="lg:col-span-2 space-y-6">

            {/* Shipper Card */}
            <div className="bg-[#2D413F] rounded-xl p-[25px] text-white">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="
  w-[80px] h-[80px] 
  rounded-full 
  flex items-center justify-center
  bg-[radial-gradient(circle_at_center,#FFD95A_0%,#FFC928_45%,#FFB800_100%)]
">
                    <span className="text-black text-[36px] font-bold">KT</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[25px]">Kylie Transportation</h4>
                    <div className="flex items-center gap-2 text-sm text-white">
                      <i class="fa-solid fa-star text-[#FFBF00]"></i> <i class="fa-solid fa-star text-[#FFBF00]"></i> <i class="fa-solid fa-star text-[#FFBF00]"></i> <i class="fa-solid fa-star text-[#FFBF00]"></i> 4.5
                      <span className="ms-5 text-[13px] font-semibold gap-1 flex align-middle"><img src={tick} alt="" /> Verified  Freight Forwarder</span>
                    </div>
                  </div>
                </div>
                <div className='flex flex-col text-end'>
                  <p className='text-[16px] font-semibold text-[#FF9900] mb-3'>Dispatched</p>
                  <button className="border border-white/30 px-14 py-2.5 rounded-full text-lg hover:bg-white hover:text-black transition font-semibold">
                    Chat
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <h5 className="font-bold text-lg mb-2">Descriptions</h5>
                <p className="text-gray-300 text-md leading-relaxed">
                  Lorem Ipsum is simply dummy text of the printing and typesetting industry.
                  Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-10 text-sm text-gray-200 border-1 p-3 px-4 rounded-[10px] border-[#676767] justify-center">
                {/* <p><span className="text-white">Price:</span> JMD1500</p> */}
                <p><span className="text-white">Delivery Time:</span> 3–5 Business Days</p>
              </div>
            </div>

            {/* Customs Handling Policies */}
            <div className=" text-white">
              <h5 className="font-bold text-lg mb-3 text-lg">Customs Handling Policies</h5>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className='flex text-[16px] items-center gap-3'><img src={check} alt="" /> Standard: Handles all necessary customs declarations.</li>
                <li className='flex text-[16px] items-center gap-3 mb-4'><img src={check} alt="" /> Premium: Expedited customs clearance ($75 fee).</li>
                <li className="text-yellow-400 flex items-center  gap-3 text-lg ps-1"><img src={box} alt="" /> Delivery Service Available</li>
              </ul>
            </div>

            {/* Address */}
            <div className="bg-[#2D413F] rounded-xl p-5 text-white grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-white font-semibold text-md mb-3"><i class="fa-solid fa-location-dot text-[#FFBF00] me-3"></i>Shipper Address</p>
                <p className='text-gray-100'>3 Newbridge Court, Chino Hills, CA 91709, USA</p>
              </div>
              <div>
                <p className="text-white font-semibold text-md mb-3"><i class="fa-solid fa-location-dot text-[#FFBF00] me-3"></i>Delivery Address</p>
                <p>Chino Hills, CA 91709, USA</p>
              </div>
              <div>
                <p className="text-white font-semibold text-md mb-3"><i class="fa-solid fa-location-dot text-[#FFBF00] me-3"></i>Origin</p>
                <p>New York</p>
              </div>
              <div>
                <p className="text-white font-semibold text-md mb-3"><i class="fa-solid fa-location-dot text-[#FFBF00] me-3"></i>Destination</p>
                <p>New York</p>
              </div>
            </div>

            {/* Product Info */}
            <div className=" bg-[#2D413F]  rounded-xl p-5 text-white">
              <div className=" text-md mb-4">
                <p className='flex justify-between'>Product Type: <span className="font-semibold">Parcel</span></p>
              </div>
              <p className='flex justify-between mb-2'>Load Details : </p>
              <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-white/5 p-2 px-4 rounded-[14px] mb-2">
                <div>
                  <p className=" text-md  text-white mb-2">Quantity</p>
                  <p className="font-semibold text-sm">2 Pairs</p>
                </div>
                <div>
                  <p className="text-md  text-white mb-2">Dimensions</p>
                  <p className="font-semibold text-sm">32 × 22 × 14 (inches)</p>
                </div>
                <div>
                  <p className="text-md  text-white mb-2">Weight</p>
                  <p className="font-semibold text-sm">0.9 lbs</p>
                </div>
              </div>

              <div className=" text-md mb-3">
                <p className='flex justify-between'>Load Type: <span className="font-semibold">20 ft Container FCL</span></p>
              </div>
              <div className=" text-md mb-3">
                <p className='flex justify-between'>Add-ons: <span className="font-semibold">Nil</span></p>
              </div>
              <p className='flex justify-between mb-2'>Consignee Contact Information</p>
              <div className="mb-3  mb-2 bg-white/5 p-2 px-4 rounded-[14px]">
                <p className='flex justify-between mb-2 font-semibold'>Primary Contact</p>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-1 text-sm '>
                  <div className='flex gap-2'>
                    <p className=" text-md  text-white mb-1">Name</p>
                    <p className="font-semibold text-sm">John Marker</p>
                  </div>
                  <div className='flex gap-2'>
                    <p className=" text-md  text-white mb-1">Contact</p>
                    <p className="font-semibold text-sm">+123 4567 673</p>
                  </div>
                  <div className='flex gap-2'>
                    <p className=" text-md  text-white mb-2"><i class="fa-solid fa-location-dot text-[#FFBF00] me-2"></i>Chino Hills, CA 91709, United States</p>
                  </div>
                  <div className='flex gap-2'>
                    <p className=" text-md  text-white mb-2">Email</p>
                    <p className="font-semibold text-sm">John@gmail.com</p>
                  </div>
                </div>
                <p className='flex justify-between mb-2 font-semibold'>Secondary Contact</p>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-1 text-sm '>
                  <div className='flex gap-2'>
                    <p className=" text-md  text-white mb-1">Name</p>
                    <p className="font-semibold text-sm">John Marker</p>
                  </div>
                  <div className='flex gap-2'>
                    <p className=" text-md  text-white mb-1">Contact</p>
                    <p className="font-semibold text-sm">+123 4567 673</p>
                  </div>
                  <div className='flex gap-2'>
                    <p className=" text-md  text-white mb-2"><i class="fa-solid fa-location-dot text-[#FFBF00] me-2"></i>Chino Hills, CA 91709, United States</p>
                  </div>
                  <div className='flex gap-2'>
                    <p className=" text-md  text-white mb-2">Email</p>
                    <p className="font-semibold text-sm">John@gmail.com</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT */}
          <div className="space-y-6 text-center">
            <div className='flex justify-between text-white text-[20px] mb-2'>
              <p>Order ID</p><p><b>1234567</b></p>
            </div>
            {/* Order Summary */}
            <div className="bg-white rounded-xl p-5">
              <h4 className="font-bold text-lg mb-3 text-start">Order Summary</h4>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className='text-[16px] font-semibold text-black'>Subtotal</span>
                  <span className='text-[14px] font-semibold text-black/80'>JMD 140</span>
                </div>
                <div className="flex justify-between">
                  <span className='text-[16px] font-semibold text-black'>Pay Now (5%)</span>
                  <span className='text-[14px] font-semibold text-black/80'>JMD 7</span>
                </div>
                <hr className='text-black/20 my-2'></hr>
                <div className="flex justify-between">
                  <span className='text-[16px] font-semibold text-black'>Pay Later</span>
                  <span className='text-[14px] font-semibold text-black/80'>JMD 133</span>
                </div>
              </div>
            </div>
            <div className='bg-[#2D413F] rounded-xl p-5'>
              <div className='flex justify-between items-center'>
                <p className='m-0 text-lg font-bold text-white'>Payment Method</p>
                <img src={card} alt="" />
              </div>
            </div>
            <button
              onClick={() => setOpenModal(true)}
              className="mt-10 text-[15px] bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F] 
  text-black font-semibold px-20 py-[20px] rounded-full hover:brightness-110 transition"
            >
              Cancel Shipping
            </button>
          </div>
        </div>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white w-[100%] max-w-[384px] rounded-xl !py-8 !px-5 relative">

            {/* Header */}
            <div className="flex justify-center items-center mb-1 flex-col">
              <img src={close} alt="" />
              <h3 className="text-[28px] font-bold text-black">Cancel</h3>
              <button
                onClick={() => setOpenModal(false)}
                className="absolute right-4 top-4 w-[40px] h-[40px] bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-extrabold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-10">

              {/* LEFT : Cards */}
              <div className="p-0">
                <p className="font-bold text-md mb-0 text-center text-black/50">Are you sure want to Cancel Shipping?</p>




                <div className='text-center grid grid-cols-2 gap-2'>
                  <button
                    onClick={() => {
                      setOpenModal(false);
                      setOpenSuccessModal(true);
                    }}
                    className="text-md bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F] text-black font-semibold px-10 py-[20px] rounded-full hover:brightness-110 transition mt-10"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => {
                      setOpenModal(false);
                      setOpenSuccessModal(true);
                    }}
                    className="text-md bg-[#E5E5E5] text-black font-semibold px-10 py-[20px] rounded-full  transition mt-10"
                  >
                    No
                  </button>

                </div>
              </div>


            </div>
          </div>
        </div>
      )}

      {openSuccessModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white w-full max-w-[580px] rounded-3xl p-8 text-center relative shadow-2xl">

            {/* Close Button */}
            <button
              onClick={() => setOpenSuccessModal(false)}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold hover:bg-gray-200"
            >
              ✕
            </button>

            {/* Avatar */}
            <div className="flex justify-center mb-3">
              <div className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center text-2xl font-bold text-black">
                KT
              </div>
            </div>

            {/* Name */}
            <h3 className="text-lg font-semibold text-black mb-2">
              Kylie Transportation
            </h3>

            {/* Stars */}
            <div className="flex justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg
                  key={i}
                  className={`w-7 h-7 ${i <= 4 ? "text-yellow-400" : "text-gray-300"
                    }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.95a1 1 0 00.95.69h4.15c.969 0 1.371 1.24.588 1.81l-3.357 2.44a1 1 0 00-.364 1.118l1.286 3.95c.3.921-.755 1.688-1.54 1.118l-3.357-2.44a1 1 0 00-1.176 0l-3.357 2.44c-.785.57-1.84-.197-1.54-1.118l1.286-3.95a1 1 0 00-.364-1.118L2.025 9.377c-.783-.57-.38-1.81.588-1.81h4.15a1 1 0 00.95-.69l1.286-3.95z" />
                </svg>
              ))}
            </div>

            {/* Review Box */}
            <textarea
              placeholder="Your review..."
              className="w-full h-40 resize-none rounded-xl border border-gray-200 p-4 text-sm outline-none focus:ring-2 focus:ring-yellow-400 mb-6 shadow-sm"
            />

            {/* Buttons */}
            <div className="flex justify-center gap-4">
              <button
                className="bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F]
        text-black px-13 py-4 rounded-full font-semibold hover:brightness-110 transition"
              >
                Submit
              </button>

              <button
                className="bg-gray-200 text-gray-700 px-12 py-4 rounded-full font-semibold hover:bg-gray-300 transition"
              >
                Rate Later
              </button>
            </div>
          </div>
        </div>

      )}


    </div>
  )
}

export default ShipmentDetailsSection
