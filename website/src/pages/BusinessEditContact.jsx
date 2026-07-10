import React, { useState, useEffect } from 'react'
import { man } from "../common/common-assets/assets-images";
import { useNavigate } from 'react-router-dom';
import ProfileMain from '../components/ProfileMain';
import Commonbanner from '../components/Commonbanner';
import { getProviderProfile, completeProfile } from '../api/cms';
import { toast } from 'sonner';
import { FaSpinner } from "react-icons/fa";
import PhoneInput from "../components/PhoneInput";
import { COUNTRY_LIST, validatePhoneForCountry } from "../utils/countryPhoneData";

const BussinessEditContact = () => {

  const navigate = useNavigate();
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : {};

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    country: { dialCode: "+1", code: "US" },
    primaryContactPersonFirstName: "",
    primaryContactPersonLastName: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user.id) return;
      try {
        const response = await getProviderProfile(user.id);
        console.log("Profile response:", response);
        
        if (response.success && response.body) {
          const mainBody = response.body;
          const businessInfo = response.body.businessInfo || {};
          
          const savedDialCode = mainBody.countryCode || "+1"; 
          
          let matchedCountry;
          if (savedDialCode === "+1" || savedDialCode === "1") {
            matchedCountry = COUNTRY_LIST.find(c => c.code === "US");
          } else {
            matchedCountry = COUNTRY_LIST.find(c => c.dialCode === savedDialCode);
            if (!matchedCountry && savedDialCode.startsWith('+')) {
              const codeWithoutPlus = savedDialCode.substring(1);
              matchedCountry = COUNTRY_LIST.find(c => c.dialCode === codeWithoutPlus);
            }
          }
          
          if (!matchedCountry) {
            matchedCountry = COUNTRY_LIST.find(c => c.code === "US");
          }
          
          console.log("Matched country:", matchedCountry);
          
          setFormData({
            email: businessInfo.email || mainBody.email || "",
            phone: mainBody.phoneNumber || businessInfo.phone || "", 
            country: { 
              dialCode: matchedCountry.dialCode, 
              code: matchedCountry.code 
            },
            primaryContactPersonFirstName: businessInfo.primaryContactPersonFirstName || "",
            primaryContactPersonLastName: businessInfo.primaryContactPersonLastName || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    };
    fetchProfile();
  }, [user.id]);

  useEffect(() => {
    console.log("Current formData.country:", formData.country);
  }, [formData.country]);

  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "email":
        if (!value.trim()) error = "Company Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = "Invalid email format";
        break;
      case "phone":
        error = validatePhoneForCountry(formData.country.dialCode, value);
        break;
      case "primaryContactPersonFirstName":
        if (!value.trim()) error = "First Name is required";
        break;
      case "primaryContactPersonLastName":
        if (!value.trim()) error = "Last Name is required";
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value.replace(/^\s+/, "");

    if (name === "phone") {
      formattedValue = formattedValue.replace(/[^0-9]/g, "");
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
    validateField(name, formattedValue);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });

    if (Object.values(newErrors).some(err => err)) {
      setErrors(newErrors);
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsLoading(true);
    try {
      const data = {
        providerId: user.id,
        companyEmail: formData.email,
        phone: formData.phone,
        countryCode: formData.country.dialCode,
        primaryContactPersonFirstName: formData.primaryContactPersonFirstName,
        primaryContactPersonLastName: formData.primaryContactPersonLastName,
      };

      console.log("Submitting data:", data);
      const response = await completeProfile(data);
      
      if (response.success) {
        toast.success("Profile updated!");
        navigate("/editnextdocument");
      } else {
        toast.error(response.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error(error.response?.data?.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Commonbanner title="Edit Profile" />

      <div className='bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] py-20'>
        <div className='container mx-auto flex flex-col lg:flex-row justify-center items-start pb-[20px] py-20 gap-5'>
          <div className='w-full lg:w-[30%]'><ProfileMain show={false} /></div>

          <div className='w-full shadow-sm bg-[#2D413F] rounded-[18px] lg:w-[70%]'>
            <div className='w-full xl:mt-0 container mx-auto flex flex-col sm:flex-row items-start justify-around gap-10 px-0 py-2'>
              <div className='w-full sm:w-[50%] py-7'>
                <div className="flex flex-col items-center text-white gap-6">
                  <div className="w-full max-w-[480px] mt-4">
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5, 6].map((step) => (
                        <div
                          key={step}
                          className={`h-[4px] w-full rounded-full transition-all duration-300 ${step <= 2 ? "bg-yellow-400" : "bg-white/30"
                            }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="w-full max-w-[560px] flex flex-col gap-4 text-white">
                    {/* Email */}
                    <div>
                      <label className="text-lg font-medium">Company Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        disabled
                        placeholder="Enter"
                        className="w-full bg-white/5 border border-white/20
                    text-white placeholder:text-white/40
                    rounded-md px-4 py-2.5
                    focus:outline-none opacity-60 cursor-not-allowed mt-2"
                      />
                      {errors.email && (
                        <p className="text-red-400 text-sm mt-1">{errors.email}</p>
                      )}
                    </div>

                    <div>
                      <PhoneInput
                        label="Phone Number"
                        value={formData.phone}
                        onChange={(val) => {
                          setFormData(prev => ({ ...prev, phone: val }));
                          validateField("phone", val);
                        }}
                        country={formData.country}
                        onCountryChange={(countryObj) => {
                          console.log("Country changed to:", countryObj);
                          setFormData(prev => ({ ...prev, country: countryObj }));
                          if (formData.phone) validateField("phone", formData.phone);
                        }}
                        error={errors.phone}
                        placeholder="Enter"
                      />
                    </div>
                    
                    <label className="text-lg font-medium">Primary Contact</label>
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <label className="text-lg font-medium">First Name</label>
                        <input
                          type="text"
                          name="primaryContactPersonFirstName"
                          value={formData.primaryContactPersonFirstName}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            const formattedValue =
                              rawValue.charAt(0).toUpperCase() + rawValue.slice(1).toLowerCase();
                            handleInputChange({
                              ...e,
                              target: {
                                ...e.target,
                                name: "primaryContactPersonFirstName",
                                value: formattedValue,
                              },
                            });
                          }}
                          placeholder="First Name"
                          className="w-full bg-transparent border border-white/20
                    text-white placeholder:text-white/40
                    rounded-md px-4 py-2.5
                    focus:outline-none focus:border-yellow-400 mt-2"
                        />
                        {errors.primaryContactPersonFirstName && (
                          <p className="text-red-400 text-sm mt-1">{errors.primaryContactPersonFirstName}</p>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="text-lg font-medium">Last Name</label>
                        <input
                          type="text"
                          name="primaryContactPersonLastName"
                          value={formData.primaryContactPersonLastName}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            const formattedValue =
                              rawValue.charAt(0).toUpperCase() + rawValue.slice(1).toLowerCase();
                            handleInputChange({
                              ...e,
                              target: {
                                ...e.target,
                                name: "primaryContactPersonLastName",
                                value: formattedValue,
                              },
                            });
                          }}
                          placeholder="Last Name"
                          className="w-full bg-transparent border border-white/20
                    text-white placeholder:text-white/40
                    rounded-md px-4 py-2.5
                    focus:outline-none focus:border-yellow-400 mt-2"
                        />
                        {errors.primaryContactPersonLastName && (
                          <p className="text-red-400 text-sm mt-1">{errors.primaryContactPersonLastName}</p>
                        )}
                      </div>
                    </div>

                    {/* Button */}
                    <div className="flex justify-center mt-4">
                      <button
                        disabled={isLoading}
                        type="submit"
                        className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
                    text-black font-bold text-[17px] sm:text-[19px]
                    rounded-full flex items-center justify-center gap-2
                    h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
                    transition-all disabled:opacity-50"
                      >
                        {isLoading ? <FaSpinner className="animate-spin" /> : "Next"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
              <div className='h-full w-full sm:w-[50%] flex items-center justify-center'>
                <img src={man} className='w-[300px] sm:w-full h-full mt-5 sm:mt-10 md:mt-15 mb-5' alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BussinessEditContact;