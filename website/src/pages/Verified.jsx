import React, { useState, useEffect } from 'react';
import { FaCheck } from 'react-icons/fa6';
import SuccessPopup from '../components/SuccessPopup';
import { shipp, verified } from '../common/common-assets/assets-images';
import { useNavigate } from 'react-router-dom';

const Verified = () => {

  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const currentState = window.history.state;

    // Create a safety buffer while preserving React Router's state object
    window.history.pushState(currentState, '', window.location.href);
    window.history.pushState(currentState, '', window.location.href);

    const handlePopState = () => {
      window.history.pushState(currentState, '', window.location.href);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return (
    <div>
      <div
        className="flex items-center justify-center"
        style={{
          backgroundImage: `url(${shipp})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          width: "100%",
        }}
      >
        <div className=" flex items-center justify-center min-h-screen">
          <div className="flex flex-col text-white gap-5 lg:gap-10 md:mx-[50px] lg:mx-[60px] xl:mx-[100px] items-center justify-center bg-[#2D413F] backdrop-blur-md rounded-xl mt-[50px] mb-[50px] w-[85vw] py-7 sm:py-15 px-6 sm:w-[500px] lg:w-[600px] 2xl:w-[700px]">
            <div className='text-center'>
              <h1 className="text-[22px] sm:text-[26px] lg:text-[28px] xl:text-[35px] mt-10 font-semibold">
                Become A Verified Freight Forwarder

              </h1>
              <div className='flex items-center justify-center my-5'><img src={verified} className='w-[280px]' alt="" /></div>
              <div>
                <p className="text-center mx-[15px] sm:mx-[40px] text-[13px] sm:text-[14px] md:text-[16px] lg:text-[18px] font-normal mt-3">
                  Complete a quick verification process to unlock trusted status, faster approvals, and more visibility
                </p>
              </div>
            </div>



            <div>
              <div className="flex items-center justify-center w-full mb-3 sm:mb-5 mt-5">
                <button onClick={() => {
                  setIsOpen(true);
                  navigate('/businessdoument')
                }}
                  type="submit"
                  className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
              text-black font-bold text-[17px] sm:text-[19px]
              rounded-full
              h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
              transition-all"
                >
                  Start Verification
                </button>
                <SuccessPopup isOpen={isOpen} onClose={() => setIsOpen(false)} />
              </div>
              <p className='text-[12px] font-normal text-center'>Take less than 2 mins</p>

              {/*          
              {showpopup && (
                <div className="flex flex-col items-center justify-center absolute bottom-50 left-35 right-35 gap-4 bg-white text-black p-10 rounded-2xl mt-5">
                  <FaCheck className="rounded-full p-2 bg-green-500 text-white w-10 h-10 text-xl flex items-center justify-center" />
                  <p className="text-black font-bold text-lg">Success</p>
                  <p className="text-black text-center">
                    Congratulations, your account has been successfully created.
                  </p>

                

                  <button
                    onClick={() => setshowpopup(false)}
                    className="text-black bg-[#0866FF] font-semibold rounded-xl h-10 w-40 sm:h-12 sm:w-48"
                  >
                    Ok
                  </button>
                </div>
              )} */}

              {/* <p className="border-b border-white cursor-pointer w-fit mx-auto text-white leading-none pb-[2px]">
                Resend
              </p> */}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default Verified;
