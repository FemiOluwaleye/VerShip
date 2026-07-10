import React, { useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { FaEye, FaEyeSlash, FaSpinner } from "react-icons/fa";
import { locationn, shipp } from "../common/common-assets/assets-images";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { register, syncUserCookies } from "../api/cms";
import { toast } from "sonner";
import Autocomplete from "react-google-autocomplete";
import PhoneInput from "../components/PhoneInput";
import { validatePhoneForCountry } from "../utils/countryPhoneData";

const BussinessSignup = () => {
  const [formData, setFormData] = useState({
    companyName: "",
    working_as: "",
    email: "",
    phone: "",
    main_address: "",
    latitude: "",
    longitude: "",
    password: "",
    confirmPassword: "",
    country: { dialCode: "+1", code: "US" },
    agreeTerms: false,
    streetAddress: "",
    city: "",
    state: ""
  });
  const role = localStorage.getItem("role");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiLoaded, setApiLoaded] = useState(false);

  React.useEffect(() => {
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
  const location = useLocation();
  const stateFromRoute = location.state || {};
  const survey = typeof stateFromRoute === "object" ? stateFromRoute.survey : "";

  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "companyName":
        if (!value.trim()) error = "Legal name of company is required";
        else if (value.trim().length < 3) error = "Company name must be at least 3 characters";
        else if (value.trim().length > 100) error = "Company name cannot exceed 100 characters";
        break;
      case "email":
        if (!value.trim()) error = "Email is required";
        else if (!/\S+@\S+\.\S+/.test(value)) error = "Invalid email format";
        break;
      case "phone":
        error = validatePhoneForCountry(formData.country.dialCode, value);
        break;
      case "main_address":
        if (!value.trim()) error = "Address is required";
        break;
      case "streetAddress":
        if (!value.trim()) error = "Street address is required";
        else if (value.trim().length < 2) error = "Please enter a valid street address";
        break;
      case "city":
        if (!value.trim()) error = "City is required";
        else if (value.trim().length < 1) error = "City must be at least 1 characters";
        break;
      case "state":
        if (!value.trim()) error = "State is required";
        else if (value.trim().length < 1) error = "State must be at least 1 characters";
        break;
      case "password":
        if (!value) error = "Password is required";
        else {
          const hasUpper = /[A-Z]/.test(value);
          const hasLower = /[a-z]/.test(value);
          const hasNumber = /\d/.test(value);
          const hasSpecial = /[^A-Za-z0-9]/.test(value);
          const hasNoSpaces = !/\s/.test(value);
          const isLongEnough = value.length >= 8;

          if (!(hasUpper && hasLower && hasNumber && hasSpecial && hasNoSpaces && isLongEnough)) {
            error = "Password must be at least 8 character must contain upper case,lower case, number, special character no spaces.";
          }
        }
        break;
      case "confirmPassword":
        if (formData.password && value !== formData.password) error = "Passwords do not match";
        break;
      case "agreeTerms":
        if (!value) error = "You must agree to the Terms and conditions and Privacy Policy";
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let formattedValue = type === "checkbox" ? checked : value.replace(/^\s+/, "");

    if (name === "phone") {
      formattedValue = formattedValue.replace(/[^0-9]/g, "");
    }

    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));

    if (name === "password" && formData.confirmPassword) {
      validateField("confirmPassword", formData.confirmPassword);
    }

    validateField(name, formattedValue);
  };

  const validate = () => {
    if (!formData.companyName.trim()) {
      toast.error("Legal name of company is required");
      return false;
    }
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error("Invalid email format");
      return false;
    }
    const phoneError = validatePhoneForCountry(formData.country.dialCode, formData.phone);
    if (phoneError) {
      toast.error(phoneError);
      return false;
    }
    if (!formData.main_address.trim()) {
      toast.error("Address is required");
      return false;
    }
    if (!formData.password) {
      toast.error("Password is required");
      return false;
    } else if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return false;
    }
    if (!formData.agreeTerms) {
      toast.error("You must agree to the Terms and conditions and Privacy Policy");
      return false;
    }
    return true;
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
      // toast.error("Please fix the errors in the form");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.companyName,
        email: formData.email,
        password: formData.password,
        number: formData.phone,
        countryCode: formData.country.dialCode,
        role: "2", // Role 2 for business
        main_address: formData.main_address,
        latitude: formData.latitude,
        longitude: formData.longitude,
        working_as: formData.working_as,
        streetAddress: formData.streetAddress,
        city: formData.city,
        state: formData.state,

        survey: survey,
      };

      const response = await register(payload);
      if (response.status === 200 || response.status === "1") {
        console.log("Registratio------------", response);
        toast.success(response.message || "Registration successful!");
        localStorage.setItem("token", response.body.authtoken);
        localStorage.setItem("user", JSON.stringify(response.body.user));
        sessionStorage.setItem("userEmail", formData.email);
        await syncUserCookies(response.body.user.id);
        navigate("/businessverification", { replace: true });
      } else {
        toast.error(response.message || "Registration failed");
      }
    } catch (error) {
      console.error("Signup error:", error);
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
        
        w-[90vw] sm:w-[500px] md:w-[650px] lg:w-[800px]
        px-6 sm:px-20 md:px-25 lg:px-30 py-10 mb-20 mt-35"
      >
        {/* Heading */}
        <h1 className="text-[26px] lg:text-[32px] text-nowrap font-semibold">
          Create Your Account
        </h1>
        <p className="text-sm text-white/70 -mt-3">
          Please enter required details.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="text-lg font-medium">Legal Name of Business</label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={(e) => {
                const rawValue = e.target.value;
                let formattedValue = rawValue;

                if (rawValue.length === 1) {
                  // Only capitalize the first character if it's the first letter
                  formattedValue = rawValue.charAt(0).toUpperCase() + rawValue.slice(1);
                }

                handleInputChange({
                  ...e,
                  target: {
                    ...e.target,
                    name: "companyName",
                    value: formattedValue,
                  },
                });
              }}
              placeholder="Enter"
              className="w-full bg-transparent border border-white/20
      text-white placeholder:text-white/40
      rounded-[16px] px-4 mt-2 py-2.5
      focus:outline-none focus:border-yellow-400"
            />
            {errors.companyName && (
              <p className="text-red-400 text-sm mt-1">{errors.companyName}</p>
            )}
          </div>


          {/* <div>
            <label className="text-lg font-medium">Doing Business As</label>
            <input
              type="text"
              name="working_as"
              value={formData.working_as}
              onChange={handleInputChange}
              placeholder="Enter"
              className="w-full mt-2 bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-[16px] px-4 py-2.5
              focus:outline-none focus:border-yellow-400"
            />
            {errors.working_as && (
              <p className="text-red-400 text-sm mt-1">{errors.working_as}</p>
            )}
          </div> */}
          <div>
            <label className="text-lg font-medium">Doing Business As(Optional)</label>
            <input
              type="text"
              name="working_as"
              value={formData.working_as}
              onChange={(e) => {
                const rawValue = e.target.value;
                let formattedValue = rawValue;

                if (rawValue.length === 1) {
                  // Only capitalize the first character if it's the first letter
                  formattedValue = rawValue.charAt(0).toUpperCase() + rawValue.slice(1);
                }

                handleInputChange({
                  ...e,
                  target: {
                    ...e.target,
                    name: "working_as",
                    value: formattedValue,
                  },
                });
              }}
              placeholder="Enter"
              className="w-full mt-2 bg-transparent border border-white/20
      text-white placeholder:text-white/40
      rounded-[16px] px-4 py-2.5
      focus:outline-none focus:border-yellow-400"
            />
            {errors.working_as && (
              <p className="text-red-400 text-sm mt-1">{errors.working_as}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="text-lg font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter"
              className="w-full mt-2 bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-[16px] px-4 py-2.5
              focus:outline-none focus:border-yellow-400"
            />
            {errors.email && (
              <p className="text-red-400 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <PhoneInput
              label="Mobile Number"
              value={formData.phone}
              onChange={(val) => {
                setFormData(prev => ({ ...prev, phone: val }));
                validateField("phone", val);
              }}
              country={formData.country}
              onCountryChange={(countryObj) => {
                setFormData(prev => ({ ...prev, country: countryObj }));
                if (formData.phone) validateField("phone", formData.phone);
              }}
              error={errors.phone}
              placeholder="Enter"
            />
          </div>

          <div>
            <label className="text-lg font-medium">Street Address of Main Location</label>
            <div className="relative">
              {apiLoaded ? (
                // Update the onPlaceSelected handler for Autocomplete
                <Autocomplete
                  onPlaceSelected={(place) => {
                    // Parse address components
                    let streetAddress = '';
                    let city = '';
                    let state = '';
                    let formattedAddress = place.formatted_address || place.name;

                    // Extract address components
                    if (place.address_components) {
                      for (const component of place.address_components) {
                        const types = component.types;

                        // Street address (street number + route)
                        if (types.includes('street_number')) {
                          streetAddress = component.long_name + ' ' + streetAddress;
                        }
                        if (types.includes('route')) {
                          streetAddress = streetAddress + component.long_name;
                        }

                        // City/Locality
                        if (types.includes('locality') || types.includes('administrative_area_level_3')) {
                          city = component.long_name;
                        }

                        // State/Administrative Area Level 1
                        if (types.includes('administrative_area_level_1')) {
                          state = component.long_name;
                        }

                        // Also check for postal_town or other city equivalents
                        if (!city && types.includes('postal_town')) {
                          city = component.long_name;
                        }

                        // For some addresses, city might be in administrative_area_level_2
                        if (!city && types.includes('administrative_area_level_2')) {
                          city = component.long_name;
                        }
                      }

                      // Clean up street address (remove extra spaces)
                      streetAddress = streetAddress.trim();
                    }

                    // If street address is still empty, try to use the first line of formatted address
                    if (!streetAddress && formattedAddress) {
                      const addressParts = formattedAddress.split(',');
                      if (addressParts.length > 0) {
                        streetAddress = addressParts[0].trim();
                      }
                    }

                    // Update all form fields
                    setFormData((prev) => ({
                      ...prev,
                      main_address: formattedAddress,
                      streetAddress: streetAddress,
                      city: city,
                      state: state,
                      latitude: place.geometry.location.lat().toString(),
                      longitude: place.geometry.location.lng().toString(),
                    }));

                    // Clear errors for these fields
                    setErrors((prev) => ({
                      ...prev,
                      main_address: "",
                      streetAddress: "",
                      city: "",
                      state: ""
                    }));
                  }}
                  options={{ types: ["address"] }}
                  defaultValue={formData.main_address}
                  placeholder="Enter"
                  className="w-full mt-2 bg-transparent relative border border-white/20
    text-white placeholder:text-white/40
    rounded-[16px] px-4 py-2.5
    focus:outline-none focus:border-yellow-400"
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData(prev => ({ ...prev, main_address: value }));
                    validateField("main_address", value);
                  }}
                />
              ) : (
                <input
                  type="text"
                  name="main_address"
                  value={formData.main_address}
                  onChange={handleInputChange}
                  placeholder="Enter"
                  className="w-full mt-2 bg-transparent relative border border-white/20
                text-white placeholder:text-white/40
                rounded-[16px] px-4 py-2.5
                focus:outline-none focus:border-yellow-400"
                />
              )}
              <img src={locationn} className="absolute top-[17px] right-4 w-5" alt="" />
            </div>
            {errors.main_address && (
              <p className="text-red-400 text-sm mt-1">{errors.main_address}</p>
            )}
          </div>


          {/* City */}
          <div>
            <label className="text-lg font-medium">City</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              placeholder="Enter city"
              className="w-full mt-2 bg-transparent border border-white/20
      text-white placeholder:text-white/40
      rounded-[16px] px-4 py-2.5
      focus:outline-none focus:border-yellow-400"
            />
            {errors.city && (
              <p className="text-red-400 text-sm mt-1">{errors.city}</p>
            )}
          </div>

          {/* State */}
          <div>
            <label className="text-lg font-medium">State</label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleInputChange}
              placeholder="Enter state"
              className="w-full mt-2 bg-transparent border border-white/20
      text-white placeholder:text-white/40
      rounded-[16px] px-4 py-2.5
      focus:outline-none focus:border-yellow-400"
            />
            {errors.state && (
              <p className="text-red-400 text-sm mt-1">{errors.state}</p>
            )}
          </div>
          {/* Password */}
          <div className="flex flex-col">
            <label className="text-lg font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="********"
                className="w-full bg-transparent border mt-2 border-white/20
                text-white placeholder:text-white/40
                rounded-[16px] px-4 pr-12 py-2.5
                focus:outline-none focus:border-yellow-400"
              />
              <div
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[60%] -translate-y-1/2 cursor-pointer text-white/50"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </div>
            </div>
            {errors.password && (
              <p className="text-red-400 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col">
            <label className="text-lg font-medium">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="********"
                className="w-full bg-transparent border mt-2 border-white/20
                text-white placeholder:text-white/40
                rounded-[16px] px-4 pr-12 py-2.5
                focus:outline-none focus:border-yellow-400"
              />
              <div
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-[60%] -translate-y-1/2 cursor-pointer text-white/50"
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </div>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-400 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Terms */}
          <div className="flex flex-col gap-1">
            <div className="flex items-start gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                name="agreeTerms"
                checked={formData.agreeTerms}
                onChange={handleInputChange}
                className="w-[16px] h-[16px] accent-yellow-400 mt-1"
              />
              <p>
                By signing up, you agree to the{" "}
                <Link to="/terms" className="text-yellow-400 hover:text-yellow-300 underline">
                  Terms and conditions
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="text-yellow-400 hover:text-yellow-300 underline">
                  Privacy Policy
                </Link>.
              </p>
            </div>
            {errors.agreeTerms && (
              <p className="text-red-400 text-sm mt-1">{errors.agreeTerms}</p>
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
              {loading ? <FaSpinner className="animate-spin" /> : "Sign Up"}
            </button>
          </div>
        </form>

        {/* Login */}
        <p className="text-sm text-white/80 mt-2">
          Already have an account?
          <span onClick={() => navigate('/type', {
            state: {
              mode: "login",
              role: "2"
            }
          })} className="text-yellow-400 cursor-pointer underline"> Log In</span>
        </p>

      </div>

    </div>
  );
};

export default BussinessSignup;
