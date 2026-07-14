import React, { useState } from 'react';
import { map } from "../common/common-assets/assets-images";
import Commonbanner from '../components/Commonbanner';
import Seo from "../components/Seo";
import { contactUs } from "../api/cms";
import { toast } from "sonner";
import { FaSpinner } from "react-icons/fa";
import PhoneInput from "../components/PhoneInput";
import { validatePhoneForCountry } from "../utils/countryPhoneData";

const Contact = () => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    country: { dialCode: "+1", code: "US" },
    number: "",
    textarea: ""
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "first_name":
        if (!value.trim()) error = "First Name is required";
        break;
      case "last_name":
        if (!value.trim()) error = "Last Name is required";
        break;
      case "email":
        if (!value.trim()) error = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = "Invalid email format";
        break;
      case "number":
        error = validatePhoneForCountry(formData.countryCode, value);
        break;
      case "textarea":
        if (!value.trim()) error = "Message is required";
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

    if (name === "number") {
      formattedValue = formattedValue.replace(/[^0-9]/g, "");
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
    validateField(name, formattedValue);
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

    setIsLoading(true);
    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        countryCode: formData.countryCode,
        number: formData.number,
        message: formData.textarea
      };

      const response = await contactUs(payload);
      toast.success(response.message || "Message sent successfully!");

      // Clear form
      setFormData({ first_name: "", last_name: "", email: "", countryCode: "+1", number: "", textarea: "" });
      setErrors({});
    } catch (error) {
      console.error("Contact form error:", error);
      if (error.response && error.response.data) {
        toast.error(error.response.data.message || "Validation error");
      } else {
        toast.error("Something went wrong!");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className='bg-[linear-gradient(180deg,#2C4736_0%,#09120F_100%)] pb-10 lg:pb-20'>
      <Seo title="Contact Us" path="/contact" description="Get in touch with the VerShip team for help with barrel shipping from the USA to Jamaica." />
      <Commonbanner title="Contact Us" />
      <div className="container mx-auto text-white mt-10 lg:mt-20">
        <div className="mx-auto flex flex-col lg:flex-row pb-10 justify-center bg-[#2D413F] rounded-[18px] p-8 gap-5 lg:gap-10">
          <form className="w-full rounded-[20px] space-y-6" onSubmit={handleSubmit}>

            <div>
              <label htmlFor="contact-first_name" className="block text-[18px] font-medium mb-1">First Name</label>
              <input
                id="contact-first_name"
                aria-required="true"
                aria-invalid={errors.first_name ? "true" : "false"}
                aria-describedby={errors.first_name ? "contact-first_name-error" : undefined}
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={(e) => {
                  let val = e.target.value;

                  // Auto-capitalize first letter only
                  if (val.length === 1) {
                    val = val.charAt(0).toUpperCase() + val.slice(1);
                  }

                  handleInputChange({
                    ...e,
                    target: {
                      ...e.target,
                      name: "first_name",
                      value: val,
                    },
                  });
                }}
                className={`w-full px-4 py-3 rounded-[16px] text-white bg-transparent border ${errors.first_name ? 'border-red-500' : 'border-[#4E6B5D]'} text-[14px] focus:outline-none focus:border-yellow-400`}
                placeholder="Enter your First Name"
              />
              {errors.first_name && (
                <p id="contact-first_name-error" role="alert" className="text-red-400 text-sm mt-1">{errors.first_name}</p>
              )}
            </div>


            <div>
              <label htmlFor="contact-last_name" className="block text-[18px] font-medium mb-1">Last Name</label>
              <input
                id="contact-last_name"
                aria-required="true"
                aria-invalid={errors.last_name ? "true" : "false"}
                aria-describedby={errors.last_name ? "contact-last_name-error" : undefined}
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={(e) => {
                  let val = e.target.value;

                  if (val.length === 1) {
                    val = val.charAt(0).toUpperCase() + val.slice(1);
                  }

                  handleInputChange({
                    ...e,
                    target: {
                      ...e.target,
                      name: "last_name",
                      value: val,
                    },
                  });
                }}
                className={`w-full px-4 py-3 rounded-[16px] text-white bg-transparent border ${errors.last_name ? 'border-red-500' : 'border-[#4E6B5D]'} text-[14px] focus:outline-none focus:border-yellow-400`}
                placeholder="Enter your Last Name"
              />
              {errors.last_name && (
                <p id="contact-last_name-error" role="alert" className="text-red-400 text-sm mt-1">{errors.last_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-[18px] font-medium mb-1">Email</label>
              <input
                id="contact-email"
                aria-required="true"
                aria-invalid={errors.email ? "true" : "false"}
                aria-describedby={errors.email ? "contact-email-error" : undefined}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-[16px] text-white bg-transparent border ${errors.email ? 'border-red-500' : 'border-[#4E6B5D]'} text-[14px] focus:outline-none focus:border-yellow-400`}
                placeholder="Enter your Email"
              />
              {errors.email && (
                <p id="contact-email-error" role="alert" className="text-red-400 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-[18px] font-medium mb-1">Mobile Number</label>
              <PhoneInput
                value={formData.number}
                onChange={(val) => {
                  setFormData(prev => ({ ...prev, number: val }));
                  validateField("number", val);
                }}
                country={formData.country}              
                onCountryChange={(countryObj) => {      
                  setFormData(prev => ({ ...prev, country: countryObj }));
                  validateField("number", formData.number);
                }}
                error={errors.number}
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-[18px] font-medium mb-1">Message</label>
              <textarea
                id="contact-message"
                aria-required="true"
                aria-invalid={errors.textarea ? "true" : "false"}
                aria-describedby={errors.textarea ? "contact-message-error" : undefined}
                name="textarea"
                value={formData.textarea}
                onChange={(e) => {
                  let val = e.target.value;

                  if (val.length === 1) {
                    val = val.charAt(0).toUpperCase() + val.slice(1);
                  }

                  handleInputChange({
                    ...e,
                    target: {
                      ...e.target,
                      name: "textarea",
                      value: val,
                    },
                  });
                }}
                className={`w-full px-4 py-3 rounded-[16px] text-white bg-transparent border ${errors.textarea ? 'border-red-500' : 'border-[#4E6B5D]'} text-[14px] focus:outline-none focus:border-yellow-400 resize-none min-h-[120px]`}
                placeholder="Write here..."
              />
              {errors.textarea && (
                <p id="contact-message-error" role="alert" className="text-red-400 text-sm mt-1">{errors.textarea}</p>
              )}
            </div>

            <div className="flex justify-start mt-8">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)]
            text-black font-bold text-[18px]
            rounded-full h-[65px] w-[240px] cursor-pointer flex items-center justify-center gap-2
            transition-all hover:scale-105 disabled:opacity-50"
              >
                {isLoading ? <FaSpinner className="animate-spin" /> : "Submit"}
              </button>
            </div>
          </form>


        </div>
      </div>
    </section>
  );
};

export default Contact;
