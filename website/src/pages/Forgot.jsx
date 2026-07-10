import React, { useState } from "react";
import { shipp } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { forgotPassword } from "../api/cms";

const Forgot = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (value) => {
    let err = "";
    if (!value.trim()) {
      err = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      err = "Invalid email format";
    }
    setError(err);
    return err;
  };

  const handleChange = (e) => {
    const value = e.target.value.replace(/^\s+/, "");
    setEmail(value);
    validateEmail(value);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) {
      toast.error(err);
      return;
    }

    setLoading(true);
    try {
      const response = await forgotPassword({ email });
      toast.success(response.message || "OTP sent successfully.");
      navigate("/forgot-verification", { state: { email, isForgot: true } });
    } catch (error) {
      toast.error(error.response?.data?.message || "User not found or an error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div
        className=" flex items-center justify-center"
        style={{
          backgroundImage: ` url(${shipp})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          width: "100%",
        }}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col text-white px-5  gap-5 sm:gap-10 xl:gap-15 pb-10 sm:pb-20 py-5 sm:py-10 md:mx-[50px] lg:mx-[60px] xl:mx-[100px]  items-center justify-center  bg-[#2D413F] backdrop-blur-md rounded-xl mt-[50px] mb-[50px] w-[85vw] sm:w-[500px]  lg:w-[600px]  2xl:w-[700px]">
            <div className="text-center">
              <h1 className="text-[22px]  sm:text-[26px] lg:text-[28px] xl:text-[35px] mt-10 font-semibold mb-3">
                Forgot Your Password?
              </h1>
              <p className="text-center px-5 text-[13px] sm:text-[14px] xl:text-[18px] max-w-full sm:max-w-[80%] lg:max-w-[70%] mx-auto">
                Enter your email to receive a one-time password and reset your account.
              </p>
            </div>
            <form
              onSubmit={handleSend}
              className="flex flex-col items-start justify-center gap-4 w-full px-2 sm:px-10"
            >
              <div className="flex flex-col gap-1 w-full">
                <label className="text-13px sm:text-[14px]  xl:text-[18px] font-semibold">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={handleChange}
                  className={`text-[13px] sm:text-[14px]  xl:text-[16px] text-white rounded-[16px] border ${error ? 'border-red-500' : 'border-[#465a50]'} bg-transparent py-3 px-5 focus:outline-none focus:border-yellow-400`}
                  placeholder="Enter your Email"
                />
                {error && <p className="text-red-400 text-xs mt-1 ml-1">{error}</p>}
              </div>
              <div className="flex items-center justify-center w-full mt-3 sm:mt-5 xl:mt-10">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)] text-black font-bold text-[17px] sm:text-[19px] rounded-full h-[60px] w-[180px] sm:h-[70px] sm:w-[240px] transition-all disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send"}
                </button>
              </div>
              <div className="flex justify-center w-full mt-2">
                <p onClick={() => navigate("/login")} className="text-sm text-yellow-400 cursor-pointer underline">
                  Back to Login
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Forgot;
