import React, { useState, useEffect } from 'react'
import { man, locationn, camera } from "../common/common-assets/assets-images";
import { useNavigate } from 'react-router-dom';
import ProfileMain from '../components/ProfileMain';
import Commonbanner from '../components/Commonbanner';
import { getProviderProfile, completeProfile } from '../api/cms';
import { toast } from 'sonner';
import countriesData from "world-countries";
import { FaSpinner } from "react-icons/fa";
import { API_URL } from '../api/axios';
import { resolveFileUrl } from '../utils/fileUrl';
import Autocomplete from "react-google-autocomplete";

const COUNTRY_LIST = ["USA"];

const BussinessEditNext = () => {

  const navigate = useNavigate();
  const storedUserRaw = JSON.parse(localStorage.getItem("user") || "{}");
  const user = storedUserRaw?.user || storedUserRaw;

  const [isLoading, setIsLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [apiLoaded, setApiLoaded] = useState(false);

  const initialImage = resolveFileUrl(user.image, API_URL);
  const [previewUrl, setPreviewUrl] = useState(initialImage);
  const [formData, setFormData] = useState({
    businessName: "",
    registerationNumber: "",
    countryOfRegistration: "",
    businessAddress: "",
    businessLatitude: "",
    businessLongitude: "",
    description: "",
    streetAddress: "",
    city: "",
    state: "",
  });
  const [errors, setErrors] = useState({});

  // Load Google Maps API
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

  // Helper function to parse address components
  const parseAddressComponents = (place) => {
    let streetAddress = '';
    let city = '';
    let state = '';
    
    if (place.address_components) {
      let streetNumber = '';
      let route = '';
      
      for (const component of place.address_components) {
        const types = component.types;
        
        // Street number
        if (types.includes('street_number')) {
          streetNumber = component.long_name;
        }
        
        // Street name
        if (types.includes('route')) {
          route = component.long_name;
        }
        
        // City - check various possible types
        if (types.includes('locality') || 
            types.includes('administrative_area_level_3') ||
            types.includes('postal_town')) {
          city = component.long_name;
        }
        
        // State/Province
        if (types.includes('administrative_area_level_1')) {
          state = component.long_name;
        }
        
        // Fallback for city if not found above
        if (!city && types.includes('administrative_area_level_2')) {
          city = component.long_name;
        }
      }
      
      // Combine street number and route
      streetAddress = [streetNumber, route].filter(Boolean).join(' ');
    }
    
    // Fallback: try to extract from formatted address
    if (!streetAddress && place.formatted_address) {
      const parts = place.formatted_address.split(',');
      if (parts.length > 0) {
        streetAddress = parts[0].trim();
      }
    }
    
    // If city still not found, try to extract from address components again
    if (!city && place.address_components) {
      for (const component of place.address_components) {
        if (component.types.includes('sublocality') || 
            component.types.includes('sublocality_level_1')) {
          city = component.long_name;
          break;
        }
      }
    }
    
    return { streetAddress, city, state };
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user.id) return;
      try {
        const response = await getProviderProfile(user.id);
        if (response.success && response.body.businessInfo) {
          const info = response.body.businessInfo;
          setFormData({
            businessName: info.businessName || "",
            registerationNumber: info.registerationNumber || "",
            countryOfRegistration: info.countryOfRegistration || "",
            businessAddress: info.businessAddress || "",
            businessLatitude: info.businessLatitude || response.body.latitude || "",
            businessLongitude: info.businessLongitude || response.body.longitude || "",
            description: info.description || "",
            streetAddress: info.streetAddress || "",
            city: info.city || "",
            state: info.state || "",
          });
          if (response.body.image) {
            setPreviewUrl(resolveFileUrl(response.body.image, API_URL));
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    };
    fetchProfile();
  }, [user.id]);

  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "businessName":
        if (!value.trim()) error = "Business Name is required";
        break;
      case "registerationNumber":
        break;
      case "countryOfRegistration":
        if (!value) error = "Country of Registration is required";
        break;
      case "businessAddress":
        if (!value.trim()) error = "Business Address is required";
        break;
      case "description":
        if (!value.trim()) error = "Brief Description of Business is required";
        break;
     
      case "city":
        if (!value.trim()) error = "City is required";
        break;
      case "state":
        if (!value.trim()) error = "State is required";
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

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
    validateField(name, formattedValue);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all fields
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
      const data = new FormData();
      data.append("providerId", user.id);
      data.append("businessName", formData.businessName);
      data.append("registerationNumber", formData.registerationNumber);
      data.append("countryOfRegistration", formData.countryOfRegistration);
      data.append("businessAddress", formData.businessAddress);
      data.append("businessLatitude", formData.businessLatitude);
      data.append("businessLongitude", formData.businessLongitude);
      data.append("description", formData.description);
      data.append("streetAddress", formData.streetAddress);
      data.append("city", formData.city);
      data.append("state", formData.state);

      if (image) {
        data.append("image", image);
      }

      const response = await completeProfile(data);
      if (response.success) {
        toast.success("Profile updated!");

        // Update localStorage with the full updated user object from response
        if (response.body && response.body.user) {
          const stored = JSON.parse(localStorage.getItem("user") || "{}");
          let updated;

          if (stored.user) {
            // Preserve the { user: { ... } } structure
            updated = { ...stored, user: response.body.user };
          } else {
            // Use flat structure
            updated = response.body.user;
          }

          localStorage.setItem("user", JSON.stringify(updated));
          // Dispatch event to notify other components (Navbar, ProfileMain)
          // Using a small timeout to ensure the event is processed after the current execution context
          setTimeout(() => {
            window.dispatchEvent(new Event('userUpdated'));
          }, 100);
        }

        navigate("/businesseditcontact");
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
                          className={`h-[4px] w-full rounded-full transition-all duration-300 ${step <= 1 ? "bg-yellow-400" : "bg-white/30"
                            }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Avatar */}
                  <div className="relative my-4">
                    <div className="w-[190px] h-[190px] rounded-full bg-white/90 flex items-center justify-center overflow-hidden">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <svg
                          className="w-[70px] h-[70px] text-gray-400"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
                        </svg>
                      )}
                    </div>
                    <label htmlFor="image-upload" className="absolute bottom-0 right-1 w-[47px] h-[47px] bg-yellow-400 rounded-full flex items-center justify-center cursor-pointer text-black text-xs">
                      <img src={camera} alt="" />
                      <input type="file" id="image-upload" className="hidden" onChange={handleImageChange} accept="image/*" />
                    </label>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="w-full max-w-[560px] flex flex-col gap-4 text-white">
                    {/* Business Name */}
                    <div>
                      <label className="text-lg font-medium">Business Name</label>
                      <input
                        type="text"
                        name="businessName"
                        value={formData.businessName}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          let formattedValue = rawValue;
                          if (rawValue.length === 1) {
                            formattedValue = rawValue.charAt(0).toUpperCase() + rawValue.slice(1);
                          }
                          handleInputChange({
                            ...e,
                            target: { ...e.target, name: "businessName", value: formattedValue },
                          });
                        }}
                        placeholder="Enter"
                        className="w-full bg-transparent border border-white/20
                    text-white placeholder:text-white/40
                    rounded-md px-4 py-2.5
                    focus:outline-none focus:border-yellow-400 mt-2"
                      />
                      {errors.businessName && (
                        <p className="text-red-400 text-sm mt-1">{errors.businessName}</p>
                      )}
                    </div>

                    {/* Registration Number */}
                    <div>
                      <label className="text-lg font-medium">FMC License (Optional)</label>
                      <input
                        type="text"
                        name="registerationNumber"
                        value={formData.registerationNumber}
                        onChange={handleInputChange}
                        maxLength={40}
                        placeholder="Enter"
                        className="w-full bg-transparent border border-white/20
                    text-white placeholder:text-white/40
                    rounded-md px-4 py-2.5
                    focus:outline-none focus:border-yellow-400 mt-2"
                      />
                      {errors.registerationNumber && (
                        <p className="text-red-400 text-sm mt-1">{errors.registerationNumber}</p>
                      )}
                    </div>

                    {/* Country of Registration */}
                    <div className="relative">
                      <label className="text-lg font-medium text-white">
                        Country of Registration
                      </label>

                      <select
                        name="countryOfRegistration"
                        value={formData.countryOfRegistration}
                        onChange={handleInputChange}
                        className="w-full bg-transparent border border-white/20
                    text-white placeholder:text-white/40
                    rounded-md px-4 py-2.5
                    focus:outline-none focus:border-yellow-400 mt-2"
                      >
                        <option value="" disabled className="text-black">Select Country</option>
                        {COUNTRY_LIST.map((country) => (
                          <option
                            key={country}
                            value={country}
                            className="text-black"
                          >
                            {country}
                          </option>
                        ))}
                      </select>

                      {/* Location Icon */}
                      <div className="absolute right-4 top-[55px] pointer-events-none">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                            fill="#FFBF00"
                          />
                          <circle cx="12" cy="9" r="2.5" fill="#2D413F" />
                        </svg>
                      </div>
                      {errors.countryOfRegistration && (
                        <p className="text-red-400 text-sm mt-1">{errors.countryOfRegistration}</p>
                      )}
                    </div>

                    {/* Business Address with Autocomplete */}
                    <div>
                      <label className="text-lg font-medium">Business Address</label>
                      <div className="relative">
                        {apiLoaded ? (
                          <Autocomplete
                            onPlaceSelected={(place) => {
                              const { streetAddress, city, state } = parseAddressComponents(place);
                              const address = place.formatted_address || place.name;
                              const lat = place.geometry?.location?.lat?.();
                              const lng = place.geometry?.location?.lng?.();

                              setFormData(prev => ({
                                ...prev,
                                businessAddress: address,
                                businessLatitude: lat != null ? String(lat) : prev.businessLatitude,
                                businessLongitude: lng != null ? String(lng) : prev.businessLongitude,
                                streetAddress: streetAddress,
                                city: city,
                                state: state,
                              }));
                              setErrors(prev => ({ 
                                ...prev, 
                                businessAddress: '',
                                streetAddress: '',
                                city: '',
                                state: '',
                              }));
                            }}
                            options={{ types: ["address"] }}
                            defaultValue={formData.businessAddress}
                            placeholder="Enter"
                            className="w-full bg-transparent border border-white/20
                              text-white placeholder:text-white/40
                              rounded-md px-4 py-2.5
                              focus:outline-none focus:border-yellow-400 mt-2"
                            onChange={(e) => {
                              const value = e.target.value;
                              setFormData(prev => ({ ...prev, businessAddress: value }));
                              validateField("businessAddress", value);
                            }}
                          />
                        ) : (
                          <input
                            type="text"
                            name="businessAddress"
                            value={formData.businessAddress}
                            onChange={handleInputChange}
                            placeholder="Enter"
                            className="w-full bg-transparent border border-white/20
                              text-white placeholder:text-white/40
                              rounded-md px-4 py-2.5
                              focus:outline-none focus:border-yellow-400 mt-2"
                          />
                        )}
                        <img src={locationn} className="absolute top-[17px] right-4 w-5" alt="" />
                      </div>
                      {errors.businessAddress && (
                        <p className="text-red-400 text-sm mt-1">{errors.businessAddress}</p>
                      )}
                    </div>

                  

                    {/* City and State in Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-lg font-medium">City</label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          placeholder="Enter city"
                          className="w-full bg-transparent border border-white/20
                            text-white placeholder:text-white/40
                            rounded-md px-4 py-2.5
                            focus:outline-none focus:border-yellow-400 mt-2"
                        />
                        {errors.city && (
                          <p className="text-red-400 text-sm mt-1">{errors.city}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-lg font-medium">State</label>
                        <input
                          type="text"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          placeholder="Enter state"
                          className="w-full bg-transparent border border-white/20
                            text-white placeholder:text-white/40
                            rounded-md px-4 py-2.5
                            focus:outline-none focus:border-yellow-400 mt-2"
                        />
                        {errors.state && (
                          <p className="text-red-400 text-sm mt-1">{errors.state}</p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-lg font-medium">Brief Description of Business</label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Enter"
                        className="w-full bg-transparent border border-white/20
                    text-white placeholder:text-white/40
                    rounded-md px-4 py-2.5
                    focus:outline-none focus:border-yellow-400 h-[150px] mt-2"
                      />
                      {errors.description && (
                        <p className="text-red-400 text-sm mt-1">{errors.description}</p>
                      )}
                    </div>

                    {/* Button */}
                    <div className="flex justify-start mt-4">
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

export default BussinessEditNext;