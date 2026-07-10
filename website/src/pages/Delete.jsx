import React, { useState } from "react";
import Commonbanner from "../components/Commonbanner";
import { useNavigate } from "react-router-dom";
import { deleteAccount } from "../api/cms";
import { toast } from "sonner";
const Delete = () => {
  const [selected, setSelected] = useState("Personal reasons");
  const navigate = useNavigate();
  let token = localStorage.getItem("token");

  let user = localStorage.getItem("user");
  let userdetail = JSON.parse(user);
  const [detail, setDetail] = useState(userdetail);
  const reasons = [
    "No longer using the service/platform",
    "Found a better alternative",
    "Privacy concerns",
    "Too many emails/ notifications",
    "Difficulty navigating the platform ",
    "Account security concerns",
    "Personal reasons",
    "Others",
  ];
  const handleSubmit = async (e) => {
    try {
      e.preventDefault();
      console.log("Delete data00000:", selected, detail.email);
      let response = await deleteAccount({ reason: selected, email: detail.email });
      console.log("Delete response:534543543543", response);
      if (response.success === true) {
        toast.success(response.message);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
      } else {
        toast.error(response.message || "Login failed. Please try again.");
      }
    } catch (error) {
      if (error.response.data.success == false) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Login error000000:", error.response.data.success);

        const errorMessage = error.response.data?.message ||
          error.response.data?.error ||
          error.response.statusText ||
          "Server error occurred";
        toast.error(errorMessage);

      }
    }

  };
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1f3b2f] to-[#0b1a14]">
      <Commonbanner title="Delete Account" />

      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-[476px] text-center">
          {/* Text */}
          <p className="text-white/90 mb-5 text-[22px]">
            If you need to delete an account and you're prompted to provide a
            reason.
          </p>

          {/* Card */}
          <form onSubmit={handleSubmit}>
            <div className="bg-[#2D413F] rounded-2xl p-5 space-y-8 shadow-lg">
              {reasons.map((item, index) => (
                <label
                  key={index}
                  className="flex items-start  gap-3 cursor-pointer text-white text-lg"
                >
                  {/* Custom Radio */}
                  <div className="w-7 h-7">
                    <div
                      onClick={() => setSelected(item)}
                      className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full mt-1 sm:mt-0 border-2 flex items-center justify-center
                    ${selected === item
                          ? "border-yellow-400"
                          : "border-white/40"
                        }`}
                    >
                      {selected === item && (
                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full"></div>
                      )}
                    </div>
                  </div>

                  <span className="text-[16px] sm:text-[18px] text-start">{item}</span>
                </label>
              ))}
            </div>

            {/* Submit Button */}
            <div className="mt-10">
              <button type="submit" className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-semibold px-22 py-5 text-[17px] sm:text-[19px] rounded-full shadow-lg transition-all">
                Submit
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Delete;










