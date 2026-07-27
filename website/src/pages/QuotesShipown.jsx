import React, { useState, useEffect } from "react";
import Commonbanner from "../components/Commonbanner";
import { useNavigate } from "react-router-dom";
import { Package, Info } from "lucide-react";
import { toast } from "sonner";
import { getAvailableQuotes, createBooking, getAddons } from "../api/cms";
import { selectRateCard, isPricingV2 } from "../utils/pricing";
import Autocomplete from "react-google-autocomplete";
import PhoneInput from "../components/PhoneInput";
import { COUNTRY_LIST, validatePhoneForCountry } from "../utils/countryPhoneData";

const isValidEmail = (v) => /\S+@\S+\.\S+/.test(v);

const extractAddressComponents = (place) => {
    const components = {};

    if (!place || !place.address_components) {
        return components;
    }

    place.address_components.forEach(component => {
        const types = component.types;

        if (types.includes('street_number')) {
            components.streetNumber = component.long_name;
        }
        if (types.includes('route')) {
            components.route = component.long_name;
        }
        if (types.includes('locality')) {
            components.city = component.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
            components.state = component.short_name;
        }
        if (types.includes('administrative_area_level_2')) {
            components.county = component.long_name;
        }
        if (types.includes('postal_code')) {
            components.postalCode = component.long_name;
        }
        if (types.includes('country')) {
            components.country = component.long_name;
        }
        if (types.includes('sublocality')) {
            components.sublocality = component.long_name;
        }
    });

    if (components.streetNumber && components.route) {
        components.streetAddress = `${components.streetNumber} ${components.route}`;
    } else if (components.route) {
        components.streetAddress = components.route;
    } else {
        components.streetAddress = place.formatted_address || '';
    }

    return components;
};

// The 14 parishes of Jamaica — deliveries in this app always land in Jamaica,
// so the recipient's "state" is really a parish. A fixed list makes it easy to
// enter and keeps the value clean for the forwarder.
const JAMAICA_PARISHES = [
    "Kingston", "St. Andrew", "St. Thomas", "Portland", "St. Mary", "St. Ann",
    "Trelawny", "St. James", "Hanover", "Westmoreland", "St. Elizabeth",
    "Manchester", "Clarendon", "St. Catherine",
];

const ParishField = ({ label, value, onChange, errorKey, errors }) => {
    // Preserve an autocomplete-filled value even if it isn't an exact match.
    const options = value && !JAMAICA_PARISHES.includes(value)
        ? [value, ...JAMAICA_PARISHES]
        : JAMAICA_PARISHES;
    return (
        <div>
            <label className="text-lg text-white font-medium">{label}</label>
            <select
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full mt-1 bg-[#0b1f1a] border rounded-[14px] px-3 py-4 text-sm text-white focus:outline-none transition
        ${errors[errorKey] ? "border-red-400 focus:border-red-400" : "border-[#4E6B5D] focus:border-[#9fe0b8]"}`}
            >
                <option value="" disabled>Select parish</option>
                {options.map((p) => (
                    <option key={p} value={p}>{p}</option>
                ))}
            </select>
            {errors[errorKey] && (
                <p className="text-red-400 text-xs mt-1">{errors[errorKey]}</p>
            )}
        </div>
    );
};

const Field = ({ label, placeholder, value, onChange, errorKey, errors, disabled = false }) => (
    <div>
        <label className="text-lg text-white font-medium">{label}</label>
        <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full mt-1 bg-transparent border rounded-[14px] px-3 py-4 text-sm text-white focus:outline-none transition
        ${errors[errorKey] ? "border-red-400 focus:border-red-400" : "border-[#4E6B5D] focus:border-[#9fe0b8]"}
        ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        />
        {errors[errorKey] && (
            <p className="text-red-400 text-xs mt-1">{errors[errorKey]}</p>
        )}
    </div>
);

const AddressField = ({
    label,
    placeholder,
    value,
    onPlaceSelected,
    onChange,
    errorKey,
    errors,
    disabled = false,
    apiLoaded,
    onAddressExtract
}) => {
    const [internalValue, setInternalValue] = useState(value || "");
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        if (!isTyping) {
            setInternalValue(value || "");
        }
    }, [value, isTyping]);

    const handlePlaceSelected = (place) => {
        if (place && place.formatted_address) {
            setInternalValue(place.formatted_address);
            setIsTyping(false);

            const components = extractAddressComponents(place);

            if (onAddressExtract) {
                onAddressExtract(place, components);
            } else {
                onPlaceSelected(place);
            }
        }
    };

    const handleChange = (e) => {
        const newValue = e.target.value;
        setInternalValue(newValue);
        setIsTyping(true);
        onChange(newValue);
        setTimeout(() => setIsTyping(false), 500);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (e.target.value && !value) {
                console.warn("Please select an address from the dropdown");
            }
        }
    };

    return (
        <div className="flex flex-col">
            <label className="text-lg text-white font-medium">{label}</label>
            {apiLoaded ? (
                <Autocomplete
                    onPlaceSelected={handlePlaceSelected}
                    onKeyDown={handleKeyDown}
                    options={{ types: ["address"] }}
                    value={internalValue}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`w-full mt-1 bg-transparent border rounded-[14px] px-3 py-4 text-sm text-white focus:outline-none transition
                        ${errors[errorKey] ? "border-red-400 focus:border-red-400" : "border-[#4E6B5D] focus:border-[#9fe0b8]"}
                        ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                    onChange={handleChange}
                />
            ) : (
                <input
                    type="text"
                    placeholder={placeholder}
                    value={internalValue}
                    onChange={handleChange}
                    disabled={true}
                    className="w-full mt-1 bg-transparent border rounded-[14px] px-3 py-4 text-sm text-white/50 border-[#4E6B5D] cursor-not-allowed"
                />
            )}
            {errors[errorKey] && (
                <p className="text-red-400 text-xs mt-1">{errors[errorKey]}</p>
            )}
        </div>
    );
};

// ── checkbox class ────────────────────────────────────────────────────────────
const checkboxCls = `w-[15px] top-[3px] h-[15px] me-3
  appearance-none rounded-sm border border-[#4E6B5D] bg-transparent cursor-pointer relative
  checked:bg-[#FFD233] checked:border-[#FFD233]
  after:content-['✓'] after:absolute after:text-black after:text-[12px] after:font-bold
  after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:opacity-0
  checked:after:opacity-100`;

// ── component ─────────────────────────────────────────────────────────────────
const QuotesShipown = () => {
    const navigate = useNavigate();

    const [apiLoaded, setApiLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [providers, setProviders] = useState([]);
    const [bookingRequest, setBookingRequest] = useState(null);
    const [adminCommission, setAdminCommission] = useState("0");
    const [serviceFeePercent, setServiceFeePercent] = useState("0");
    const [userSurvey, setUserSurvey] = useState("");
    const [selectedProviderIds, setSelectedProviderIds] = useState([]);

    // Function to get initial country from saved data
    const getInitialCountry = (savedCountryCode, savedDialCode) => {
        // If there's a saved country code
        if (savedCountryCode) {
            // If it's specifically Canada (CA), show Canada
            if (savedCountryCode === "CA") {
                return { dialCode: "+1", code: "CA" };
            }
            // If it's US, show US
            if (savedCountryCode === "US") {
                return { dialCode: "+1", code: "US" };
            }
            // For other countries, find from list
            const matched = COUNTRY_LIST.find(c => c.code === savedCountryCode);
            if (matched) return matched;
        }
        
        // If only dial code is saved and it's +1, default to US
        if (savedDialCode === "+1") {
            return { dialCode: "+1", code: "US" };
        }
        
        // For other dial codes, find from list
        const matched = COUNTRY_LIST.find(c => c.dialCode === savedDialCode);
        return matched || { dialCode: "+1", code: "US" };
    };

    // Recipients (and the delivery address) always land in Jamaica, so default
    // their phone country code to Jamaica (+1876). The shipper is the sender and
    // stays on the US default (+1).
    const [primaryContact, setPrimaryContact] = useState({
        firstName: "", lastName: "", phone: "",
        country: getInitialCountry("JM", "+1876"),
        email: "",
        address: "", city: "", state: "", suiteAptBuilding: "", lat: "", lng: ""
    });
    const [secondaryContact, setSecondaryContact] = useState({
        firstName: "", lastName: "", phone: "",
        country: getInitialCountry("JM", "+1876"),
        email: "",
        address: "", city: "", state: "", suiteAptBuilding: "", lat: "", lng: ""
    });
    const [shipperAddr, setShipperAddr] = useState({
        firstName: "", lastName: "", email: "", phone: "",
        country: getInitialCountry("", "+1"),
        address: "", city: "", state: "", suiteAptBuilding: "", lat: "", lng: "",
        sameAsOrigin: false
    });
    const [deliveryAddr, setDeliveryAddr] = useState({
        firstName: "", lastName: "", email: "", phone: "",
        country: getInitialCountry("JM", "+1876"),
        address: "", city: "", state: "", suiteAptBuilding: "", lat: "", lng: "",
        sameAsPrimary: false
    });

    const [errors, setErrors] = useState({});
    const [addOns, setAddOns] = useState({});
    const [availableAddons, setAvailableAddons] = useState([]);

    // ── fetch quotes ────────────────────────────────────────────────────────────
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await getAvailableQuotes();
                if (response.status) {
                    setBookingRequest(response.body.bookingRequest);
                    setProviders(response.body.providers);
                    setAdminCommission(response.body.adminCommission || "0");
                    if (response.body.serviceFeePercent != null) {
                        setServiceFeePercent(response.body.serviceFeePercent);
                    }
                    setUserSurvey(response.body.userSurvey || "");
                    if (response.body.providers.length === 0) {
                        toast.error("No providers found for your location or shipment type.", { id: "no-providers" });
                        navigate("/");
                    }
                } else {
                    toast.error(response.message || "Failed to fetch quotes", { id: "no-providers" });
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Failed to fetch quotes", { id: "no-providers" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();

        const fetchAddonsData = async () => {
            try {
                const res = await getAddons();
                if (res.status) {
                    setAvailableAddons(res.body);
                    const initialAddOns = {};
                    res.body.forEach(addon => {
                        initialAddOns[addon.name] = true;
                    });
                    setAddOns(initialAddOns);
                }
            } catch (err) {
                console.error("Error fetching add-ons:", err);
            }
        };
        fetchAddonsData();
    }, []);

    // The parish was already chosen at the destination step, so don't make the
    // customer pick it a second time — seed the recipient's parish from the
    // booking request. Only fills a blank field, so a manual correction (or an
    // address picked from autocomplete) is never overwritten.
    useEffect(() => {
        const parish = bookingRequest?.parish;
        if (!parish) return;
        setDeliveryAddr((prev) => (prev.state ? prev : { ...prev, state: parish }));
    }, [bookingRequest?.parish]);

    useEffect(() => {
        if (providers.length > 0 && selectedProviderIds.length === 0) {
            const bestQuoteProvider = providers.find(p => p.isBestQuote);
            if (bestQuoteProvider) {
                setSelectedProviderIds([bestQuoteProvider.provider.id]);
            } else if (providers.length > 0) {
                setSelectedProviderIds([providers[0].provider.id]);
            }
        }
    }, [providers]);

    const handleAddOnChange = (item) => {
        setAddOns(prev => ({ ...prev, [item]: !prev[item] }));
    };

    const handleProviderSelect = (id) => {
        setSelectedProviderIds((prev) => (prev.includes(id) ? [] : [id]));
        setErrors((prev) => ({ ...prev, providers: "" }));
    };

    const makeSetter = (setter, prefix) => (field) => (rawValue) => {
        const value = field === "phone"
            ? rawValue.replace(/[^0-9]/g, "")
            : rawValue.replace(/^\s+/, "");
        setter((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [`${prefix}_${field}`]: "" }));
    };

    const setPrimary = makeSetter(setPrimaryContact, "primary");
    const setSecondary = makeSetter(setSecondaryContact, "secondary");
    const setShipper = makeSetter(setShipperAddr, "shipper");
    const setDelivery = makeSetter(setDeliveryAddr, "delivery");

    const handlePrimaryAddressSelect = (place, components) => {
        setPrimaryContact(prev => ({
            ...prev,
            address: place.formatted_address || place.name,
            city: components.city || prev.city, 
            state: components.state || prev.state,
            lat: place.geometry.location.lat().toString(),
            lng: place.geometry.location.lng().toString()
        }));
    };

    const handleSecondaryAddressSelect = (place, components) => {
        setSecondaryContact(prev => ({
            ...prev,
            address: place.formatted_address || place.name,
            city: components.city || prev.city,
            state: components.state || prev.state,
            lat: place.geometry.location.lat().toString(),
            lng: place.geometry.location.lng().toString()
        }));
    };

    const handleShipperAddressSelect = (place, components) => {
        setShipperAddr(prev => ({
            ...prev,
            address: place.formatted_address || place.name,
            city: components.city || prev.city,
            state: components.state || prev.state,
            lat: place.geometry.location.lat().toString(),
            lng: place.geometry.location.lng().toString()
        }));
    };

    const handleDeliveryAddressSelect = (place, components) => {
        setDeliveryAddr(prev => ({
            ...prev,
            address: place.formatted_address || place.name,
            city: components.city || prev.city,
            state: components.state || prev.state,
            lat: place.geometry.location.lat().toString(),
            lng: place.geometry.location.lng().toString()
        }));
    };

    const handleShipperSameAsOrigin = (checked) => {
        const userStr = localStorage.getItem("user");
        let user = null;

        try {
            if (userStr) {
                user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr;
            }
        } catch (e) {
            console.error("Error parsing user from localStorage:", e);
        }
        const userDetails = user?.user || user || {};

        const userLat = userDetails?.latitude || "";
        const userLng = userDetails?.longitude || "";
        const userCountry = userDetails?.country || "";
        const userCountryCode = userDetails?.countryCode || "+1";

        let fullAddress = "";
        let city = "";
        let state = "";

        if (checked) {
            // Copy the account owner's saved street address. Only the street is
            // required — city/state are appended when present. If the owner has no
            // saved street address, copy nothing for the address (leave it empty)
            // rather than substituting the booking origin city.
            const savedStreet = userDetails?.streetAddress || userDetails?.address || "";
            if (savedStreet) {
                city = userDetails?.city || "";
                state = userDetails?.state || "";
                fullAddress = [savedStreet, city, state].filter(Boolean).join(", ").trim();
            }
        }

        // Get the correct country from user data
        let country = { dialCode: "+1", code: "US" };
        if (userCountry === "CA") {
            country = { dialCode: "+1", code: "CA" };
        } else if (userCountry === "US") {
            country = { dialCode: "+1", code: "US" };
        } else if (userCountry) {
            const matched = COUNTRY_LIST.find(c => c.code === userCountry);
            if (matched) country = matched;
        } else if (userCountryCode && userCountryCode !== "+1") {
            const matched = COUNTRY_LIST.find(c => c.dialCode === userCountryCode);
            if (matched) country = matched;
        }

        setShipperAddr((prev) => ({
            ...prev,
            sameAsOrigin: checked,
            firstName: checked ? (userDetails.firstName || "") : "",
            lastName: checked ? (userDetails.lastName || "") : "",
            email: checked ? (userDetails.email || "") : "",
            phone: checked ? (userDetails.phoneNumber || "") : "",
            country: checked ? country : { dialCode: "+1", code: "US" },
            address: checked ? fullAddress : "",
            city: checked ? city : "",
            state: checked ? state : "",
            lat: checked && fullAddress ? (userLat || "") : "",
            lng: checked && fullAddress ? (userLng || "") : "",
        }));
    };

    const handleDeliverySameAsPrimary = (checked) => {
        if (checked) {
            setDeliveryAddr({
                firstName: primaryContact.firstName,
                lastName: primaryContact.lastName,
                email: primaryContact.email,
                phone: primaryContact.phone,
                country: primaryContact.country,
                address: primaryContact.address,
                city: primaryContact.city,
                state: primaryContact.state,
                suiteAptBuilding: primaryContact.suiteAptBuilding,
                lat: primaryContact.lat || "",
                lng: primaryContact.lng || "",
                sameAsPrimary: true
            });
        } else {
            setDeliveryAddr(prev => ({
                ...prev,
                firstName: "",
                lastName: "",
                email: "",
                phone: "",
                address: "",
                city: "",
                state: "",
                suiteAptBuilding: "",
                lat: "",
                lng: "",
                sameAsPrimary: false
            }));
        }
    };

    // ✅ Country change handler - respect the selected country
    const handleCountryChange = (setter, field) => (countryObj) => {
        setter(prev => ({
            ...prev,
            country: countryObj
        }));
        // Clear any phone validation errors
        setErrors(prev => ({ ...prev, [`${field}_phone`]: "" }));
    };

    // ── validation ──────────────────────────────────────────────────────────────
    const validate = () => {
        const e = {};

        if (selectedProviderIds.length === 0)
            e.providers = "Please select at least one provider.";

        if (!primaryContact.firstName.trim()) e.primary_firstName = "First name is required";
        if (!primaryContact.lastName.trim()) e.primary_lastName = "Last name is required";

        if (!primaryContact.phone.trim()) {
            e.primary_phone = "Phone number is required";
        } else {
            const err = validatePhoneForCountry(primaryContact.country.dialCode, primaryContact.phone);
            if (err) e.primary_phone = err;
        }

        if (!primaryContact.email.trim()) e.primary_email = "Email is required";
        else if (!isValidEmail(primaryContact.email)) e.primary_email = "Invalid email format";

        if (!primaryContact.address.trim()) e.primary_address = "Address is required";
        if (!primaryContact.city?.trim()) e.primary_city = "City is required";
        if (!primaryContact.state?.trim()) e.primary_state = "State is required";

        const s = secondaryContact;
        if (s.firstName.trim() || s.lastName.trim() || s.phone.trim() || s.email.trim() || s.address.trim() || s.suiteAptBuilding.trim()) {
            if (s.email.trim() && !isValidEmail(s.email)) {
                e.secondary_email = "Invalid email format";
            }
            if (s.phone.trim()) {
                const err = validatePhoneForCountry(s.country.dialCode, s.phone);
                if (err) e.secondary_phone = err;
            }
        }

        if (!shipperAddr.firstName.trim()) e.shipper_firstName = "First name is required";
        if (!shipperAddr.lastName.trim()) e.shipper_lastName = "Last name is required";

        if (!shipperAddr.phone.trim()) {
            e.shipper_phone = "Phone number is required";
        } else {
            const err = validatePhoneForCountry(shipperAddr.country.dialCode, shipperAddr.phone);
            if (err) e.shipper_phone = err;
        }

        if (!shipperAddr.email.trim()) e.shipper_email = "Shipper email is required";
        else if (!isValidEmail(shipperAddr.email)) e.shipper_email = "Invalid email format";

        if (!shipperAddr.address.trim()) e.shipper_address = "Address is required";
        if (!shipperAddr.city?.trim()) e.shipper_city = "City is required";
        if (!shipperAddr.state?.trim()) e.shipper_state = "State is required";

        if (!deliveryAddr.firstName.trim()) e.delivery_firstName = "First name is required";
        if (!deliveryAddr.lastName.trim()) e.delivery_lastName = "Last name is required";

        if (!deliveryAddr.phone.trim()) {
            e.delivery_phone = "Phone number is required";
        } else {
            const err = validatePhoneForCountry(deliveryAddr.country.dialCode, deliveryAddr.phone);
            if (err) e.delivery_phone = err;
        }

        if (!deliveryAddr.email.trim()) e.delivery_email = "Delivery email is required";
        else if (!isValidEmail(deliveryAddr.email)) e.delivery_email = "Invalid email format";

        if (!deliveryAddr.address.trim()) e.delivery_address = "Address is required";
        if (!deliveryAddr.city?.trim()) e.delivery_city = "City is required";
        if (!deliveryAddr.state?.trim()) e.delivery_state = "State is required";

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // ── submit ──────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!validate()) {
            toast.error("Please fix the errors in the form before continuing.");
            return;
        }

        const payload = {
            booking_request_id: bookingRequest.id,
            providerIds: selectedProviderIds,
            primary_firstName: primaryContact.firstName,
            primary_lastName: primaryContact.lastName,
            primary_phone_number: primaryContact.phone,
            primary_country_code: primaryContact.country.dialCode,
            primary_country: primaryContact.country.code, // Save country code
            primary_email: primaryContact.email,
            primary_address: primaryContact.address,
            primary_city: primaryContact.city,
            primary_state: primaryContact.state,
            primary_suite_apt_building: primaryContact.suiteAptBuilding,
            primary_full_address: `${primaryContact.address}${primaryContact.suiteAptBuilding ? ', ' + primaryContact.suiteAptBuilding : ''}`,
            secondary_firstName: secondaryContact.firstName,
            secondary_lastName: secondaryContact.lastName,
            secondary_phone_number: secondaryContact.phone,
            secondary_country_code: secondaryContact.country.dialCode,
            secondary_country: secondaryContact.country.code,
            secondary_email: secondaryContact.email,
            secondary_address: secondaryContact.address,
            secondary_city: secondaryContact.city,
            secondary_state: secondaryContact.state,
            secondary_suite_apt_building: secondaryContact.suiteAptBuilding,
            secondary_full_address: secondaryContact.address
                ? `${secondaryContact.address}${secondaryContact.suiteAptBuilding ? ', ' + secondaryContact.suiteAptBuilding : ''}`
                : "",
            addOns: Object.keys(addOns).filter(k => addOns[k]),
            shiper_firstName: shipperAddr.firstName,
            shiper_lastName: shipperAddr.lastName,
            shiper_email: shipperAddr.email,
            shiper_phone_number: shipperAddr.phone,
            shiper_country_code: shipperAddr.country.dialCode,
            shiper_country: shipperAddr.country.code,
            shiper_address: shipperAddr.address,
            shiper_city: shipperAddr.city,
            shiper_state: shipperAddr.state,
            shiper_suite_apt_building: shipperAddr.suiteAptBuilding,
            shiper_full_address: `${shipperAddr.address}${shipperAddr.suiteAptBuilding ? ', ' + shipperAddr.suiteAptBuilding : ''}`,
            consignee_firstName: deliveryAddr.firstName,
            consignee_lastName: deliveryAddr.lastName,
            consignee_email: deliveryAddr.email,
            consignee_phone_number: deliveryAddr.phone,
            consignee_country_code: deliveryAddr.country.dialCode,
            consignee_country: deliveryAddr.country.code,
            consignee_address: deliveryAddr.address,
            consignee_city: deliveryAddr.city,
            consignee_state: deliveryAddr.state,
            consignee_suite_apt_building: deliveryAddr.suiteAptBuilding,
            consignee_full_address: `${deliveryAddr.address}${deliveryAddr.suiteAptBuilding ? ', ' + deliveryAddr.suiteAptBuilding : ''}`,
            consignee_lat: deliveryAddr.lat || "17.9712",
            consignee_lng: deliveryAddr.lng || "-76.7924",
            shiper_lat: shipperAddr.lat || "40.4387",
            shiper_lng: shipperAddr.lng || "-79.9972",
            primary_lat: primaryContact.lat,
            primary_lng: primaryContact.lng,
            secondary_lat: secondaryContact.lat,
            secondary_lng: secondaryContact.lng,
            barrel_type: "own"
        };

        try {
            const response = await createBooking(payload);
            if (response.success) {
                toast.success("Booking created successfully!");
                const bookings = Array.isArray(response.body) ? response.body : response.body?.bookings;
                const feePct = Array.isArray(response.body)
                    ? serviceFeePercent
                    : (response.body?.serviceFeePercent ?? serviceFeePercent);
                const comm = Array.isArray(response.body)
                    ? adminCommission
                    : (response.body?.adminCommission ?? adminCommission);
                navigate("/detail", {
                    state: {
                        bookings,
                        bookingRequest,
                        providers,
                        isShipOwn: true,
                        adminCommission: comm,
                        serviceFeePercent: feePct,
                        shipownFormData: { primaryContact, secondaryContact, shipperAddr, deliveryAddr },
                    },
                });
            } else {
                toast.error(response.message || "Failed to create booking.");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "An error occurred.");
        }
    };

    // ── loading ─────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0a1612] flex items-center justify-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400" />
            </div>
        );
    }

    // ── render ──────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#243d34] to-[#0a1612]">
            <Commonbanner title="Best Quotes" />

            {/* ── Providers List ── */}
            <div className="container mx-auto">
                <div className="py-15">
                    {providers.length === 0 ? (
                        <div className="text-center py-20 text-white/50">
                            <Package size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="text-xl">No shippers match your requirements right now.</p>
                            <p className="text-sm mt-2">Try adjusting your load details or origin/destination.</p>
                        </div>
                    ) : (() => {
                        const bestQuotes = providers.filter(p => p.isBestQuote);
                        const otherResults = providers.filter(p => !p.isBestQuote);

                        const getSurveyLabel = () => {
                            const ids = userSurvey.split(',').map(s => s.trim()).filter(Boolean);
                            if (ids.length === 0) return '💰 Sorted by: Lowest Price';

                            const labels = ids.map(id => {
                                if (id === '1') return '⚡ Fast Delivery';
                                if (id === '2') return '🛡️ Safety & Reliability';
                                if (id === '3') return '💰 Lowest Price';
                                return id;
                            });
                            return `🎯 Priorities: ${labels.join(' + ')}`;
                        };

                        const renderProvider = (providerDetail, displayIdx, isBest) => {
                            const provider = providerDetail.provider;
                            const active = selectedProviderIds.includes(provider.id);
                            return (
                                <div
                                    key={providerDetail.id}
                                    onClick={() => handleProviderSelect(provider.id)}
                                    className={`cursor-pointer relative w-full rounded-xl p-4 sm:p-5 sm:px-10 mb-4 transition-all duration-300
                    ${active
                                            ? "bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] border border-white shadow-lg"
                                            : "bg-[#2D413F]"}`}
                                >
                                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-[40px] w-full">
                                            <div className="bg-[#FFC929] text-black font-bold px-5 sm:px-8 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm h-fit whitespace-nowrap">
                                                ${(() => {
                                                    // Route-aware card selection — same logic as checkout, so the
                                                    // quote card and the final calculation quote the same rate.
                                                    const sub = ((bookingRequest?.items?.[0]?.sub_type) || bookingRequest?.sub_type || "").toLowerCase();
                                                    const type = (sub.includes('drop-off') || sub.includes('dropoff')) ? 'dropoff' : 'own';
                                                    const card = selectRateCard(providerDetail.barrelPrices, {
                                                        type,
                                                        origin: bookingRequest?.origin,
                                                        destination: bookingRequest?.destination,
                                                    });
                                                    const price = card
                                                        ? (isPricingV2(card) ? card.seaFreightPrice : card.basePrice)
                                                        : providerDetail.basePrice;
                                                    return parseFloat(price || 0);
                                                })()}
                                            </div>
                                            <div className="w-full">
                                                <h3 className="text-white text-[18px] sm:text-[20px] lg:text-[23px] font-bold">
                                                    {isBest ? "Best Quote" : `Quote ${displayIdx}`}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-center w-full lg:w-auto">
                                            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 flex items-center justify-center
                        ${active ? "bg-[#FFD233] border-[#FFD233]" : "border-white/30"}`}>
                                                {active && <span className="text-black font-bold text-xs sm:text-sm">✓</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        };

                        return (
                            <>
                                <div className="mb-4">
                                    <span className="inline-block bg-[#1b352b] border border-[#9fe0b8]/30 text-[#9fe0b8] text-xs font-medium px-4 py-2 rounded-full shadow-sm">
                                        {getSurveyLabel()}
                                    </span>
                                </div>

                                <div className="mb-10">
                                    {bestQuotes.map((p, i) => renderProvider(p, i + 1, true))}
                                </div>

                                {otherResults.length > 0 && (
                                    <div className="mt-15">
                                        <h3 className="text-white text-[28px] sm:text-[36px] font-bold mb-6">Other Results</h3>
                                        {otherResults.map((p, i) => renderProvider(p, bestQuotes.length + i + 1, false))}
                                    </div>
                                )}
                            </>
                        );
                    })()}
                    {errors.providers && (
                        <p className="text-red-400 text-sm mt-2">{errors.providers}</p>
                    )}
                </div>
            </div>

            <div className="divider h-[1px] bg-[#727272] mb-10" />

            {/* ── Form Sections ── */}
            <div className="container mx-auto">
                <div className="py-10 pt-0 text-white space-y-10">
                    {/* Add-Ons */}
                    <div className="mb-8">
                        <h3 className="md:text-[42px] text-[28px] font-semibold">Add-Ons</h3>
                        <p className="text-lg font-medium mb-3">Customize Your Shipment</p>
                        <div className="space-y-6 ">
                            {availableAddons.map((addon, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <label className="flex items-center gap-3 text-[21px] font-medium cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={addOns[addon.name] || false}
                                            onChange={() => handleAddOnChange(addon.name)}
                                            className="w-[30px] h-[30px] appearance-none rounded-sm border-1 border-[#4E6B5D] bg-transparent cursor-pointer relative checked:bg-[#FFD233] checked:border-[#FFD233] after:content-['✓'] after:absolute after:text-black after:text-[20px] after:font-bold after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:opacity-0 checked:after:opacity-100"
                                        />
                                        {addon.name}
                                    </label>
                                    <div className="tooltip-container">
                                        <Info size={18} className="text-white/50 hover:text-white cursor-pointer" />
                                        <span className="tooltip-text">{addon.name} - Additional service for your shipment.</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Recipient Contact Information ── */}
                    <div>
                        <h3 className="md:text-[42px] text-[25px] font-semibold mb-1">Recipient Contact Information</h3>
                        <p className="text-lg font-medium mb-4">Recipient is the person or business receiving the shipment</p>
                        <div className="bg-[#2D413F] rounded-xl p-6 md:px-14 px-6">
                            {/* Primary */}
                            <h4 className="text-[25px] font-semibold mb-3">Primary Contact</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <Field label="First Name" placeholder="e.g. John" value={primaryContact.firstName} onChange={(val) => { if (val.length === 1) val = val.charAt(0).toUpperCase() + val.slice(1); setPrimary("firstName")(val); }} errorKey="primary_firstName" errors={errors} />
                                <Field label="Last Name" placeholder="e.g. Smith" value={primaryContact.lastName} onChange={(val) => { if (val.length === 1) val = val.charAt(0).toUpperCase() + val.slice(1); setPrimary("lastName")(val); }} errorKey="primary_lastName" errors={errors} />
                                <PhoneInput 
                                    label="Phone Number" 
                                    value={primaryContact.phone} 
                                    onChange={setPrimary("phone")} 
                                    country={primaryContact.country} 
                                    onCountryChange={handleCountryChange(setPrimaryContact, "primary")} 
                                    error={errors.primary_phone} 
                                />
                                <Field label="Email" placeholder="e.g. johnsmith@gmail.com" value={primaryContact.email} onChange={setPrimary("email")} errorKey="primary_email" errors={errors} />
                            </div>

                            <div className="grid grid-cols-1 gap-4 mb-3">
                                <AddressField
                                    label="Street Address"
                                    placeholder="e.g. 15 Molynes Road"
                                    value={primaryContact.address}
                                    onChange={setPrimary("address")}
                                    onAddressExtract={handlePrimaryAddressSelect}
                                    errorKey="primary_address"
                                    errors={errors}
                                    apiLoaded={apiLoaded}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                <Field
                                    label="Town / City"
                                    placeholder="e.g. Kingston 10"
                                    value={primaryContact.city || ""}
                                    onChange={(val) => {
                                        setPrimaryContact(prev => ({ ...prev, city: val }));
                                        setErrors((prev) => ({ ...prev, primary_city: "" }));
                                    }}
                                    errorKey="primary_city"
                                    errors={errors}
                                />
                                <ParishField
                                    label="Parish"
                                    value={primaryContact.state || ""}
                                    onChange={(val) => {
                                        setPrimaryContact(prev => ({ ...prev, state: val }));
                                        setErrors((prev) => ({ ...prev, primary_state: "" }));
                                    }}
                                    errorKey="primary_state"
                                    errors={errors}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <Field label="Apt / Suite (Optional)" placeholder="e.g. Apt 2B, Suite 100" value={primaryContact.suiteAptBuilding} onChange={setPrimary("suiteAptBuilding")} errorKey="primary_suiteAptBuilding" errors={errors} />
                            </div>

                            {/* Secondary */}
                            <div className="mt-8">
                                <h4 className="text-[25px] font-semibold mb-3">Secondary Contact <span className="text-white/40 text-lg font-normal">(Optional)</span></h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <Field label="First Name" placeholder="e.g. John" value={secondaryContact.firstName} onChange={(val) => { if (val.length === 1) val = val.charAt(0).toUpperCase() + val.slice(1); setSecondary("firstName")(val); }} errorKey="secondary_firstName" errors={errors} />
                                    <Field label="Last Name" placeholder="e.g. Smith" value={secondaryContact.lastName} onChange={(val) => { if (val.length === 1) val = val.charAt(0).toUpperCase() + val.slice(1); setSecondary("lastName")(val); }} errorKey="secondary_lastName" errors={errors} />
                                    <PhoneInput 
                                        label="Phone Number" 
                                        value={secondaryContact.phone} 
                                        onChange={setSecondary("phone")} 
                                        country={secondaryContact.country} 
                                        onCountryChange={handleCountryChange(setSecondaryContact, "secondary")} 
                                        error={errors.secondary_phone} 
                                    />
                                    <Field label="Email" placeholder="e.g. johnsmith@gmail.com" value={secondaryContact.email} onChange={setSecondary("email")} errorKey="secondary_email" errors={errors} />
                                </div>

                                <div className="grid grid-cols-1 gap-4 mb-3">
                                    <AddressField
                                        label="Street Address"
                                        placeholder="e.g. 15 Molynes Road"
                                        value={secondaryContact.address}
                                        onChange={setSecondary("address")}
                                        onAddressExtract={handleSecondaryAddressSelect}
                                        errorKey="secondary_address"
                                        errors={errors}
                                        apiLoaded={apiLoaded}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                    <Field
                                        label="Town / City"
                                        placeholder="e.g. Kingston 10"
                                        value={secondaryContact.city || ""}
                                        onChange={(val) => {
                                            setSecondaryContact(prev => ({ ...prev, city: val }));
                                            setErrors((prev) => ({ ...prev, secondary_city: "" }));
                                        }}
                                        errorKey="secondary_city"
                                        errors={errors}
                                    />
                                    <ParishField
                                        label="Parish"
                                        value={secondaryContact.state || ""}
                                        onChange={(val) => {
                                            setSecondaryContact(prev => ({ ...prev, state: val }));
                                            setErrors((prev) => ({ ...prev, secondary_state: "" }));
                                        }}
                                        errorKey="secondary_state"
                                        errors={errors}
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <Field label="Apt / Suite (Optional)" placeholder="e.g. Apt 2B, Suite 100" value={secondaryContact.suiteAptBuilding} onChange={setSecondary("suiteAptBuilding")} errorKey="secondary_suit_address" errors={errors} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Shipper & Delivery Addresses ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Shipper */}
                        <div>
                            <h4 className="text-[25px] font-semibold mb-2">Add Shipper Address</h4>
                            <p className="mb-3 text-white/70 text-sm">The "Shipper" is the person sending the package to the destination address</p>
                            <label className="text-sm text-white flex items-center mb-4 cursor-pointer">
                                <input type="checkbox" className={checkboxCls} checked={shipperAddr.sameAsOrigin} onChange={(e) => handleShipperSameAsOrigin(e.target.checked)} />
                                Same as Origin Address
                            </label>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="First Name" placeholder="e.g. John" value={shipperAddr.firstName} onChange={setShipper("firstName")} errorKey="shipper_firstName" errors={errors} />
                                    <Field label="Last Name" placeholder="e.g. Smith" value={shipperAddr.lastName} onChange={setShipper("lastName")} errorKey="shipper_lastName" errors={errors} />
                                </div>
                                <Field label="Email" placeholder="e.g. johnsmith@gmail.com" value={shipperAddr.email} onChange={setShipper("email")} errorKey="shipper_email" errors={errors} />
                                <PhoneInput 
                                    label="Phone Number" 
                                    value={shipperAddr.phone} 
                                    onChange={setShipper("phone")} 
                                    country={shipperAddr.country} 
                                    onCountryChange={handleCountryChange(setShipperAddr, "shipper")} 
                                    error={errors.shipper_phone} 
                                />
                                <AddressField
                                    label="Address"
                                    placeholder="e.g. 11 VerShip Road"
                                    value={shipperAddr.address}
                                    onChange={setShipper("address")}
                                    onAddressExtract={handleShipperAddressSelect}
                                    errorKey="shipper_address"
                                    errors={errors}
                                    apiLoaded={apiLoaded}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <Field
                                        label="City"
                                        placeholder="e.g. Pittsburgh"
                                        value={shipperAddr.city || ""}
                                        onChange={(val) => {
                                            setShipperAddr(prev => ({ ...prev, city: val }));
                                            setErrors((prev) => ({ ...prev, shipper_city: "" }));
                                        }}
                                        errorKey="shipper_city"
                                        errors={errors}
                                    />
                                    <Field
                                        label="State"
                                        placeholder="e.g. PA"
                                        value={shipperAddr.state || ""}
                                        onChange={(val) => {
                                            setShipperAddr(prev => ({ ...prev, state: val }));
                                            setErrors((prev) => ({ ...prev, shipper_state: "" }));
                                        }}
                                        errorKey="shipper_state"
                                        errors={errors}
                                    />
                                </div>
                                <Field label="Apt / Suite (Optional)" placeholder="e.g. Apt 2B, Suite 100" value={shipperAddr.suiteAptBuilding} onChange={setShipper("suiteAptBuilding")} errorKey="shipper_auite_address" errors={errors} />
                            </div>
                        </div>

                        {/* Delivery */}
                        <div>
                            <h4 className="text-[25px] font-semibold mb-2">Add Delivery Address</h4>
                            <p className="mb-3 text-white/60 text-xs leading-relaxed">
                                Jamaican format, e.g.<br />
                                <span className="text-white/80">Elvis Livingston · 15 Molynes Road · Kingston 10 · St. Andrew · JAMAICA, W.I.</span>
                            </p>
                            <label className="text-sm text-white flex items-center mb-4 cursor-pointer">
                                <input type="checkbox" className={checkboxCls} checked={deliveryAddr.sameAsPrimary} onChange={(e) => handleDeliverySameAsPrimary(e.target.checked)} />
                                Same as primary contact address
                            </label>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="First Name" placeholder="e.g. John" value={deliveryAddr.firstName} onChange={setDelivery("firstName")} errorKey="delivery_firstName" errors={errors} />
                                    <Field label="Last Name" placeholder="e.g. Smith" value={deliveryAddr.lastName} onChange={setDelivery("lastName")} errorKey="delivery_lastName" errors={errors} />
                                </div>
                                <Field label="Email" placeholder="e.g. johnsmith@gmail.com" value={deliveryAddr.email} onChange={setDelivery("email")} errorKey="delivery_email" errors={errors} />
                                <PhoneInput 
                                    label="Phone Number" 
                                    value={deliveryAddr.phone} 
                                    onChange={setDelivery("phone")} 
                                    country={deliveryAddr.country} 
                                    onCountryChange={handleCountryChange(setDeliveryAddr, "delivery")} 
                                    error={errors.delivery_phone} 
                                />
                                <AddressField
                                    label="Street Address"
                                    placeholder="e.g. 15 Molynes Road"
                                    value={deliveryAddr.address}
                                    onChange={setDelivery("address")}
                                    onAddressExtract={handleDeliveryAddressSelect}
                                    errorKey="delivery_address"
                                    errors={errors}
                                    apiLoaded={apiLoaded}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <Field
                                        label="Town / City"
                                        placeholder="e.g. Kingston 10"
                                        value={deliveryAddr.city || ""}
                                        onChange={(val) => {
                                            setDeliveryAddr(prev => ({ ...prev, city: val }));
                                            setErrors((prev) => ({ ...prev, delivery_city: "" }));
                                        }}
                                        errorKey="delivery_city"
                                        errors={errors}
                                    />
                                    <ParishField
                                        label="Parish"
                                        value={deliveryAddr.state || ""}
                                        onChange={(val) => {
                                            setDeliveryAddr(prev => ({ ...prev, state: val }));
                                            setErrors((prev) => ({ ...prev, delivery_state: "" }));
                                        }}
                                        errorKey="delivery_state"
                                        errors={errors}
                                    />
                                </div>
                                <Field label="Apt / Suite (Optional)" placeholder="e.g. Apt 2B" value={deliveryAddr.suiteAptBuilding} onChange={setDelivery("suiteAptBuilding")} errorKey="delivery_auite_address" errors={errors} />
                            </div>
                        </div>
                    </div>

                    {/* ── Submit ── */}
                    <div className="flex justify-center mt-10 pb-10">
                        <button
                            onClick={handleSubmit}
                            disabled={providers.length === 0}
                            className={`text-md font-semibold px-20 py-[20px] rounded-full transition ${providers.length === 0 ? "bg-gray-600 text-gray-400 cursor-not-allowed opacity-50" : "bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F] text-black hover:brightness-110"}`}
                        >
                            Review &amp; Order
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuotesShipown;