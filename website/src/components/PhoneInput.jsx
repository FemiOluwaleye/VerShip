// import React, { useState, useRef, useEffect } from 'react';
// import { FiChevronDown, FiSearch } from 'react-icons/fi';
// import { COUNTRY_LIST } from '../utils/countryPhoneData';

// const PhoneInput = ({
//     label,
//     labelClassName = "text-lg font-medium",
//     inputClassName = "",
//     buttonClassName = "",
//     placeholder,
//     value,
//     onChange,
//     countryCode = "+1",
//     onCountryChange,
//     error,
//     disabled = false,
//     className = ""
// }) => {
//     const [isOpen, setIsOpen] = useState(false);
//     const [searchTerm, setSearchTerm] = useState("");
//     const dropdownRef = useRef(null);

//     // Close dropdown when clicking outside
//     useEffect(() => {
//         const handler = (event) => {
//             if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
//                 setIsOpen(false);
//             }
//         };

//         document.addEventListener("mousedown", handler);
//         return () => document.removeEventListener("mousedown", handler);
//     }, []);

//     const selectedCountry = COUNTRY_LIST.find(c => c.dialCode === countryCode) || COUNTRY_LIST.find(c => c.dialCode === "+1");

//     const filteredCountries = COUNTRY_LIST.filter(c =>
//         c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         c.dialCode.includes(searchTerm) ||
//         c.code.toLowerCase().includes(searchTerm.toLowerCase())
//     );

//     const handlePhoneChange = (e) => {
//         const val = e.target.value.replace(/\D/g, ''); // Numeric only
//         onChange(val);
//     };

//     return (
//         <div className={`flex flex-col w-full ${className}`}>
//             {label && <label className={`${labelClassName} mb-1 transition-all`}>{label}</label>}

//             <div className="flex gap-2 relative w-full">
//                 {/* Country Selector */}
//                 <div className="relative" ref={dropdownRef}>
//                     <button
//                         type="button"
//                         disabled={disabled}
//                         onClick={() => setIsOpen(!isOpen)}
//                         className={`flex items-center gap-1 bg-transparent border border-white/20 text-white rounded-[16px] px-3 py-2.5 h-full min-w-[90px] justify-between focus:outline-none focus:border-yellow-400 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${buttonClassName}`}
//                     >
//                         <span className="text-xl">{selectedCountry?.flag}</span>
//                         <span className="text-sm font-medium">{countryCode}</span>
//                         <FiChevronDown className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
//                     </button>

//                     {isOpen && (
//                         <div className="absolute top-full left-0 mt-2 w-[280px] bg-[#2D413F] border border-white/20 rounded-xl shadow-2xl z-[999] overflow-hidden">
//                             <div className="p-2 border-b border-white/10">
//                                 <div className="relative">
//                                     <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
//                                     <input
//                                         autoFocus
//                                         type="text"
//                                         placeholder="Search country..."
//                                         value={searchTerm}
//                                         onChange={(e) => setSearchTerm(e.target.value)}
//                                         className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
//                                     />
//                                 </div>
//                             </div>
//                             <div className="max-h-[250px] overflow-y-auto">
//                                 {filteredCountries.length > 0 ? (
//                                     filteredCountries.map((c) => (
//                                         <div
//                                             key={`${c.code}-${c.dialCode}`}
//                                             onClick={() => {
//                                                 onCountryChange(c.dialCode);
//                                                 setIsOpen(false);
//                                                 setSearchTerm("");
//                                             }}
//                                             className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0"
//                                         >
//                                             <span className="text-2xl">{c.flag}</span>
//                                             <div className="flex flex-col min-w-0">
//                                                 <span className="text-sm text-white font-medium truncate">{c.name}</span>
//                                                 <span className="text-xs text-white/40">{c.dialCode}</span>
//                                             </div>
//                                         </div>
//                                     ))
//                                 ) : (
//                                     <div className="px-4 py-8 text-center text-white/40 text-sm">No countries found</div>
//                                 )}
//                             </div>
//                         </div>
//                     )}
//                 </div>

//                 {/* Phone Number Input */}
//                 <input
//                     type="tel"
//                     disabled={disabled}
//                     value={value}
//                     onChange={handlePhoneChange}
//                     placeholder={placeholder}
//                     className={`flex-1 min-w-0 bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-[16px] px-4 py-2.5 focus:outline-none focus:border-yellow-400 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${inputClassName}`}
//                 />
//             </div>

//             {error && (
//                 <p className="text-red-400 text-sm mt-1 ml-1">{error}</p>
//             )}
//         </div>
//     );
// };

// export default PhoneInput;
import React, { useState, useRef, useEffect } from "react";
import { FiChevronDown, FiSearch } from "react-icons/fi";
import { COUNTRY_LIST, phonePlaceholderForCountry } from "../utils/countryPhoneData";

const PhoneInput = ({
  label,
  labelClassName = "text-sm font-medium",
  inputClassName = "",
  buttonClassName = "",
  placeholder,
  value,
  onChange,
  country = { dialCode: "+1", code: "US" },
  onCountryChange,
  error,
  disabled = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // FIX 1: Simplified lookup — match by code only (dialCode can vary for same country)
  const selectedCountry =
    COUNTRY_LIST.find((c) => c.code === country.code) ||
    COUNTRY_LIST.find((c) => c.code === "US");

  const filteredCountries = COUNTRY_LIST.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.dialCode.includes(searchTerm)
  );

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, "");
    onChange(val);
  };

  // FIX 2: Guard against missing onCountryChange
  const handleCountrySelect = (c) => {
    if (onCountryChange) {
      onCountryChange({ code: c.code, dialCode: c.dialCode });
    }
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {label && (
        <label className={`${labelClassName} mb-1`}>{label}</label>
      )}

      <div className="flex gap-2 relative w-full">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)} // FIX 3: functional update
            className={`flex items-center gap-1 bg-transparent border border-white/20 text-white rounded-[16px] px-3 py-2.5 min-w-[95px] justify-between focus:outline-none focus:border-yellow-400 ${
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            } ${buttonClassName}`}
          >
            <span className="text-xl">{selectedCountry?.flag}</span>
            <span className="text-sm font-medium">{selectedCountry?.dialCode}</span>
            <FiChevronDown
              className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-[280px] bg-[#2D413F] border border-white/20 rounded-xl shadow-2xl z-[999] overflow-hidden">
              <div className="p-2 border-b border-white/10">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search country..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div className="max-h-[250px] overflow-y-auto">
                {filteredCountries.map((c) => (
                  <div
                    key={`${c.code}-${c.dialCode}`}
                    onClick={() => handleCountrySelect(c)} // FIX 2 applied
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-white/5 ${
                      c.code === selectedCountry?.code ? "bg-white/10" : "" // FIX 4: highlight selected
                    }`}
                  >
                    <span className="text-2xl">{c.flag}</span>
                    <div className="flex flex-col">
                      <span className="text-sm text-white">{c.name}</span>
                      <span className="text-xs text-white/40">{c.dialCode}</span>
                    </div>
                  </div>
                ))}

                {filteredCountries.length === 0 && (
                  <div className="px-4 py-8 text-center text-white/40 text-sm">
                    No countries found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <input
          type="tel"
          disabled={disabled}
          value={value}
          onChange={handlePhoneChange}
          placeholder={placeholder || phonePlaceholderForCountry(selectedCountry?.dialCode)}
          inputMode="tel"
          className={`flex-1 min-w-0 bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-[16px] px-4 py-2.5 focus:outline-none focus:border-yellow-400 ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          } ${inputClassName}`}
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm mt-1 ml-1">{error}</p>
      )}
    </div>
  );
};

export default PhoneInput;