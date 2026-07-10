import React, { useState, useEffect } from 'react'

import { man } from "../common/common-assets/assets-images";
import { RiArrowDropDownLine } from "react-icons/ri";
import { useNavigate } from 'react-router-dom';
import ProfileMain from '../components/ProfileMain';
import Commonbanner from '../components/Commonbanner';
import { getUserCookies } from '../api/cms';

const Profile = () => {

  const navigate = useNavigate();

  let token = localStorage.getItem("token");
  let user = localStorage.getItem("user");
  let userdetail = JSON.parse(user);
  const [detail, setDetail] = useState(userdetail);
  const [userCookies, setUserCookies] = useState([]);

  useEffect(() => {
    const fetchCookies = async () => {
      try {
        const response = await getUserCookies();
        if (response.status) {
          console.log("response-=======123==>>>>", response.body);
          setUserCookies(response.body);
        }
      } catch (error) {
        console.error("Failed to fetch user cookies:", error);
      }
    };
    fetchCookies();
  }, []);

  return (
    <>

      <Commonbanner title="My Profile" />

      <div className='bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] py-20'>
        <div className='container mx-auto flex flex-col lg:flex-row justify-center items-start pb-[20px] py-20 gap-5'>
          <div className='w-full lg:w-[30%]'><ProfileMain /></div>

          <div className='w-full shadow-sm bg-[#2D413F] rounded-[18px] lg:w-[70%]'>
            <div className='w-full xl:mt-0 container mx-auto flex flex-col sm:flex-row items-center justify-around px-0 py-2'>
              <div className='w-full sm:w-[50%]'>
                <p className='text-[22px] font-bold text-white'>My Profile</p>
                <form action='' className='flex flex-col gap-3 py-5 w-full'>
                  <div className="flex flex-col gap-1 w-full mt-5">
                    <label className="text-[14px] lg:text-[15px] text-white opacity-70 font-medium">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={detail.firstName || detail.name || ""}
                      className="text-[12px] rounded-[10px] focus:outline-none sm:text-[12px] xl:text-[14px] text-white font-bold py-2 w-full bg-transparent"
                      name=""
                      id=""
                      disabled
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1 w-full mt-5">
                    <label className="text-[14px] lg:text-[15px] text-white opacity-70 font-medium">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={detail.lastName || ""}
                      className="text-[12px] rounded-[10px] focus:outline-none sm:text-[12px] xl:text-[14px] text-white font-bold py-2 w-full bg-transparent"
                      name=""
                      id=""
                      disabled
                    />
                  </div>

                  <div className="flex flex-col gap-1 w-full mt-2">
                    <label className="text-[14px] lg:text-[15px] text-white opacity-70 font-medium">
                      Email
                    </label>
                    <input
                      type="text"
                      value={detail.email || ""}
                      className="text-[12px] rounded-[10px] focus:outline-none sm:text-[12px] xl:text-[14px] text-white font-bold py-2 w-full bg-transparent"
                      name=""
                      id=""
                      disabled
                    />
                  </div>

                  <div className="flex flex-col gap-1 relative w-full max-w-[550px] mt-2">
                    <label className="text-[14px] lg:text-[15px] text-white opacity-70 font-medium">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={`${detail.countryCode || ""} ${detail.phoneNumber || detail.number || ""}`}
                      className="text-[12px] rounded-[10px] focus:outline-none sm:text-[12px] xl:text-[14px] text-white font-bold py-2 w-full bg-transparent"
                      disabled
                    />
                  </div>

               

                  <div className="flex flex-col gap-1 w-full mt-2">
                    <label className="text-[14px] lg:text-[15px] text-white opacity-70 font-medium">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={detail.streetAddress || ""}
                      className="text-[12px] rounded-[10px] focus:outline-none sm:text-[12px] xl:text-[14px] text-white font-bold py-2 w-full bg-transparent"
                      disabled
                    />
                  </div>

                  <div className="flex flex-col gap-1 w-full mt-2">
                    <label className="text-[14px] lg:text-[15px] text-white opacity-70 font-medium">
                      City
                    </label>
                    <input
                      type="text"
                      value={detail.city || ""}
                      className="text-[12px] rounded-[10px] focus:outline-none sm:text-[12px] xl:text-[14px] text-white font-bold py-2 w-full bg-transparent"
                      disabled
                    />
                  </div>

                  <div className="flex flex-col gap-1 w-full mt-2">
                    <label className="text-[14px] lg:text-[15px] text-white opacity-70 font-medium">
                      State
                    </label>
                    <input
                      type="text"
                      value={detail.state || ""}
                      className="text-[12px] rounded-[10px] focus:outline-none sm:text-[12px] xl:text-[14px] text-white font-bold py-2 w-full bg-transparent"
                      disabled
                    />
                  </div>

                  {/* Coordinates Section (Optional - can be hidden if not needed) */}
                  {/* {(detail.latitude || detail.longitude) && (
                    <>
                      <div className="flex flex-col gap-1 w-full mt-2">
                        <label className="text-[14px] lg:text-[15px] text-white opacity-70 font-medium">
                          Latitude
                        </label>
                        <input
                          type="text"
                          value={detail.latitude || ""}
                          className="text-[12px] rounded-[10px] focus:outline-none sm:text-[12px] xl:text-[14px] text-white font-bold py-2 w-full bg-transparent"
                          disabled
                        />
                      </div>

                      <div className="flex flex-col gap-1 w-full mt-2">
                        <label className="text-[14px] lg:text-[15px] text-white opacity-70 font-medium">
                          Longitude
                        </label>
                        <input
                          type="text"
                          value={detail.longitude || ""}
                          className="text-[12px] rounded-[10px] focus:outline-none sm:text-[12px] xl:text-[14px] text-white font-bold py-2 w-full bg-transparent"
                          disabled
                        />
                      </div>
                    </>
                  )} */}

                  <button onClick={() => navigate('/reset')} text="Submit" className="!w-[80%] !sm:w-[40%]"></button>
                </form>

                {detail?.survey && (
                  <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-[20px] font-bold text-white mb-4">My Shipping Priorities</p>
                    <div className="flex flex-wrap gap-2">
                      {detail.survey.split(',').map((val) => {
                        const mapper = {
                          "1": "Fastest Delivery",
                          "2": "Safety & Reliability",
                          "3": "Lowest Cost"
                        };
                        return (
                          <span
                            key={val}
                            className="px-4 py-2 rounded-full bg-[#FCC604]/20 text-[#FCC604] border border-[#FCC604]/30 text-sm font-medium"
                          >
                            {mapper[val] || val}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {userCookies.length > 0 && (
                  <div className="mt-8">
                    <p className="text-[20px] font-bold text-white mb-4">Accepted Cookies</p>
                    <div className="grid grid-cols-1 gap-3">
                      {userCookies.map((uc) => (
                        <div key={uc.id} className="bg-white/5 border border-white/10 p-3 rounded-xl">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-white font-semibold text-sm">{uc?.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className='h-full w-full sm:w-[50%] flex items-center justify-center'>
                <img src={man} className='w-[300px] sm:w-full h-full mt-5 sm:mt-10 md:mt-15 mb-5' alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Profile