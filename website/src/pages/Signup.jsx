import React, { useState, useRef, useEffect } from "react";
import { FiChevronDown } from "react-icons/fi";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { camera, shipp, locationn } from "../common/common-assets/assets-images";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import { register } from "../api/cms";
import PhoneInput from "../components/PhoneInput";
import { validatePhoneForCountry } from "../utils/countryPhoneData";
import Autocomplete from "react-google-autocomplete";

const Signup = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    lastName: "",
    email: "",
    number: "",
    password: "",
    confirmPassword: "",
    country: { dialCode: "+1", code: "US" },
    agreeTerms: false,
    main_address: "",
    streetAddress: "",
    city: "",
    state: "",
    latitude: "",
    longitude: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiLoaded, setApiLoaded] = useState(false);

  const location = useLocation();
  const stateFromRoute = location.state || {};
  const role = typeof stateFromRoute === "object" ? stateFromRoute.role : stateFromRoute;
  const survey = typeof stateFromRoute === "object" ? stateFromRoute.survey : "";

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

  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "name":
        if (!value.trim()) error = "Name is required";
        else if (value.trim().length < 3) error = "Name must be at least 3 characters";
        else if (value.trim().length > 50) error = "Name cannot exceed 50 characters";
        break;
      case "lastName":
        if (!value.trim()) error = "Last name is required";
        else if (value.trim().length < 3) error = "Last name must be at least 3 characters";
        else if (value.trim().length > 50) error = "Last name cannot exceed 50 characters";
        break;
      case "email":
        if (!value.trim()) error = "Email is required";
        else if (!/\S+@\S+\.\S+/.test(value)) error = "Invalid email format";
        break;
      case "number":
        error = validatePhoneForCountry(formData.country.dialCode, value);
        break;
      case "main_address":
        if (!value.trim()) error = "Address is required";
        break;
      case "streetAddress":
        if (!value.trim()) error = "Street address is required";
        else if (value.trim().length < 3) error = "Please enter a valid street address";
        break;
      case "city":
        if (!value.trim()) error = "City is required";
        break;
      case "state":
        if (!value.trim()) error = "State is required";
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
        if (!value) error = "Confirm Password is required";
        else if (value !== formData.password) error = "Passwords do not match";
        break;
      case "agreeTerms":
        if (!value) error = "You must agree to the terms";
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = type === "checkbox" ? checked : value;

    if (type !== "checkbox") {
      finalValue = finalValue.replace(/^\s+/, "");
      if (name === "number") {
        finalValue = finalValue.replace(/[^0-9]/g, ""); 
      }
    }

    setFormData(prev => ({ ...prev, [name]: finalValue }));
    validateField(name, finalValue);

    if (name === "password" && formData.confirmPassword) {
      validateField("confirmPassword", formData.confirmPassword);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid image file (JPEG, PNG, GIF, WebP)");
      return;
    }

    setProfileImage(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const removeProfileImage = () => {
    setProfileImage(null);
    setProfileImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      return;
    }

    if (!formData.agreeTerms) {
      toast.error("You must agree to the Terms and conditions and Privacy Policy.");
      return;
    }

    setIsUploading(true);
    try {
      const data = new FormData();
      data.append("name", formData.name);
      data.append("lastName", formData.lastName);
      data.append("email", formData.email);
      data.append("number", formData.number);
      data.append("countryCode", formData.country.dialCode);
      data.append("password", formData.password);
      data.append("confirmPassword", formData.confirmPassword);
      data.append("role", role);
      data.append("survey", survey);
      data.append("main_address", formData.main_address);
      data.append("streetAddress", formData.streetAddress);
      data.append("city", formData.city);
      data.append("state", formData.state);
      data.append("latitude", formData.latitude);
      data.append("longitude", formData.longitude);

      const response = await register(data);

      if (response.success) {
        toast.success(response.message);
        if (role === "1") {
          navigate("/verification", { state: { email: formData.email } });
        } else {
          navigate("/login");
        }
      } else {
        toast.error(response.message || "Registration failed.");
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("An unexpected error occurred during registration.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundImage: `url(${shipp})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Card */}
      <div
        className="flex flex-col items-center text-white gap-4
        bg-[#2D413F] backdrop-blur-md
        rounded-[22px]
        shadow-[0_25px_80px_rgba(0,0,0,0.6)]
        w-[90vw] sm:w-[560px] lg:w-[760px]
        px-6 sm:px-12 py-8 my-12"
      >
        {/* Heading */}
        <h1 className="text-[24px] lg:text-[28px] text-nowrap font-semibold">
          Create Your Account
        </h1>
        <p className="text-sm text-white/70 -mt-2">
          Please enter required details.
        </p>

        <form className="w-full grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3" onSubmit={handleSubmit}>
          {/* First Name */}
          <div>
            <label htmlFor="signup-name" className="text-sm font-medium">First Name</label>
            <input
              id="signup-name"
              type="text"
              name="name"
              placeholder="Enter"
              required
              aria-required="true"
              aria-invalid={errors.name ? "true" : "false"}
              className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2
              focus:outline-none focus:border-yellow-400"
              value={formData.name}
              onChange={(e) => {
                const rawValue = e.target.value;
                let formattedValue = rawValue;

                if (rawValue.length === 1) {
                  formattedValue = rawValue.charAt(0).toUpperCase() + rawValue.slice(1);
                }

                handleChange({
                  ...e,
                  target: {
                    ...e.target,
                    name: "name",
                    value: formattedValue,
                  },
                });
              }}
            />
            {errors.name && (
              <p className="text-red-400 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="signup-lastName" className="text-sm font-medium">Last Name</label>
            <input
              id="signup-lastName"
              type="text"
              name="lastName"
              placeholder="Enter"
              required
              aria-required="true"
              aria-invalid={errors.lastName ? "true" : "false"}
              className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2
              focus:outline-none focus:border-yellow-400"
              value={formData.lastName}
              onChange={(e) => {
                const rawValue = e.target.value;
                let formattedValue = rawValue;

                if (rawValue.length === 1) {
                  formattedValue = rawValue.charAt(0).toUpperCase() + rawValue.slice(1);
                }

                handleChange({
                  ...e,
                  target: {
                    ...e.target,
                    name: "lastName",
                    value: formattedValue,
                  },
                });
              }}
            />
            {errors.lastName && (
              <p className="text-red-400 text-sm mt-1">{errors.lastName}</p>
            )}
          </div>

          {/* Email */}
          <div className="sm:col-span-2">
            <label htmlFor="signup-email" className="text-sm font-medium">Email</label>
            <input
              id="signup-email"
              type="email"
              name="email"
              placeholder="Enter"
              required
              aria-required="true"
              aria-invalid={errors.email ? "true" : "false"}
              className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2
              focus:outline-none focus:border-yellow-400"
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && (
              <p className="text-red-400 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Phone Input */}
          <div className="sm:col-span-2">
            <PhoneInput
              label="Mobile Number"
              value={formData.number}
              onChange={(val) => {
                setFormData(prev => ({ ...prev, number: val }));
                validateField("number", val);
              }}
              country={formData.country}
              onCountryChange={(countryObj) => {
                setFormData(prev => ({ ...prev, country: countryObj }));
                if (formData.number) validateField("number", formData.number);
              }}
              error={errors.number}
              placeholder="Enter"
            />
          </div>

          {/* Street Address of Main Location with Autocomplete */}
          <div className="sm:col-span-2">
            <label htmlFor="signup-address" className="text-sm font-medium">Street Address of Main Location</label>
            <div className="relative">
              {apiLoaded ? (
                <Autocomplete
                  id="signup-address"
                  aria-required="true"
                  aria-invalid={errors.main_address ? "true" : "false"}
                  onPlaceSelected={(place) => {
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
                  className="w-full bg-transparent border border-white/20
                  text-white placeholder:text-white/40
                  rounded-md px-4 py-2 pr-10
                  focus:outline-none focus:border-yellow-400"
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData(prev => ({ ...prev, main_address: value }));
                    validateField("main_address", value);
                  }}
                />
              ) : (
                <input
                  id="signup-address"
                  type="text"
                  name="main_address"
                  value={formData.main_address}
                  onChange={handleChange}
                  aria-required="true"
                  aria-invalid={errors.main_address ? "true" : "false"}
                  placeholder="Enter"
                  className="w-full bg-transparent border border-white/20
                  text-white placeholder:text-white/40
                  rounded-md px-4 py-2 pr-10
                  focus:outline-none focus:border-yellow-400"
                />
              )}
              <img src={locationn} className="absolute top-1/2 right-4 w-5 -translate-y-1/2" alt="" />
            </div>
            {errors.main_address && (
              <p className="text-red-400 text-sm mt-1">{errors.main_address}</p>
            )}
          </div>

          {/* City */}
          <div>
            <label htmlFor="signup-city" className="text-sm font-medium">City</label>
            <input
              id="signup-city"
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              aria-required="true"
              aria-invalid={errors.city ? "true" : "false"}
              placeholder="Enter city"
              className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2
              focus:outline-none focus:border-yellow-400"
            />
            {errors.city && (
              <p className="text-red-400 text-sm mt-1">{errors.city}</p>
            )}
          </div>

          {/* State */}
          <div>
            <label htmlFor="signup-state" className="text-sm font-medium">State</label>
            <input
              id="signup-state"
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              aria-required="true"
              aria-invalid={errors.state ? "true" : "false"}
              placeholder="Enter state"
              className="w-full bg-transparent border border-white/20
              text-white placeholder:text-white/40
              rounded-md px-4 py-2
              focus:outline-none focus:border-yellow-400"
            />
            {errors.state && (
              <p className="text-red-400 text-sm mt-1">{errors.state}</p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col">
            <label htmlFor="signup-password" className="text-sm font-medium">Password</label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="********"
                required
                aria-required="true"
                aria-invalid={errors.password ? "true" : "false"}
                className="w-full bg-transparent border border-white/20
                text-white placeholder:text-white/40
                rounded-md px-4 pr-12 py-2
                focus:outline-none focus:border-yellow-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-white/50 hover:text-white"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col">
            <label htmlFor="signup-confirmPassword" className="text-sm font-medium">Confirm Password</label>
            <div className="relative">
              <input
                id="signup-confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="********"
                required
                aria-required="true"
                aria-invalid={errors.confirmPassword ? "true" : "false"}
                className="w-full bg-transparent border border-white/20
                text-white placeholder:text-white/40
                rounded-md px-4 pr-12 py-2
                focus:outline-none focus:border-yellow-400"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-white/50 hover:text-white"
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-400 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Terms */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <div className="flex items-start gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                name="agreeTerms"
                aria-label="I agree to the Terms and conditions and Privacy Policy"
                aria-required="true"
                aria-invalid={errors.agreeTerms ? "true" : "false"}
                className="w-[16px] h-[16px] accent-yellow-400 mt-1"
                checked={formData.agreeTerms}
                onChange={handleChange}
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
              <p className="text-red-400 text-sm">{errors.agreeTerms}</p>
            )}
          </div>

          {/* Button */}
          <div className="flex justify-center mt-2 sm:col-span-2">
            <button
              type="submit"
              disabled={isUploading}
              className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
              text-black font-bold text-[17px] sm:text-[19px]
              rounded-full
              h-[60px] w-[180px] sm:h-[70px] sm:w-[240px]
              transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? "Getting Started..." : "Sign Up"}
            </button>
          </div>
        </form>

        {/* Login */}
        <p className="text-sm text-white/80 mt-2">
          Already have an account?
          <span
            onClick={() => navigate('/type', {
              state: {
                mode: "login",
                role: role
              }
            })}
            className="text-yellow-400 cursor-pointer underline ml-1 hover:text-yellow-300"
          >
            Log In
          </span>
        </p>
      </div>
    </div>
  );
};

export default Signup;