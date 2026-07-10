import React, { useState, useEffect } from 'react'
import { man, camera, profile1 } from "../common/common-assets/assets-images";
import { useNavigate } from 'react-router-dom';
import ProfileMain from '../components/ProfileMain';
import Commonbanner from '../components/Commonbanner';
import { updateProfile } from '../api/cms';
import { toast } from 'sonner';
import { API_URL } from '../api/axios';
import { FaSpinner } from "react-icons/fa";
import PhoneInput from "../components/PhoneInput";
import { COUNTRY_LIST, validatePhoneForCountry } from "../utils/countryPhoneData";
import Autocomplete from "react-google-autocomplete";
import { locationn } from "../common/common-assets/assets-images";

const Edit = () => {

  const navigate = useNavigate();

  let user = localStorage.getItem("user");
  let userdetail = JSON.parse(user || "{}");

  const [detail] = useState(userdetail);
  const [name, setName] = useState(detail.firstName || "");
  const [lastName, setLastName] = useState(detail.lastName || "");
  const [email] = useState(detail.email || "");
  const [phoneNumber, setPhoneNumber] = useState(detail.phoneNumber || "");
  const [streetAddress, setStreetAddress] = useState(detail.streetAddress || "");
  const [city, setCity] = useState(detail.city || "");
  const [state, setState] = useState(detail.state || "");
  const [latitude, setLatitude] = useState(detail.latitude || "");
  const [longitude, setLongitude] = useState(detail.longitude || "");
  const [apiLoaded, setApiLoaded] = useState(false);
  
  const getInitialCountry = () => {
    const savedDialCode = detail.countryCode || "+1";
    const savedCountryCode = detail.country || "";
    
    if (savedCountryCode === "CA" && savedDialCode === "+1") {
      return {
        dialCode: "+1",
        code: "CA"
      };
    }
    
    if (savedDialCode === "+1") {
      return {
        dialCode: "+1",
        code: "US"
      };
    }
    
    const matchedCountry = COUNTRY_LIST.find(c => c.dialCode === savedDialCode);
    return matchedCountry || { dialCode: "+1", code: "US" };
  };

  const [phoneCountry, setPhoneCountry] = useState(getInitialCountry());

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkApi = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setApiLoaded(true);
        return true;
      }
      return false;
    };

    if (checkApi()) return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    let script = document.getElementById("google-maps-script");

    if (!script) {
      script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const handleLoad = () => {
      let count = 0;
      const interval = setInterval(() => {
        if (checkApi() || count > 50) {
          clearInterval(interval);
        }
        count++;
      }, 100);
    };

    script.addEventListener("load", handleLoad);
    const fallbackInterval = setInterval(checkApi, 500);

    return () => {
      script.removeEventListener("load", handleLoad);
      clearInterval(fallbackInterval);
    };
  }, []);

  const validateField = (fieldName, value) => {
    let error = "";

    if (fieldName === "name") {
      if (!value.trim()) error = "First name is required";
      else if (value.length > 50) error = "First name cannot exceed 50 characters";
    }
    if (fieldName === "lastName") {
      if (!value.trim()) error = "Last name is required";
      else if (value.length > 50) error = "Last name cannot exceed 50 characters";
    }
    if (fieldName === "streetAddress") {
      if (!value.trim()) error = "Street address is required";
      else if (value.trim().length < 5) error = "Please enter a valid street address";
    }
    if (fieldName === "city") {
      if (!value.trim()) error = "City is required";
    }
    if (fieldName === "state") {
      if (!value.trim()) error = "State is required";
    }
    if (fieldName === "phoneNumber") {
      error = validatePhoneForCountry(phoneCountry.dialCode, value);
    }

    setErrors(prev => ({ ...prev, [fieldName]: error }));
    return error;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nameError = validateField("name", name);
    const lastNameError = validateField("lastName", lastName);
    const phoneError = validateField("phoneNumber", phoneNumber);
    const streetAddressError = validateField("streetAddress", streetAddress);
    const cityError = validateField("city", city);
    const stateError = validateField("state", state);

    if (nameError || lastNameError || phoneError || streetAddressError || cityError || stateError) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsLoading(true);

    const data = new FormData();
    data.append("name", name.trim());
    data.append("lastName", lastName.trim());
    data.append("email", email);
    data.append("phoneNumber", phoneNumber);
    data.append("countryCode", phoneCountry.dialCode);
    data.append("country", phoneCountry.code); 
    data.append("streetAddress", streetAddress.trim());
    data.append("city", city.trim());
    data.append("state", state.trim());
    data.append("latitude", latitude);
    data.append("longitude", longitude);

    try {
      let response = await updateProfile(data);

      if (response.status === 200) {
        toast.success(response.message);
        localStorage.setItem("user", JSON.stringify(response.body));
        window.dispatchEvent(new Event('userUpdated'));
        navigate("/profile");
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.error("Update profile error:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCountryChange = (countryObj) => {
    if (countryObj.dialCode === "+1" && countryObj.code !== "CA") {
      setPhoneCountry({
        dialCode: "+1",
        code: "US"
      });
    } else {
      setPhoneCountry(countryObj);
    }
    if (phoneNumber) validateField("phoneNumber", phoneNumber);
  };

  return (
    <>
      <Commonbanner title="Edit Profile" />

      <div className='bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] py-20'>
        <div className='container mx-auto flex flex-col lg:flex-row justify-center pb-[20px] py-20 gap-5'>

          <div className='w-full lg:w-[30%]'>
            <ProfileMain />
          </div>

          <div className='w-full shadow-sm bg-[#2D413F] rounded-[18px] lg:w-[70%]'>
            <div className='w-full container mx-auto flex flex-col sm:flex-row items-center justify-around gap-10 px-0 py-2'>

              <div className='w-full sm:w-[50%] flex flex-col items-center'>
                <p className='text-[22px] font-bold text-white w-full text-left mt-3'>
                  Edit Profile
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3 py-0 w-full">

                  {/* First Name */}
                  <div className="flex flex-col gap-1 w-full mt-5">
                    <label className="text-[16px] lg:text-[18px] text-white font-medium">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        let val = e.target.value.replace(/^\s+/, "");
                        if (val.length > 50) val = val.slice(0, 50);

                        if (val.length === 1) {
                          val = val.charAt(0).toUpperCase() + val.slice(1);
                        }

                        setName(val);
                        validateField("name", val);
                      }}
                      placeholder="Enter your name"
                      className={`rounded-[16px] border ${errors.name ? 'border-red-500' : 'border-[#4E6B5D]'
                        } py-4 px-5 text-white font-bold bg-transparent focus:outline-none w-full`}
                    />
                    {errors.name && (
                      <p className="text-red-400 text-sm mt-1">
                        {errors.name}
                      </p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div className="flex flex-col gap-1 w-full mt-5">
                    <label className="text-[16px] lg:text-[18px] text-white font-medium">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => {
                        let val = e.target.value.replace(/^\s+/, "");
                        if (val.length > 50) val = val.slice(0, 50);

                        if (val.length === 1) {
                          val = val.charAt(0).toUpperCase() + val.slice(1);
                        }

                        setLastName(val);
                        validateField("lastName", val);
                      }}
                      placeholder="Enter your last name"
                      className={`rounded-[16px] border ${errors.lastName ? 'border-red-500' : 'border-[#4E6B5D]'
                        } py-4 px-5 text-white font-bold bg-transparent focus:outline-none w-full`}
                    />
                    {errors.lastName && (
                      <p className="text-red-400 text-sm mt-1">
                        {errors.lastName}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="flex flex-col gap-1 w-full mt-2">
                    <label className="text-white font-medium">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      readOnly
                      className="rounded-[16px] border border-[#4E6B5D] py-4 px-5 text-white font-bold bg-transparent focus:outline-none w-full opacity-70"
                    />
                  </div>

                  {/* Phone */}
                  <div className="flex flex-col gap-1 w-full mt-2">
                    <PhoneInput
                      label="Phone Number"
                      labelClassName="text-[16px] lg:text-[18px] text-white font-medium"
                      value={phoneNumber}
                      onChange={(val) => {
                        setPhoneNumber(val);
                        validateField("phoneNumber", val);
                      }}
                      inputClassName="font-bold py-4 px-5"
                      buttonClassName="font-bold"
                      country={phoneCountry}
                      onCountryChange={handleCountryChange}
                      error={errors.phoneNumber}
                      placeholder="Enter phone number"
                    />
                  </div>

                  {/* Street Address with Autocomplete */}
                  <div className="flex flex-col gap-1 w-full mt-2">
                    <label className="text-[16px] lg:text-[18px] text-white font-medium">
                      Street Address
                    </label>
                    <div className="relative">
                      {apiLoaded ? (
                        <Autocomplete
                          onPlaceSelected={(place) => {
                            let streetAddressValue = '';
                            let cityValue = '';
                            let stateValue = '';
                            let formattedAddress = place.formatted_address || place.name;

                            if (place.address_components) {
                              for (const component of place.address_components) {
                                const types = component.types;

                                if (types.includes('street_number')) {
                                  streetAddressValue = component.long_name + ' ' + streetAddressValue;
                                }
                                if (types.includes('route')) {
                                  streetAddressValue = streetAddressValue + component.long_name;
                                }

                                if (types.includes('locality') || types.includes('administrative_area_level_3')) {
                                  cityValue = component.long_name;
                                }

                                if (types.includes('administrative_area_level_1')) {
                                  stateValue = component.long_name;
                                }

                                if (!cityValue && types.includes('postal_town')) {
                                  cityValue = component.long_name;
                                }

                                if (!cityValue && types.includes('administrative_area_level_2')) {
                                  cityValue = component.long_name;
                                }
                              }

                              streetAddressValue = streetAddressValue.trim();
                            }

                            if (!streetAddressValue && formattedAddress) {
                              const addressParts = formattedAddress.split(',');
                              if (addressParts.length > 0) {
                                streetAddressValue = addressParts[0].trim();
                              }
                            }

                            setStreetAddress(streetAddressValue);
                            setCity(cityValue);
                            setState(stateValue);
                            setLatitude(place.geometry.location.lat().toString());
                            setLongitude(place.geometry.location.lng().toString());

                            setErrors((prev) => ({
                              ...prev,
                              streetAddress: "",
                              city: "",
                              state: ""
                            }));
                          }}
                          options={{ types: ["address"] }}
                          defaultValue={streetAddress}
                          placeholder="Enter street address"
                          className={`rounded-[16px] border ${errors.streetAddress ? 'border-red-500' : 'border-[#4E6B5D]'
                            } py-4 px-5 text-white font-bold bg-transparent focus:outline-none w-full pr-12`}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStreetAddress(value);
                            validateField("streetAddress", value);
                          }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={streetAddress}
                          onChange={(e) => {
                            setStreetAddress(e.target.value);
                            validateField("streetAddress", e.target.value);
                          }}
                          placeholder="Enter street address"
                          className={`rounded-[16px] border ${errors.streetAddress ? 'border-red-500' : 'border-[#4E6B5D]'
                            } py-4 px-5 text-white font-bold bg-transparent focus:outline-none w-full pr-12`}
                        />
                      )}
                      <img 
                        src={locationn} 
                        className="absolute top-1/2 right-4 w-5 -translate-y-1/2 opacity-60" 
                        alt="location" 
                      />
                    </div>
                    {errors.streetAddress && (
                      <p className="text-red-400 text-sm mt-1">
                        {errors.streetAddress}
                      </p>
                    )}
                  </div>

                  {/* City */}
                  <div className="flex flex-col gap-1 w-full mt-2">
                    <label className="text-[16px] lg:text-[18px] text-white font-medium">
                      City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val.length === 1) {
                          val = val.charAt(0).toUpperCase() + val.slice(1);
                        }
                        setCity(val);
                        validateField("city", val);
                      }}
                      placeholder="Enter city"
                      className={`rounded-[16px] border ${errors.city ? 'border-red-500' : 'border-[#4E6B5D]'
                        } py-4 px-5 text-white font-bold bg-transparent focus:outline-none w-full`}
                    />
                    {errors.city && (
                      <p className="text-red-400 text-sm mt-1">
                        {errors.city}
                      </p>
                    )}
                  </div>

                  {/* State */}
                  <div className="flex flex-col gap-1 w-full mt-2">
                    <label className="text-[16px] lg:text-[18px] text-white font-medium">
                      State
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val.length === 1) {
                          val = val.charAt(0).toUpperCase() + val.slice(1);
                        }
                        setState(val);
                        validateField("state", val);
                      }}
                      placeholder="Enter state"
                      className={`rounded-[16px] border ${errors.state ? 'border-red-500' : 'border-[#4E6B5D]'
                        } py-4 px-5 text-white font-bold bg-transparent focus:outline-none w-full`}
                    />
                    {errors.state && (
                      <p className="text-red-400 text-sm mt-1">
                        {errors.state}
                      </p>
                    )}
                  </div>

                  {/* Button */}
                  <div className="flex items-center justify-start w-full mt-5 mb-5">
                    <button
                      disabled={isLoading}
                      type="submit"
                      className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
                      text-black font-bold text-[17px] sm:text-[19px]
                      rounded-full h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
                      transition-all flex items-center justify-center gap-2
                      disabled:opacity-50 hover:scale-105"
                    >
                      {isLoading ? (
                        <FaSpinner className="animate-spin" />
                      ) : (
                        "Update"
                      )}
                    </button>
                  </div>

                </form>
              </div>

              <div className='h-full w-full sm:w-[50%] flex items-center justify-center'>
                <img
                  src={man}
                  className='w-[300px] sm:w-full h-full mt-5 mb-5'
                  alt=""
                />
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Edit;