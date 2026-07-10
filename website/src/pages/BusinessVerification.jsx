import React, { useState, useEffect } from 'react';
import { shipp } from '../common/common-assets/assets-images';
import { useNavigate } from 'react-router-dom';
import { verify, resendOtp } from '../api/cms';
import { toast } from 'sonner';
import { FaSpinner } from 'react-icons/fa';

const BusinessVerification = () => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('userEmail');
    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  const handleChange = (e, index) => {
    const value = e.target.value;
    if (/^[0-9]?$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Move focus to next input
      if (value && index < 3) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        if (nextInput) nextInput.focus();
      }
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length < 4) {
      toast.error('Please enter the full 4-digit code');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: email,
        otp: otpValue
      };
      const response = await verify(payload);
      if (response.status === 200 || response.status === "1") {
        toast.success(response.message || 'Verified successfully!');

        // Save token and user data if available
        if (response.body && response.body.authtoken) {
          localStorage.setItem("token", response.body.authtoken);
          localStorage.setItem("user", JSON.stringify(response.body.user));
          window.dispatchEvent(new Event('userUpdated'));
        }

        navigate('/verified', { replace: true });
      } else {
        toast.error(response.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error(error.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const response = await resendOtp({ email });
      if (response.status === 200 || response.status === "1") {
        toast.success('OTP resent successfully!');
      } else {
        toast.error(response.message || 'Failed to resend OTP');
      }
    } catch (error) {
      console.error('Resend error:', error);
      toast.error(error.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <div
        className="flex items-center justify-center min-h-screen"
        style={{
          backgroundImage: `url(${shipp})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          width: "100%",
        }}
      >
        <div className="flex flex-col text-white gap-5 lg:gap-10 items-center justify-center bg-[#2D413F] backdrop-blur-md rounded-xl mt-[50px] mb-[50px] w-[85vw] py-7 sm:py-15 px-6 sm:w-[500px] lg:w-[600px] 2xl:w-[700px] shadow-2xl">
          <div className='text-center'>
            <h1 className="text-[22px] sm:text-[26px] lg:text-[28px] xl:text-[35px] font-semibold">
              Verification Code
            </h1>
            <div>
              <p className="text-center mx-[15px] sm:mx-[40px] text-[13px] sm:text-[14px] md:text-[16px] lg:text-[18px] font-semibold mt-3">
                Enter the 4-digit code sent to you at
              </p>
              <p className='text-center text-[13px] sm:text-[14px] md:text-[16px] lg:text-[18px] text-yellow-400'>
                {email || 'your email'}
              </p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="flex flex-col items-center gap-8 w-full">
            <div className="w-full text-center">
              <div className='text-13px md:text-[16px] xl:text-[18px] mb-4'>OTP</div>
              <div className='flex items-center justify-center gap-4 sm:gap-6'>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type='text'
                    maxLength='1'
                    value={digit}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className='px-2 py-2 sm:px-4 sm:py-3 w-[50px] sm:w-[80px] text-center text-[22px] font-bold text-white rounded-[16px] border border-white/20 focus:border-yellow-400 focus:outline-none bg-white/5'
                    autoComplete="off"
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <button
                disabled={loading}
                type="submit"
                className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
                text-black font-bold text-[17px] sm:text-[19px]
                rounded-full h-[60px] w-[200px] sm:h-[70px] sm:w-[260px]
                transition-all flex items-center justify-center gap-2
                disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <FaSpinner className="animate-spin" /> : "Verify"}
              </button>

              <p className="text-sm mt-2">
                Didn't receive code?{' '}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-yellow-400 font-bold hover:underline disabled:opacity-50"
                >
                  {resending ? 'Resending...' : 'Resend Code'}
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default BusinessVerification;
