import React, { useState, useEffect } from "react";
import { FiChevronDown } from "react-icons/fi";
import { FaEye, FaEyeSlash, FaSpinner } from "react-icons/fa";
import { camera, shipp } from "../common/common-assets/assets-images";
import { useNavigate } from "react-router-dom";
import { completeProfile, getProviderProfile } from "../api/cms";
import { toast } from "sonner";
import Autocomplete from "react-google-autocomplete";
import countriesData from "world-countries";

const COUNTRY_LIST = ["USA"];

const BuisnessCreateAccount = () => {
  const [formData, setFormData] = useState({
    businessName: "",
    registerationNumber: "",
    countryOfRegistration: "",
    businessAddress: "",
    businessLatitude: "",
    businessLongitude: "",
    description: "",
    city: "", // Added
    state: "", // Added
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [errors, setErrors] = useState({});
  const [apiLoaded, setApiLoaded] = useState(false);

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

  const navigate = useNavigate();

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user && user.id) {
          setUserId(user.id);
          fetchProfile(user.id);
        }
      } catch (e) {
        console.error("Error parsing user from localStorage", e);
      }
    }
  }, []);

  const fetchProfile = async (id) => {
    try {
      const response = await getProviderProfile(id);
      if (response.success && response.body) {
        const user = response.body;
        const businessInfo = user.businessInfo || {};
        setFormData({
          businessName: businessInfo.businessName || "",
          registerationNumber: businessInfo.registerationNumber || "",
          countryOfRegistration: businessInfo.countryOfRegistration || "",
          businessAddress: businessInfo.businessAddress || user.location || "",
          businessLatitude: businessInfo.businessLatitude || user.latitude || "",
          businessLongitude: businessInfo.businessLongitude || user.longitude || "",
          description: businessInfo.description || user.bio || "",
          city: businessInfo.city || "",
          state: businessInfo.state || "",
        });
        if (user.image) {
          setImagePreview(`${import.meta.env.VITE_IMAGE_URL}${user.image}`);
        }
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  };

  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "businessName":
        if (!value.trim()) error = "Business Name is required";
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

    setFormData((prev) => ({ ...prev, [name]: formattedValue }));
    validateField(name, formattedValue);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
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
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("providerId", userId);
      form.append("businessName", formData.businessName);
      form.append("registerationNumber", formData.registerationNumber);
      form.append("countryOfRegistration", formData.countryOfRegistration);
      form.append("businessAddress", formData.businessAddress);
      form.append("businessLatitude", formData.businessLatitude);
      form.append("businessLongitude", formData.businessLongitude);
      form.append("description", formData.description);
      form.append("city", formData.city);
      form.append("state", formData.state);
      form.append("profile_step", 2);
      if (image) {
        form.append("image", image);
      }

      const response = await completeProfile(form);
      if (response.status === 200 || response.status === "1") {
        toast.success(response.message || "Profile updated successfully!");
        if (response.body && response.body.user) {
          localStorage.setItem("user", JSON.stringify(response.body.user));
          window.dispatchEvent(new Event('userUpdated'));
        }
        navigate("/businesscontact",{ replace: true });
      } else {
        toast.error(response.message || "Something went wrong");
      }
    } catch (error) {
      console.error("Profile completion error:", error);
      toast.error(error.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundImage: ` url(${shipp})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Card */}
      <div
        className="flex flex-col items-center text-white gap-6
        bg-[#2D413F] backdrop-blur-md
        rounded-[22px]
        shadow-[0_25px_80px_rgba(0,0,0,0.6)]
        w-[90vw] sm:w-[500px] lg:w-[800px]
        px-6 sm:px-15 py-10 mb-20 md:mt-35 mt-15"
      >
        {/* Heading */}
        <h1 className="text-[22px] lg:text-[32px] font-semibold">
          Create Your Account
        </h1>
        <p className="text-lg text-white -mt-3">
          Please enter required details.
        </p>

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
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
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
          <label className="absolute bottom-0 right-1 w-[47px] h-[47px] bg-yellow-400 rounded-full flex items-center justify-center cursor-pointer text-black text-xs">
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            <img src={camera} alt="" />
          </label>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-[560px] flex flex-col gap-4">
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
                  target: {
                    ...e.target,
                    name: "businessName",
                    value: formattedValue,
                  },
                });
              }}
              placeholder="Enter"
              className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2.5
              focus:outline-none focus:border-yellow-400"
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
              focus:outline-none focus:border-yellow-400"
            />
            {errors.registerationNumber && (
              <p className="text-red-400 text-sm mt-1">{errors.registerationNumber}</p>
            )}
          </div>

          {/* Country */}
          <div className="relative">
            <label className="text-lg font-medium text-white">
              Country of Registration
            </label>
            <select
              name="countryOfRegistration"
              value={formData.countryOfRegistration || ""}
              onChange={handleInputChange}
              className="w-full appearance-none bg-transparent
              border border-white/20
              text-white/70 rounded-xl
              px-4 py-3 pr-12
              focus:outline-none focus:border-yellow-400"
            >
              <option value="" disabled className="text-black">
                Select
              </option>
              {COUNTRY_LIST.map((country) => (
                <option key={country} value={country} className="text-black">
                  {country}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-[45px] pointer-events-none">
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
            {apiLoaded ? (
              <Autocomplete
                onPlaceSelected={(place) => {
                  const { streetAddress, city, state } = parseAddressComponents(place);
                  
                  setFormData((prev) => ({
                    ...prev,
                    businessAddress: place.formatted_address || place.name,
                    businessLatitude: place.geometry.location.lat().toString(),
                    businessLongitude: place.geometry.location.lng().toString(),
                    city: city,
                    state: state,
                  }));
                  setErrors((prev) => ({ 
                    ...prev, 
                    businessAddress: "", 
                    city: "", 
                    state: "" 
                  }));
                }}
                options={{ types: ["address"] }}
                defaultValue={formData.businessAddress}
                placeholder="Enter"
                className="w-full bg-transparent border border-white/20
                  text-white placeholder:text-white/40
                  rounded-md px-4 py-2.5
                  focus:outline-none focus:border-yellow-400"
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
                focus:outline-none focus:border-yellow-400"
              />
            )}
            {errors.businessAddress && (
              <p className="text-red-400 text-sm mt-1">{errors.businessAddress}</p>
            )}
          </div>

          {/* City Field */}
          <div>
            <label className="text-lg font-medium">City</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={(e) => {
                const value = e.target.value;
                setFormData(prev => ({ ...prev, city: value }));
                validateField("city", value);
              }}
              placeholder="Enter city"
              className="w-full bg-transparent border border-white/20
                text-white placeholder:text-white/40
                rounded-md px-4 py-2.5
                focus:outline-none focus:border-yellow-400"
            />
            {errors.city && (
              <p className="text-red-400 text-sm mt-1">{errors.city}</p>
            )}
          </div>

          {/* State Field */}
          <div>
            <label className="text-lg font-medium">State</label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={(e) => {
                const value = e.target.value;
                setFormData(prev => ({ ...prev, state: value }));
                validateField("state", value);
              }}
              placeholder="Enter state"
              className="w-full bg-transparent border border-white/20
                text-white placeholder:text-white/40
                rounded-md px-4 py-2.5
                focus:outline-none focus:border-yellow-400"
            />
            {errors.state && (
              <p className="text-red-400 text-sm mt-1">{errors.state}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-lg font-medium">Brief Description of Business</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={(e) => {
                let value = e.target.value;
                if (value.length === 1) {
                  value = value.charAt(0).toUpperCase();
                }
                handleInputChange({
                  ...e,
                  target: {
                    ...e.target,
                    name: "description",
                    value: value,
                  },
                });
              }}
              placeholder="Enter"
              className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2.5
              focus:outline-none focus:border-yellow-400 h-[150px]"
            />
            {errors.description && (
              <p className="text-red-400 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          {/* Button */}
          <div className="flex justify-center mt-4">
            <button
              disabled={loading}
              type="submit"
              className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
              text-black font-bold text-[17px] sm:text-[19px]
              rounded-full
              h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
              transition-all flex items-center justify-center gap-2
              disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <FaSpinner className="animate-spin" /> : "Next"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BuisnessCreateAccount;