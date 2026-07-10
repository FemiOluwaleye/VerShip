import React, { useState, useEffect } from "react";
import { man } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import ProfileMain from "../components/ProfileMain";
import Commonbanner from "../components/Commonbanner";
import { getProviderProfile, completeProfile } from "../api/cms";
import { toast } from "sonner";
import { FaSpinner } from "react-icons/fa";

const COUNTRY_LIST = ["USA"];
const DELIVERY_OPTIONS = ["14 Days", "21 Days"];

const normalizeDeliveryTimeline = (value) => {
  if (!value) return "14 Days";
  const trimmed = String(value).trim();
  if (DELIVERY_OPTIONS.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.includes("14")) return "14";
  if (lower.includes("14")) return "14 Days";
  return "14 Days";
};

const BusinessTimeEdit = () => {
  const navigate = useNavigate();
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : {};

  const [isLoading, setIsLoading] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [freightType, setFreightType] = useState("Sea");
  const [deliveryTime, setDeliveryTime] = useState("14 Days");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user.id) return;
      try {
        const response = await getProviderProfile(user.id);
        if (response.success && response.body) {
          const info = response.body.businessInfo || {};
          const serviceArea = response.body.serviceArea || [];

          let mappedFreightType = info.freightType || "Sea";
          if (mappedFreightType === "1") mappedFreightType = "Air";
          else if (mappedFreightType === "2") mappedFreightType = "Sea";

          const countries = serviceArea.map((route) => route.country).filter(Boolean);
          setSelectedCountries(countries.length > 0 ? countries : ["USA"]);
          setFreightType(mappedFreightType || "Sea");
          setDeliveryTime(normalizeDeliveryTimeline(info.deliveryTimeline));
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    };
    fetchProfile();
  }, [user.id]);

  const validateCountries = (countries) => {
    const error = countries.length === 0 ? "Please select at least one country" : "";
    setErrors((prev) => ({ ...prev, selectedCountries: error }));
    return error;
  };

  const toggleCountry = (country) => {
    let updated;
    if (selectedCountries.includes(country)) {
      updated = selectedCountries.filter((c) => c !== country);
    } else {
      updated = [...selectedCountries, country];
    }
    setSelectedCountries(updated);
    validateCountries(updated);
    setCountryOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const countryErr = validateCountries(selectedCountries);
    if (countryErr) {
      toast.error(countryErr);
      return;
    }

    setIsLoading(true);
    try {
      const response = await completeProfile({
        providerId: user.id,
        deliveryTimeline: deliveryTime,
        serviceCountries: selectedCountries,
        freightType,
      });
      if (response.success) {
        toast.success("Delivery details updated!");
        navigate("/businessuploadnext");
      } else {
        toast.error(response.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Delivery update error:", error);
      toast.error(error.response?.data?.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Commonbanner title="Edit Profile" />
      <div className="bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] py-20">
        <div className="container mx-auto flex flex-col lg:flex-row justify-center pb-[20px] py-20 gap-5">
          <div className="w-full lg:w-[30%]">
            <ProfileMain show={false} />
          </div>
          <div className="w-full shadow-sm bg-[#2D413F] rounded-[18px] lg:w-[70%]">
            <div className="w-full xl:mt-0 container mx-auto flex flex-col sm:flex-row items-center justify-around gap-10 px-0 py-2">
              <div className="w-full sm:w-[50%] py-7">
                <div className="w-full max-w-[480px] mt-4 mb-6">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5, 6].map((step) => (
                      <div
                        key={step}
                        className={`h-[4px] w-full rounded-full transition-all duration-300 ${
                          step <= 4 ? "bg-yellow-400" : "bg-white/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5 text-white">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Delivery Time</h3>
                    <select
                      name="deliveryTime"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="w-full bg-transparent border border-white/20 text-white rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400"
                    >
                      {DELIVERY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt} className="text-black">
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <h3 className="text-xs mb-2 text-white/60">Operating Countries</h3>
                    <div
                      onClick={() => setCountryOpen(!countryOpen)}
                      className="w-full rounded-lg px-4 py-3 border border-white/10 bg-[#324947] cursor-pointer flex justify-between items-center"
                    >
                      <span className="text-sm text-white/50">
                        {selectedCountries.length > 0
                          ? `${selectedCountries.length} Selected`
                          : "Select"}
                      </span>
                      <svg
                        className={`w-4 h-4 transition-transform ${countryOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    {countryOpen && (
                      <div className="absolute mt-2 w-full max-h-[340px] overflow-y-auto rounded-lg border border-white/10 bg-[#2D413F] z-50 shadow-xl">
                        {COUNTRY_LIST.map((country) => (
                          <div
                            key={country}
                            onClick={() => toggleCountry(country)}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCountries.includes(country)}
                              readOnly
                              className="w-4 h-4 rounded accent-[#FFC400]"
                            />
                            <span className="text-sm">{country}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {errors.selectedCountries && (
                      <p className="text-red-400 text-sm mt-1">{errors.selectedCountries}</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs mb-2 text-white/60">Freight Type</h3>
                    <div className="w-full rounded-lg px-4 py-3 border border-white/10 bg-[#324947] space-y-3">
                      {["Sea"].map((type) => (
                        <label
                          key={type}
                          className="flex items-center gap-3 cursor-pointer text-sm"
                        >
                          <input
                            type="radio"
                            name="freightType"
                            value={type}
                            checked={freightType === type}
                            onChange={() => setFreightType(type)}
                            className="w-4 h-4 accent-[#FFC400]"
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-start mt-4 mb-10">
                    <button
                      disabled={isLoading}
                      type="submit"
                      className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)] text-black font-bold text-[17px] sm:text-[19px] rounded-full mb-5 flex items-center justify-center gap-2 h-[60px] w-[200px] sm:h-[70px] sm:w-[260px] transition-all disabled:opacity-50"
                    >
                      {isLoading ? <FaSpinner className="animate-spin" /> : "Next"}
                    </button>
                  </div>
                </form>
              </div>
              <div className="h-full w-full sm:w-[50%] flex items-center justify-center">
                <img src={man} className="w-[300px] sm:w-full h-full mt-5 sm:mt-10 md:mt-15 mb-5" alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BusinessTimeEdit;
