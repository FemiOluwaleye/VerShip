import React, { useState } from "react";
import { RiUserStarFill } from "react-icons/ri";
import { owner, shipp, user } from "../common/common-assets/assets-images";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { X } from "lucide-react";

const Type = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState("");
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [surveyValue, setSurveyValue] = useState([]);
  const mode = location.state?.mode || "signup";

  const toggleSurveyOption = (val) => {
    setSurveyValue(prev =>
      prev.includes(val)
        ? prev.filter(item => item !== val)
        : [...prev, val]
    );
  };

  const handleClick = () => {
    if (!role) {
      toast.error("Please select user type");
      return;
    }
    localStorage.setItem("role", role);

    if (mode === "login") {
      navigate("/login", {
        state: {
          role: role === "user" ? "1" : "2"
        }
      });
      return;
    }

    // Show survey modal ONLY for personal (user) side
    if (role === "user") {
      setIsSurveyModalOpen(true);
    } else if (role === "business") {
      // Direct navigation for business without survey
      navigate('/businessSignup', {
        state: { role: "2" }
      });
    }
  };

  const handleSurveySubmit = () => {
    if (surveyValue.length === 0) {
      toast.error("Please select at least one option");
      return;
    }

    const surveyString = surveyValue.join(",");

    if (role == "user") {
      navigate("/signup", {
        state: { role: "1", survey: surveyString }
      });
    } else if (role == "business") {
      navigate('/businessSignup', {
        state: { role: "2", survey: surveyString }
      });
    }
    setIsSurveyModalOpen(false);
  };

  return (
    <div>
      <div
        className="flex items-center justify-center"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(${shipp})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          width: "100%",
        }}
      >
        <div className=" flex items-center justify-center min-h-screen">
          <div className="flex flex-col  gap-5 sm:gap-10 xl:gap-15   md:mx-[50px] lg:mx-[60px] xl:mx-[100px]  items-center justify-center bg-[#2D413F] backdrop-blur-md rounded-xl mt-[50px] mb-[50px] w-[80vw] py-6 px-6 sm:w-[500px]  lg:w-[600px]  2xl:w-[650px]">
            <div>
              <h1 className="text-[22px] mt-10 sm:text-[26px] lg:text-[28px] xl:text-[35px] font-semibold text-white items-center">
                Select User Type
              </h1>
            </div>
            <div className="flex items-stretch justify-center gap-5 sm:gap-10">
              <div
                onClick={() => setRole("user")}
                className={`flex flex-col items-center justify-center gap-2 sm:gap-3 w-[110px] sm:w-[140px] lg:w-[150px] xl:w-[200px] min-h-[110px] sm:min-h-[120px] lg:min-h-[130px] xl:min-h-[170px] py-3 px-2 rounded-lg cursor-pointer transition-all ${role === "user" ? "bg-[#FCC604]" : "bg-[#96a09f]"}`}
              >
                <img
                  src={user}
                  className="h-[35px] sm:h-[40px] lg:h-[50px] xl:h-[70px] shrink-0"
                  alt="Personal user"
                />
                <p className="text-[13px] sm:text-[22px] lg:text-[27px] font-semibold text-black text-center">
                  Personal
                </p>
              </div>
              <div
                onClick={() => setRole("business")}
                className={`flex flex-col items-center justify-center gap-2 sm:gap-3 w-[110px] sm:w-[140px] lg:w-[150px] xl:w-[200px] min-h-[110px] sm:min-h-[120px] lg:min-h-[130px] xl:min-h-[170px] py-3 px-2 rounded-lg cursor-pointer transition-all ${role === "business" ? "bg-[#FCC604]" : "bg-[#96a09f]"}`}
              >
                <img
                  src={owner}
                  className="h-[35px] sm:h-[40px] lg:h-[50px] xl:h-[70px] shrink-0"
                  alt="Freight forwarder"
                />
                <p className="text-[11px] sm:text-[16px] lg:text-[20px] xl:text-[22px] font-semibold text-black text-center leading-tight">
                  Freight Forwarder
                </p>
              </div>
            </div>
            <div className="flex justify-center mt-4 mb-5">
              <button
                onClick={() => handleClick()}
                type="submit"
                className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
              text-black font-bold text-[17px] sm:text-[19px]
              rounded-full
              h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
              transition-all"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Survey Modal - Only for Personal Side */}
      {isSurveyModalOpen && role === "user" && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg bg-[#2D413F] rounded-2xl shadow-2xl border border-white/10 overflow-hidden text-white animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-2xl font-bold">Quick Survey</h2>
              <button
                onClick={() => setIsSurveyModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              <p className="text-lg text-white/80 mb-8 text-center italic">
                What is most important to you when choosing a shipment provider?
              </p>

              <div className="space-y-4">
                {[{ name: "fastest delivery", value: "1" }, { name: "safety & reliability", value: "2" }, { name: "lowest cost", value: "3" }].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:bg-white/5
                                            ${surveyValue.includes(option.value)
                        ? "border-[#FCC604] bg-[#FCC604]/10"
                        : "border-white/10 bg-transparent"
                      }`}
                  >
                    <input
                      type="checkbox"
                      name="survey"
                      value={option.value}
                      checked={surveyValue.includes(option.value)}
                      onChange={() => toggleSurveyOption(option.value)}
                      className="hidden"
                    />
                    <div className={`w-6 h-6 rounded-md border-2 mr-4 flex items-center justify-center
                                            ${surveyValue.includes(option.value) ? "border-[#FCC604] bg-[#FCC604]" : "border-white/40"}`}>
                      {surveyValue.includes(option.value) && (
                        <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-lg font-medium capitalize">
                      {option.name}
                    </span>
                  </label>
                ))}
              </div>

              <button
                onClick={handleSurveySubmit}
                className="w-full mt-10 py-5 bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)] text-black font-bold text-xl rounded-full hover:brightness-110 active:scale-[0.98] transition-all shadow-lg"
              >
                Start Registration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Type;