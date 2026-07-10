import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { shipp } from '../common/common-assets/assets-images';
import { useNavigate, useLocation } from 'react-router-dom';
import { verify } from '../api/cms';
import { resendOtp } from '../api/cms';
const Verification = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const inputRefs = useRef([]);
  const location = useLocation();
  const navigate = useNavigate();

  // Extract email from location.state
  const getEmailFromRoute = () => {
    if (!location.state) return "";

    if (typeof location.state === 'object') {
      return location.state.email ||
        location.state.userEmail ||
        location.state.user_email ||
        "";
    }

    if (typeof location.state === 'string') {
      return location.state;
    }

    return "";
  };

  const emailFromRoute = getEmailFromRoute();

  const handleOtpChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(0, 1);
    setOtp(newOtp);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Function to reset OTP fields
  const resetOtpFields = () => {
    setOtp(["", "", "", ""]);
    // Focus back to first input
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const otpString = otp.join('');

    if (otpString.length !== 4) {
      toast.error("Please enter complete 4-digit OTP");
      return;
    }

    if (!emailFromRoute) {
      toast.error("Email not found. Please try again.");
      return;
    }

    try {
      const response = await verify({ otp: otpString, email: emailFromRoute });

      if (response.success === true) {
        setIsOpen(true);
        toast.success("OTP verified successfully.");

        // Save token and user data to localStorage
        localStorage.setItem("token", response.body.authtoken);
        localStorage.setItem("user", JSON.stringify(response.body.user));

        // Notify app of user update
        window.dispatchEvent(new Event('userUpdated'));

        const user = response.body.user;
        const isForgot = location.state?.isForgot;
        const isBookingComplete = response.body.isBookingComplete;
        const isQuotesRedirect = response.body.isQuotesRedirect;
        const isShipOwn = response.body.isShipOwn;
        const pendingRequestId = response.body.pendingRequestId;

        setTimeout(() => {
          console.log("isForgot", isForgot);

          if (isBookingComplete) {
            navigate("/", { replace: true });
          } else if (isQuotesRedirect) {
            if (isShipOwn) {
              navigate("/quotes-shipown", { replace: true });
            } else {
              navigate("/quotes", { replace: true });
            }
          } else if (pendingRequestId) {
            navigate(`/barrel-request/${pendingRequestId}`, { replace: true });
          } else {
            navigate("/", { replace: true });
          }
        }, 1500);
      } else {
        toast.error(response.message || "Verification failed");
        resetOtpFields(); // Reset OTP fields on failure
      }
    } catch (error) {
      console.error("Verification error:", error);
      const errorMessage = typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : "Invalid OTP. Please try again.";
      toast.error(errorMessage);
      resetOtpFields(); // Reset OTP fields on error
    }
  };

  // Auto-focus first input and handle paste
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }

    const handleGlobalPaste = (e) => {
      if (e.target.type !== 'text' || !e.target.hasAttribute('inputmode')) {
        const pastedText = e.clipboardData.getData('text');
        const digits = pastedText.replace(/\D/g, '').slice(0, 4);

        if (digits.length === 4) {
          e.preventDefault();
          const newOtp = digits.split('');
          setOtp(newOtp);

          // Focus on last input
          if (inputRefs.current[3]) {
            inputRefs.current[3].focus();
          }
        }
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => {
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }, []);

  // Add handlePaste for individual inputs
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const digits = pastedText.replace(/\D/g, '').slice(0, 4);

    if (digits.length === 4) {
      const newOtp = digits.split('');
      setOtp(newOtp);

      // Focus on last input
      if (inputRefs.current[3]) {
        inputRefs.current[3].focus();
      }
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{
        backgroundImage: `url(${shipp})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        width: "100%",
      }}
    >
      <div className="flex flex-col text-white gap-5 lg:gap-10 items-center justify-center bg-[#2D413F] backdrop-blur-md rounded-xl my-8 w-[85vw] py-7 sm:py-15 px-6 sm:w-[500px] lg:w-[600px] 2xl:w-[700px]">
        <div className='text-center'>
          <h1 className="text-[22px] sm:text-[26px] lg:text-[28px] xl:text-[35px] mt-4 font-semibold">
            Verification Code
          </h1>

          <div>
            <p className="text-center mx-[15px] sm:mx-[40px] text-[13px] sm:text-[14px] md:text-[16px] lg:text-[18px] font-semibold mt-3">
              Enter the 4-digit code sent to you at
            </p>
            <p className='text-center text-[13px] sm:text-[14px] md:text-[16px] lg:text-[18px] text-yellow-400 break-all px-4'>
              {emailFromRoute || "Email not available"}
            </p>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="w-full max-w-xs">
          <div>
            <div className='text-13px md:text-[16px] xl:text-[18px] mb-2'>OTP</div>
            <div className='flex items-center justify-center gap-3 sm:gap-4 w-full'>
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type='text'
                  inputMode='numeric'
                  maxLength={1}
                  value={otp[index]}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  placeholder='-'
                  className='px-4 py-3 sm:px-6 sm:py-4 w-14 sm:w-20 text-center text-white rounded-[16px] border border-[#4E6B5D] focus:outline-none focus:border-yellow-400 bg-transparent text-lg sm:text-xl'
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center w-full mt-8">
            <button
              type="submit"
              className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)] text-black font-bold text-[17px] sm:text-[19px] rounded-full h-[60px] w-full max-w-[240px] transition-all hover:opacity-90 active:scale-95"
            >
              Verify
            </button>
          </div>
        </form>

        {/* Resend OTP Option */}
        <div className="mt-4 text-center">
          <p className="text-white/70 text-sm sm:text-base">
            Didn't receive the code?
          </p>
          <button
            type="button"
            className="text-yellow-400 underline hover:text-yellow-300 mt-1 text-sm sm:text-base"
            onClick={async () => {
              try {
                // Call your resend OTP API here
                const response = await resendOtp({ email: emailFromRoute });
                toast.success("OTP has been resent to your email");
                resetOtpFields(); // Clear current OTP when resending
              } catch (error) {
                toast.error("Failed to resend OTP. Please try again.");
              }
            }}
          >
            Resend OTP
          </button>
        </div>

        {/* Clear OTP Button (Optional) */}
        <button
          type="button"
          onClick={resetOtpFields}
          className="mt-2 text-white/60 hover:text-white/90 text-sm underline"
        >
          Clear OTP
        </button>
      </div>
    </div>
  );
}

export default Verification;