import React, { useState } from "react";
import { Mail, Phone, CalendarDays } from "lucide-react";
import { contactUs } from "../api/cms";
import { toast } from "sonner";
import { FaSpinner } from "react-icons/fa";
import PhoneInput from "../components/PhoneInput";
import { validatePhoneForCountry } from "../utils/countryPhoneData";

const Contact = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    countryCode: "+1",
    number: "",
    city: "",
    message: "",
  });
  const [errors, setErrors] = useState({});

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
      case "city":
        if (!value.trim()) error = "City is required";
        break;
      case "message":
        if (!value.trim()) error = "Message is required";
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value.replace(/^\s+/, "");
    if (name === "number") {
      formattedValue = formattedValue.replace(/[^0-9]/g, "");
    }
    setFormData({ ...formData, [name]: formattedValue });
    validateField(name, formattedValue);
  };

  const handleSubmit = async () => {
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
      const response = await contactUs(formData);
      if (response.success) {
        toast.success(response.message || "Message sent successfully!");
        setFormData({ first_name: "", last_name: "", email: "", countryCode: "+1", number: "", city: "", message: "" });
        setErrors({});
      } else {
        toast.error(response.message || "Failed to send message.");
      }
    } catch (error) {
      console.error("Contact Error:", error);
      toast.error(
        error.response?.data?.message || "An error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="bg-[#0E1614] py-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* LEFT SIDE */}
            <div className="w-full lg:w-[40%] text-white">
              <p className=" text-[23px] sm:text-[30px] md:text-[35px] text-white font-semibold pt-7">
                {" "}
                Get in touch with us
              </p>

              <p className="text-white mb-10 text-[14px] sm:text-[16px] leading-relaxed">
                Lorem Ipsum is simply dummy text of the printing and typesetting
                industry. Lorem Ipsum has been the industry's standard dummy
                text ever since the 1500s.
              </p>

              {/* Contact Info */}
              <div className="space-y-6">
                {/* Email */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center">
                    <Mail className="text-black" size={20} />
                  </div>
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-white/70 text-sm">
                      info@vershipgo.com
                    </p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center">
                    <Phone className="text-black" size={20} />
                  </div>
                  <div>
                    <p className="font-medium">Call Us</p>
                    <p className="text-white/70 text-sm">814-232-4537</p>
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center">
                    <CalendarDays className="text-black" size={20} />
                  </div>
                  <div>
                    <p className="font-medium">(24/7) Available</p>
                    {/* <p className="text-white/70 text-sm">Sunday Closed</p> */}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE (FORM) */}
            <div className="w-full lg:w-[60%]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mb-6">
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    aria-label="First Name"
                    aria-required="true"
                    aria-invalid={errors.first_name ? "true" : "false"}
                    placeholder="First Name*"
                    className={`bg-white/10 text-white placeholder-white/60 px-5 py-4 outline-none border ${errors.first_name ? 'border-red-500' : 'border-transparent'}`}
                  />
                  {errors.first_name && <p className="text-red-400 text-xs">{errors.first_name}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    aria-label="Last Name"
                    aria-required="true"
                    aria-invalid={errors.last_name ? "true" : "false"}
                    placeholder="Last Name*"
                    className={`bg-white/10 text-white placeholder-white/60 px-5 py-4 outline-none border ${errors.last_name ? 'border-red-500' : 'border-transparent'}`}
                  />
                  {errors.last_name && <p className="text-red-400 text-xs">{errors.last_name}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    aria-label="Email"
                    aria-required="true"
                    aria-invalid={errors.email ? "true" : "false"}
                    placeholder="Email*"
                    className={`bg-white/10 text-white placeholder-white/60 px-5 py-4 outline-none border ${errors.email ? 'border-red-500' : 'border-transparent'}`}
                  />
                  {errors.email && <p className="text-red-400 text-xs">{errors.email}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <PhoneInput
                    value={formData.number}
                    onChange={(val) => {
                      setFormData(prev => ({ ...prev, number: val }));
                      validateField("number", val);
                    }}
                    countryCode={formData.countryCode}
                    onCountryChange={(code) => {
                      setFormData(prev => ({ ...prev, countryCode: code }));
                      validateField("number", formData.number);
                    }}
                    error={errors.number}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    aria-label="City"
                    aria-required="true"
                    aria-invalid={errors.city ? "true" : "false"}
                    placeholder="City*"
                    className={`bg-white/10 text-white placeholder-white/60 px-5 py-4 outline-none border ${errors.city ? 'border-red-500' : 'border-transparent'}`}
                  />
                  {errors.city && <p className="text-red-400 text-xs">{errors.city}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-1 mb-6">
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  aria-label="Your Message"
                  aria-required="true"
                  aria-invalid={errors.message ? "true" : "false"}
                  placeholder="Your Message*"
                  rows="5"
                  className={`w-full bg-white/10 text-white placeholder-white/60 px-5 py-4 outline-none resize-none border ${errors.message ? 'border-red-500' : 'border-transparent'}`}
                />
                {errors.message && <p className="text-red-400 text-xs">{errors.message}</p>}
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`bg-yellow-400 cursor-pointer text-black font-semibold px-8 py-4 rounded-[36px] text-[16px] hover:bg-yellow-500 transition flex items-center gap-2 ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                {loading ? <FaSpinner className="animate-spin" /> : null}
                {loading ? "Sending..." : "Submit Message"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
export default Contact;
