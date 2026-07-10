import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Commonbanner from '../components/Commonbanner';
import { updateBookingRequest } from '../api/cms';
import Autocomplete from "react-google-autocomplete";
import PhoneInput from "../components/PhoneInput";
import { validatePhoneForCountry } from "../utils/countryPhoneData";

const BarrelRequestForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        account_type: 'Personal',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        phoneCountry: { dialCode: '+1', code: 'US' },      // ← changed
        whatsapp: '',
        whatsappCountry: { dialCode: '+1', code: 'US' },   // ← changed
        drop_off_address: '',
        suite_apt_building: '',
        drop_off_lat: '',
        drop_off_long: '',
        streetAddress: '',
        city: '',
        state: '',
    });

    const [errors, setErrors] = useState({});

    const parseAddressComponents = (place) => {
        let streetAddress = '';
        let city = '';
        let state = '';
        
        if (place.address_components) {
            let streetNumber = '';
            let route = '';
            
            for (const component of place.address_components) {
                const types = component.types;
                
                if (types.includes('street_number')) {
                    streetNumber = component.long_name;
                }
                if (types.includes('route')) {
                    route = component.long_name;
                }
                if (types.includes('locality') || 
                    types.includes('administrative_area_level_3') ||
                    types.includes('postal_town')) {
                    city = component.long_name;
                }
                if (types.includes('administrative_area_level_1')) {
                    state = component.long_name;
                }
                if (!city && types.includes('administrative_area_level_2')) {
                    city = component.long_name;
                }
            }
            
            streetAddress = [streetNumber, route].filter(Boolean).join(' ');
        }
        
        if (!streetAddress && place.formatted_address) {
            const parts = place.formatted_address.split(',');
            if (parts.length > 0) {
                streetAddress = parts[0].trim();
            }
        }
        
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

    const validateField = (name, value) => {
        let error = '';
        
        if (name === 'suite_apt_building') {
            return '';
        }
        if (name === 'whatsapp') {
            if (!value) return '';
            return validatePhoneForCountry(formData.whatsappCountry.dialCode, value); // ← changed
        }

        if (!value) {
            if (name === 'drop_off_address') error = 'Drop-off Address is required';
            else if (name === 'firstName') error = 'First Name is required';
            else if (name === 'lastName') error = 'Last Name is required';
            else if (name === 'email') error = 'Email is required';
            else if (name === 'streetAddress') error = 'Street Address is required';
            else if (name === 'city') error = 'City is required';
            else if (name === 'state') error = 'State is required';
            else if (name === 'phone') error = 'Phone number is required';
            else error = `${name.replace(/_/g, ' ')} is required`;
        } else if (name === 'phone') {
            error = validatePhoneForCountry(formData.phoneCountry.dialCode, value); // ← changed
        } else if (name === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) error = 'Invalid email format';
        }
        return error;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let formattedValue = value;

        formattedValue = formattedValue.replace(/^\s+/, "");

        if (name === 'phone' || name === 'whatsapp') {
            formattedValue = formattedValue.replace(/[^0-9]/g, "");
        }

        setFormData(prev => ({ ...prev, [name]: formattedValue }));

        const error = validateField(name, formattedValue);
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleToggle = (type) => {
        setFormData(prev => ({ ...prev, account_type: type }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const newErrors = {};
        const skipValidation = [
            'drop_off_lat', 'drop_off_long', 'account_type',
            'suite_apt_building', 'whatsappCountry', 'phoneCountry'  // ← changed
        ];
        Object.keys(formData).forEach(key => {
            if (skipValidation.includes(key)) return;
            const error = validateField(key, formData[key]);
            if (error) newErrors[key] = error;
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error("Please fill all required fields correctly");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                name: `${formData.firstName} ${formData.lastName}`.trim(),
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone_number: formData.phone,
                phone_country_code: formData.phoneCountry.dialCode,       // ← changed
                whatsapp_number: formData.whatsapp,
                whatsapp_country_code: formData.whatsappCountry.dialCode, // ← changed
                suite_apt_building: formData.suite_apt_building,
                streetAddress: formData.streetAddress,
                city: formData.city,
                state: formData.state,
            };

            await updateBookingRequest(id, payload);
            localStorage.removeItem("pending_barrel_request_id");
            toast.success("Request details updated successfully!");
            navigate('/quotes');
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update request");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#243d34] to-[#0a1612] text-white">
            <Commonbanner title="Request Barrel Details" />

            <div className="container mx-auto py-12 px-4">
                <div className="max-w-2xl mx-auto bg-[#2D413F] rounded-[22px] border border-white/20 p-8 shadow-2xl">
                    <h2 className="text-3xl font-bold mb-8 text-center text-yellow-400">Complete Your Request</h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Account Type Toggle */}
                        <div className="flex flex-col items-center mb-8">
                            <label className="text-lg font-medium mb-3">Account Type</label>
                            <div className="flex bg-[#1b352b] rounded-full p-1 border border-white/10 w-full max-w-xs">
                                <button
                                    type="button"
                                    onClick={() => handleToggle('Personal')}
                                    className={`flex-1 py-2 px-6 rounded-full transition-all duration-300 ${formData.account_type === 'Personal'
                                        ? 'bg-yellow-400 text-black font-bold shadow-lg'
                                        : 'text-white/60 hover:text-white'
                                        }`}
                                >
                                    Personal
                                </button>
                            </div>
                        </div>

                        {/* Name */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col">
                                <label className="text-sm font-medium mb-1 ml-1">First Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="firstName"
                                    placeholder="Enter first name"
                                    value={formData.firstName}
                                    onChange={(e) => {
                                        let val = e.target.value;
                                        if (val.length === 1) {
                                            val = val.charAt(0).toUpperCase() + val.slice(1);
                                        }
                                        handleInputChange({
                                            ...e,
                                            target: { ...e.target, name: "firstName", value: val },
                                        });
                                    }}
                                    className={`bg-[#1b352b] border ${errors.firstName ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors`}
                                />
                                {errors.firstName && <span className="text-red-500 text-xs mt-1 ml-1">{errors.firstName}</span>}
                            </div>

                            <div className="flex flex-col">
                                <label className="text-sm font-medium mb-1 ml-1">Last Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="lastName"
                                    placeholder="Enter last name"
                                    value={formData.lastName}
                                    onChange={(e) => {
                                        let val = e.target.value;
                                        if (val.length === 1) {
                                            val = val.charAt(0).toUpperCase() + val.slice(1);
                                        }
                                        handleInputChange({
                                            ...e,
                                            target: { ...e.target, name: "lastName", value: val },
                                        });
                                    }}
                                    className={`bg-[#1b352b] border ${errors.lastName ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors`}
                                />
                                {errors.lastName && <span className="text-red-500 text-xs mt-1 ml-1">{errors.lastName}</span>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col">
                                <label className="text-sm font-medium mb-1 ml-1">Email Address <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Enter your email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    className={`bg-[#1b352b] border ${errors.email ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors`}
                                />
                                {errors.email && <span className="text-red-500 text-xs mt-1 ml-1">{errors.email}</span>}
                            </div>

                            <div className="flex flex-col">
                                <PhoneInput
                                    label="Phone Number"
                                    labelClassName="text-sm font-medium mb-1 ml-1"
                                    value={formData.phone}
                                    onChange={(val) => {
                                        setFormData(prev => ({ ...prev, phone: val }));
                                        const error = validatePhoneForCountry(formData.phoneCountry.dialCode, val); // ← changed
                                        setErrors(prev => ({ ...prev, phone: error }));
                                    }}
                                    country={formData.phoneCountry}                    // ← changed
                                    onCountryChange={(obj) => {                        // ← changed
                                        setFormData(prev => ({ ...prev, phoneCountry: obj })); // ← changed
                                        if (formData.phone) {
                                            const error = validatePhoneForCountry(obj.dialCode, formData.phone); // ← changed
                                            setErrors(prev => ({ ...prev, phone: error }));
                                        }
                                    }}
                                    error={errors.phone}
                                    placeholder="Enter phone number"
                                />
                            </div>

                            <div className="flex flex-col">
                                <PhoneInput
                                    label="WhatsApp (Optional)"
                                    labelClassName="text-sm font-medium mb-1 ml-1"
                                    value={formData.whatsapp}
                                    onChange={(val) => {
                                        setFormData(prev => ({ ...prev, whatsapp: val }));
                                        const error = val
                                            ? validatePhoneForCountry(formData.whatsappCountry.dialCode, val) // ← changed
                                            : '';
                                        setErrors(prev => ({ ...prev, whatsapp: error }));
                                    }}
                                    country={formData.whatsappCountry}                    // ← changed
                                    onCountryChange={(obj) => {                           // ← changed
                                        setFormData(prev => ({ ...prev, whatsappCountry: obj })); // ← changed
                                        if (formData.whatsapp) {
                                            const error = validatePhoneForCountry(obj.dialCode, formData.whatsapp); // ← changed
                                            setErrors(prev => ({ ...prev, whatsapp: error }));
                                        }
                                    }}
                                    error={errors.whatsapp}
                                    placeholder="Enter WhatsApp"
                                />
                            </div>
                        </div>

                        {/* Drop-off Address with Autocomplete */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col">
                                <label className="text-sm font-medium mb-1 ml-1">Drop-off Address <span className="text-red-500">*</span></label>
                                <Autocomplete
                                    apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                                    onPlaceSelected={(place) => {
                                        const { streetAddress, city, state } = parseAddressComponents(place);
                                        const address = place.formatted_address || place.name;
                                        const lat = place.geometry.location.lat();
                                        const lng = place.geometry.location.lng();

                                        setFormData(prev => ({
                                            ...prev,
                                            drop_off_address: address,
                                            drop_off_lat: lat.toString(),
                                            drop_off_long: lng.toString(),
                                            streetAddress: streetAddress,
                                            city: city,
                                            state: state,
                                        }));
                                        setErrors(prev => ({ 
                                            ...prev, 
                                            drop_off_address: '',
                                            streetAddress: '',
                                            city: '',
                                            state: '',
                                        }));
                                    }}
                                    options={{ types: ["address"] }}
                                    defaultValue={formData.drop_off_address}
                                    placeholder="Enter full drop-off address"
                                    className={`bg-[#1b352b] border ${errors.drop_off_address ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors w-full text-white`}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({ ...prev, drop_off_address: val }));
                                        const error = validateField('drop_off_address', val);
                                        setErrors(prev => ({ ...prev, drop_off_address: error }));
                                    }}
                                />
                                {errors.drop_off_address && <span className="text-red-500 text-xs mt-1 ml-1">{errors.drop_off_address}</span>}
                            </div>

                            <div className="flex flex-col">
                                <label className="text-sm font-medium mb-1 ml-1">Suite / Apt / Building <span className="text-gray-400 text-xs">(Optional)</span></label>
                                <input
                                    type="text"
                                    name="suite_apt_building"
                                    placeholder="Enter suite/apt/building (optional)"
                                    value={formData.suite_apt_building}
                                    onChange={handleInputChange}
                                    className={`bg-[#1b352b] border ${errors.suite_apt_building ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors`}
                                />
                                {errors.suite_apt_building && <span className="text-red-500 text-xs mt-1 ml-1">{errors.suite_apt_building}</span>}
                            </div>
                        </div>

                        {/* Street Address Field */}
                        <div className="flex flex-col">
                            <label className="text-sm font-medium mb-1 ml-1">Street Address <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="streetAddress"
                                value={formData.streetAddress}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, streetAddress: val }));
                                    const error = validateField('streetAddress', val);
                                    setErrors(prev => ({ ...prev, streetAddress: error }));
                                }}
                                placeholder="Enter street address"
                                className={`bg-[#1b352b] border ${errors.streetAddress ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors`}
                            />
                            {errors.streetAddress && <span className="text-red-500 text-xs mt-1 ml-1">{errors.streetAddress}</span>}
                        </div>

                        {/* City and State in Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col">
                                <label className="text-sm font-medium mb-1 ml-1">City <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="city"
                                    value={formData.city}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({ ...prev, city: val }));
                                        const error = validateField('city', val);
                                        setErrors(prev => ({ ...prev, city: error }));
                                    }}
                                    placeholder="Enter city"
                                    className={`bg-[#1b352b] border ${errors.city ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors`}
                                />
                                {errors.city && <span className="text-red-500 text-xs mt-1 ml-1">{errors.city}</span>}
                            </div>

                            <div className="flex flex-col">
                                <label className="text-sm font-medium mb-1 ml-1">State <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="state"
                                    value={formData.state}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({ ...prev, state: val }));
                                        const error = validateField('state', val);
                                        setErrors(prev => ({ ...prev, state: error }));
                                    }}
                                    placeholder="Enter state"
                                    className={`bg-[#1b352b] border ${errors.state ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors`}
                                />
                                {errors.state && <span className="text-red-500 text-xs mt-1 ml-1">{errors.state}</span>}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4 text-center">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full max-w-xs bg-yellow-400 text-black font-bold py-4 rounded-full text-lg shadow-xl hover:bg-yellow-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BarrelRequestForm;