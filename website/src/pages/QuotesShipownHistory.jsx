import React, { useState, useEffect } from "react";
import Commonbanner from "../components/Commonbanner";
import { useNavigate, useParams } from "react-router-dom";
import { Package, Info, Calendar } from "lucide-react";
import { toast } from "sonner";
import { getAvailableQuotes, createBooking } from "../api/cms";
import { selectRateCard, isPricingV2 } from "../utils/pricing";
import Autocomplete from "react-google-autocomplete";
import PhoneInput from "../components/PhoneInput";
import { validatePhoneForCountry } from "../utils/countryPhoneData";

// ── helpers ───────────────────────────────────────────────────────────────────
const isValidEmail = (v) => /\S+@\S+\.\S+/.test(v);
// const isValidPhone = (v) => /^\d{7,15}$/.test(v);

// ── Field component ───────────────────────────────────────────────────────────
const Field = ({ label, placeholder, value, onChange, errorKey, errors, disabled = false, type = "text" }) => (
    <div>
        <label className="text-lg text-white font-medium">{label}</label>
        <input
            type={type}
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

const AddressField = ({ label, placeholder, value, onPlaceSelected, onChange, errorKey, errors, disabled = false, apiLoaded }) => (
    <div className="flex flex-col">
        <label className="text-lg text-white font-medium">{label}</label>
        {apiLoaded ? (
            <Autocomplete
                onPlaceSelected={onPlaceSelected}
                options={{ types: ["address"] }}
                defaultValue={value}
                placeholder={placeholder}
                disabled={disabled}
                className={`w-full mt-1 bg-transparent border rounded-[14px] px-3 py-4 text-sm text-white focus:outline-none transition
                ${errors[errorKey] ? "border-red-400 focus:border-red-400" : "border-[#4E6B5D] focus:border-[#9fe0b8]"}
                ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                onChange={(e) => onChange(e.target.value)}
            />
        ) : (
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={true}
                className="w-full mt-1 bg-transparent border rounded-[14px] px-3 py-4 text-sm text-white/50 border-[#4E6B5D] cursor-not-allowed"
            />
        )}
        {errors[errorKey] && (
            <p className="text-red-400 text-xs mt-1">{errors[errorKey]}</p>
        )}
    </div>
);

// ── checkbox class ────────────────────────────────────────────────────────────
const checkboxCls = `w-[15px] top-[3px] h-[15px] me-3
  appearance-none rounded-sm border border-[#4E6B5D] bg-transparent cursor-pointer relative
  checked:bg-[#FFD233] checked:border-[#FFD233]
  after:content-['✓'] after:absolute after:text-black after:text-[12px] after:font-bold
  after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:opacity-0
  checked:after:opacity-100`;

// ── component ─────────────────────────────────────────────────────────────────
const QuotesShipownHistory = () => {
    const { id } = useParams(); // bookingrequestId
    const navigate = useNavigate();

    // Google Maps API status
    const [apiLoaded, setApiLoaded] = useState(false);

    // API data
    const [isLoading, setIsLoading] = useState(true);
    const [providers, setProviders] = useState([]);
    const [bookingRequest, setBookingRequest] = useState(null);
    const [adminCommission, setAdminCommission] = useState("0");
    const [serviceFeePercent, setServiceFeePercent] = useState("0");
    const [userSurvey, setUserSurvey] = useState("");

    // Provider multi-select
    const [selectedProviderIds, setSelectedProviderIds] = useState([]);

    // Form state
    const [primaryContact, setPrimaryContact] = useState({ firstName: "", lastName: "", phone: "", countryCode: "+1", email: "", address: "", suiteAptBuilding: "", lat: "", lng: "" });
    const [secondaryContact, setSecondaryContact] = useState({ firstName: "", lastName: "", phone: "", countryCode: "+1", email: "", address: "", suiteAptBuilding: "", lat: "", lng: "" });
    const [shipperAddr, setShipperAddr] = useState({ firstName: "", lastName: "", email: "", phone: "", countryCode: "+1", address: "", suiteAptBuilding: "", lat: "", lng: "", sameAsOrigin: false });
    const [deliveryAddr, setDeliveryAddr] = useState({ firstName: "", lastName: "", email: "", phone: "", countryCode: "+1", address: "", suiteAptBuilding: "", lat: "", lng: "", sameAsPrimary: false });

    // New fields
    const [pickupDate, setPickupDate] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");

    // Inline errors
    const [errors, setErrors] = useState({});
    const [addOns, setAddOns] = useState({
        "Customs Clearance": false,
        "Cargo Insurance": false,
        "Pre & Post-Shipment Inspection": false
    });

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

        // Load Google Maps API script globally if not already present
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
                const response = await getAvailableQuotes(id);
                console.log("Quotes fetched successfully!", response);
                if (response.status) {
                    setBookingRequest(response.body.bookingRequest);
                    setProviders(response.body.providers);
                    setAdminCommission(response.body.adminCommission || "0");
                    if (response.body.serviceFeePercent != null) {
                      setServiceFeePercent(response.body.serviceFeePercent);
                    }
                    setUserSurvey(response.body.userSurvey || "");
                    if (response.body.providers.length === 0) {
                        toast.error("No providers found for this request.");
                        navigate("/history");
                    }
                } else {
                    toast.error(response.message || "Failed to fetch quotes");
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Failed to fetch quotes");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleAddOnChange = (item) => {
        setAddOns(prev => ({ ...prev, [item]: !prev[item] }));
    };

    // ── provider toggle ─────────────────────────────────────────────────────────
    const handleProviderSelect = (id) => {
        setSelectedProviderIds((prev) => (prev.includes(id) ? [] : [id]));
        setErrors((prev) => ({ ...prev, providers: "" }));
    };

    // ── field change helpers ────────────────────────────────────────────────────
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

    // ── same-as checkboxes ──────────────────────────────────────────────────────
    const handleShipperSameAsOrigin = (checked) => {
        setShipperAddr((prev) => ({
            ...prev,
            sameAsOrigin: checked,
            address: checked ? (bookingRequest?.origin || "") : "",
            lat: checked ? (bookingRequest?.origin_lat || "") : "",
            lng: checked ? (bookingRequest?.origin_long || "") : "",
            firstName: checked ? (bookingRequest?.name?.split(" ")[0] || "") : "",
            lastName: checked ? (bookingRequest?.name?.split(" ").slice(1).join(" ") || "") : "",
            email: checked ? (bookingRequest?.email || "") : "",
            phone: checked ? (bookingRequest?.phone || "") : "",
        }));

        if (checked) {
            setErrors(prev => ({
                ...prev,
                shipper_address: "",
                shipper_firstName: "",
                shipper_lastName: "",
                shipper_email: "",
                shipper_phone: ""
            }));
        }
    };

    const handleDeliverySameAsPrimary = (checked) => {
        setDeliveryAddr((prev) => ({
            ...prev,
            sameAsPrimary: checked,
            firstName: checked ? primaryContact.firstName : "",
            lastName: checked ? primaryContact.lastName : "",
            email: checked ? primaryContact.email : "",
            phone: checked ? primaryContact.phone : "",
            countryCode: checked ? primaryContact.countryCode : "+1",
            address: checked ? primaryContact.address : "",
            lat: checked ? primaryContact.lat : "",
            lng: checked ? primaryContact.lng : "",
        }));

        if (checked) {
            setErrors(prev => ({
                ...prev,
                delivery_firstName: "",
                delivery_lastName: "",
                delivery_email: "",
                delivery_phone: "",
                delivery_address: ""
            }));
        }
    };

    // ── validation ──────────────────────────────────────────────────────────────
    const validate = () => {
        const e = {};

        if (selectedProviderIds.length === 0)
            e.providers = "Please select at least one provider.";

        if (!pickupDate) e.pickup_date = "Pickup date is required";
        if (!deliveryDate) e.delivery_date = "Delivery date is required";

        // Primary contact
        if (!primaryContact.firstName.trim()) e.primary_firstName = "First name is required";
        if (!primaryContact.lastName.trim()) e.primary_lastName = "Last name is required";
        const primaryPhoneErr = validatePhoneForCountry(primaryContact.countryCode, primaryContact.phone);
        if (primaryPhoneErr) e.primary_phone = primaryPhoneErr;
        if (!primaryContact.email.trim()) e.primary_email = "Email is required";
        else if (!isValidEmail(primaryContact.email)) e.primary_email = "Invalid email format";
        if (!primaryContact.address.trim()) e.primary_address = "Address is required";

        // Shipper
        if (!shipperAddr.firstName.trim()) e.shipper_firstName = "First name is required";
        if (!shipperAddr.lastName.trim()) e.shipper_lastName = "Last name is required";
        const shipperPhoneErr = validatePhoneForCountry(shipperAddr.countryCode, shipperAddr.phone);
        if (shipperPhoneErr) e.shipper_phone = shipperPhoneErr;
        if (!shipperAddr.email.trim()) e.shipper_email = "Shipper email is required";
        else if (!isValidEmail(shipperAddr.email)) e.shipper_email = "Invalid email format";
        if (!shipperAddr.address.trim()) e.shipper_address = "Shipper address is required";

        // Delivery
        if (!deliveryAddr.firstName.trim()) e.delivery_firstName = "First name is required";
        if (!deliveryAddr.lastName.trim()) e.delivery_lastName = "Last name is required";
        const deliveryPhoneErr = validatePhoneForCountry(deliveryAddr.countryCode, deliveryAddr.phone);
        if (deliveryPhoneErr) e.delivery_phone = deliveryPhoneErr;
        if (!deliveryAddr.email.trim()) e.delivery_email = "Delivery email is required";
        else if (!isValidEmail(deliveryAddr.email)) e.delivery_email = "Invalid email format";
        if (!deliveryAddr.address.trim()) e.delivery_address = "Delivery address is required";

        // Secondary (optional — validate if any field is filled)
        const s = secondaryContact;
        const isSecondaryPartiallyFilled = s.firstName.trim() || s.lastName.trim() || s.email.trim() || s.phone.trim() || s.address.trim() || s.suiteAptBuilding.trim();

        if (isSecondaryPartiallyFilled) {
            if (!s.firstName.trim()) e.secondary_firstName = "First name is required";
            if (!s.lastName.trim()) e.secondary_lastName = "Last name is required";
            if (!s.email.trim()) e.secondary_email = "Email is required";
            else if (!isValidEmail(s.email)) e.secondary_email = "Invalid email format";
            if (!s.address.trim()) e.secondary_address = "Address is required";

            const secondaryPhoneErr = validatePhoneForCountry(s.countryCode, s.phone);
            if (secondaryPhoneErr) e.secondary_phone = secondaryPhoneErr;
            else if (!s.phone.trim()) e.secondary_phone = "Phone number is required";
        }

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
            primary_country_code: primaryContact.countryCode,
            primary_email: primaryContact.email,
            primary_address: primaryContact.address,
            primary_suite_apt_building: primaryContact.suiteAptBuilding,
            primary_full_address: `${primaryContact.address}${primaryContact.suiteAptBuilding ? ', ' + primaryContact.suiteAptBuilding : ''}`,
            secondary_firstName: secondaryContact.firstName,
            secondary_lastName: secondaryContact.lastName,
            secondary_phone_number: secondaryContact.phone,
            secondary_country_code: secondaryContact.countryCode,
            secondary_email: secondaryContact.email,
            secondary_address: secondaryContact.address,
            secondary_suite_apt_building: secondaryContact.suiteAptBuilding,
            secondary_full_address: `${secondaryContact.address}${secondaryContact.suiteAptBuilding ? ', ' + secondaryContact.suiteAptBuilding : ''}`,
            addOns: Object.keys(addOns).filter(k => addOns[k]),
            shiper_firstName: shipperAddr.firstName,
            shiper_lastName: shipperAddr.lastName,
            shiper_email: shipperAddr.email,
            shiper_phone_number: shipperAddr.phone,
            shiper_country_code: shipperAddr.countryCode,
            shiper_address: shipperAddr.address,
            shiper_suite_apt_building: shipperAddr.suiteAptBuilding,
            shiper_full_address: `${shipperAddr.address}${shipperAddr.suiteAptBuilding ? ', ' + shipperAddr.suiteAptBuilding : ''}`,
            consignee_firstName: deliveryAddr.firstName,
            consignee_lastName: deliveryAddr.lastName,
            consignee_email: deliveryAddr.email,
            consignee_phone_number: deliveryAddr.phone,
            consignee_country_code: deliveryAddr.countryCode,
            consignee_address: deliveryAddr.address,
            consignee_suite_apt_building: deliveryAddr.suiteAptBuilding,
            consignee_full_address: `${deliveryAddr.address}${deliveryAddr.suiteAptBuilding ? ', ' + deliveryAddr.suiteAptBuilding : ''}`,
            consignee_lat: deliveryAddr.lat || "30.7046",
            consignee_lng: deliveryAddr.lng || "76.7179",
            shiper_lat: shipperAddr.lat || "30.7046",
            shiper_lng: shipperAddr.lng || "76.7179",
            primary_lat: primaryContact.lat,
            primary_lng: primaryContact.lng,
            secondary_lat: secondaryContact.lat,
            secondary_lng: secondaryContact.lng,
            pickup_date: pickupDate,
            delivery_date: deliveryDate
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

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0a1612] flex items-center justify-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#243d34] to-[#0a1612]">
            <Commonbanner title="Best Quotes" />

            {/* Providers List */}
            <div className="container mx-auto py-10">
                <div className="container mx-auto">
                    <div className="py-15">
                        {providers.length === 0 ? (
                            <div className="text-center py-20 text-white/50">
                                <Package size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-xl">No shippers match your requirements right now.</p>
                                <p className="text-sm mt-2">Try adjusting your load details or origin/destination.</p>
                            </div>
                        ) : (() => {
                            // Providers are pre-sorted by the server based on user's survey preference
                            const bestQuote = providers[0];
                            const otherResults = providers.slice(1);
                            // Survey badge label
                            const surveyLabel = userSurvey === 'fast_delivery' ? '⚡ Sorted by: Fastest Delivery'
                                : userSurvey === 'safe_delivery' ? '🛡️ Sorted by: Safest Delivery'
                                    : userSurvey === 'lowest_price' ? '💰 Sorted by: Lowest Price'
                                        : '💰 Sorted by: Lowest Price';

                            const renderProvider = (providerDetail, idx, isBest) => {
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
                                                        // Route-aware card selection — keeps this card in sync with checkout.
                                                        const card = selectRateCard(providerDetail.barrelPrices, {
                                                            type: 'own',
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
                                                        {isBest ? "Best Quote" : `Quote ${idx}`}
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
                                    {/* Survey badge */}
                                    <div className="mb-4">
                                        <span className="inline-block bg-[#1b352b] border border-[#9fe0b8]/30 text-[#9fe0b8] text-xs font-medium px-3 py-1.5 rounded-full">
                                            {surveyLabel}
                                        </span>
                                    </div>

                                    {/* Best Quote Section */}
                                    <div className="mb-10">
                                        {renderProvider(bestQuote, 1, true)}
                                    </div>
                                    {/* Other Results Section */}
                                    {otherResults.length > 0 && (
                                        <div className="mt-15">
                                            <h3 className="text-white text-[28px] sm:text-[36px] font-bold mb-6">Other Results</h3>
                                            {otherResults.map((p, i) => renderProvider(p, i + 1, false))}
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


                <div className="divider h-[1px] bg-white/10 mb-10" />

                {/* Add-ons */}
                <div className="mb-10 text-white">
                    <h3 className="md:text-[42px] text-[28px] font-semibold">Add-Ons</h3>
                    <p className="text-lg font-medium mb-3">Customize Your Shipment</p>
                    <div className="space-y-6">
                        {["Customs Clearance", "Cargo Insurance", "Pre & Post-Shipment Inspection"].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <label className="flex items-center gap-3 text-[21px] font-medium cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={addOns[item] || false}
                                        onChange={() => handleAddOnChange(item)}
                                        className="w-[30px] h-[30px] appearance-none rounded-sm border-1 border-[#4E6B5D] bg-transparent cursor-pointer relative checked:bg-[#FFD233] checked:border-[#FFD233] after:content-['✓'] after:absolute after:text-black after:text-[20px] after:font-bold after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:opacity-0 checked:after:opacity-100"
                                    />
                                    {item}
                                </label>
                                <div className="tooltip-container">
                                    <Info size={18} className="text-white/50 hover:text-white cursor-pointer" />
                                    <span className="tooltip-text">
                                        Optional service to enhance your shipping experience.
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="divider h-[1px] bg-white/10 mb-10" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                    <Field
                        label="Pickup Date"
                        type="date"
                        value={pickupDate}
                        onChange={(val) => {
                            setPickupDate(val);
                            setErrors(prev => ({ ...prev, pickup_date: "" }));
                        }}
                        errorKey="pickup_date"
                        errors={errors}
                    />
                    <Field
                        label="Delivery Date"
                        type="date"
                        value={deliveryDate}
                        onChange={(val) => {
                            setDeliveryDate(val);
                            setErrors(prev => ({ ...prev, delivery_date: "" }));
                        }}
                        errorKey="delivery_date"
                        errors={errors}
                    />
                </div>

                {/* Form Sections */}
                <div className="text-white space-y-10">
                    <div>
                        <h3 className="md:text-[42px] text-[25px] font-semibold mb-1">
                            Recipient Contact Information
                        </h3>
                        <p className="text-lg font-medium mb-4">
                            Recipient is the person or business receiving the shipment
                        </p>
                        {/* <h3 className="md:text-[32px] text-[24px] font-semibold mb-4 text-yellow-400">Recipient Information</h3> */}
                        <div className="bg-[#2D413F] rounded-xl p-6 md:p-8">
                            <h4 className="text-xl font-semibold mb-4">Primary Contact</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="First Name" placeholder="e.g. John" value={primaryContact.firstName} onChange={setPrimary("firstName")} errorKey="primary_firstName" errors={errors} />
                                <Field label="Last Name" placeholder="e.g. Smith" value={primaryContact.lastName} onChange={setPrimary("lastName")} errorKey="primary_lastName" errors={errors} />
                                <PhoneInput
                                    label="Phone Number"
                                    value={primaryContact.phone}
                                    onChange={setPrimary("phone")}
                                    countryCode={primaryContact.countryCode}
                                    onCountryChange={(code) => setPrimaryContact(prev => ({ ...prev, countryCode: code }))}
                                    error={errors.primary_phone}
                                />
                                <Field label="Email" placeholder="e.g. johnsmith@gmail.com" value={primaryContact.email} onChange={setPrimary("email")} errorKey="primary_email" errors={errors} />
                                <AddressField
                                    label="Address"
                                    placeholder="e.g. 5 VerShip Close, Kingston"
                                    value={primaryContact.address}
                                    onChange={setPrimary("address")}
                                    onPlaceSelected={(place) => {
                                        setPrimaryContact(prev => ({
                                            ...prev,
                                            address: place.formatted_address || place.name,
                                            lat: place.geometry.location.lat().toString(),
                                            lng: place.geometry.location.lng().toString()
                                        }));
                                        setErrors(prev => ({ ...prev, primary_address: "" }));
                                    }}
                                    errorKey="primary_address"
                                    errors={errors}
                                    apiLoaded={apiLoaded}
                                />
                                <Field label="Suite / Apt / Building" placeholder="e.g. Apt 2B" value={primaryContact.suiteAptBuilding} onChange={setPrimary("suiteAptBuilding")} errorKey="" errors={errors} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Shipper */}
                        <div className="bg-[#2D413F] rounded-xl p-6">
                            <h4 className="text-[25px] font-semibold mb-2">Add Shipper Address</h4>
                            <p className="mb-3 text-white/70 text-sm">
                                The "Shipper" is the person sending the package to the destination address
                            </p>
                            {/* <h4 className="text-xl font-semibold mb-2">Shipper Address</h4> */}
                            <label className="text-sm flex items-center mb-4 cursor-pointer text-white/70">
                                <input type="checkbox" className={checkboxCls} checked={shipperAddr.sameAsOrigin} onChange={(e) => handleShipperSameAsOrigin(e.target.checked)} />
                                Same as Origin
                            </label>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="First Name" placeholder="e.g. John" value={shipperAddr.firstName} onChange={setShipper("firstName")} errorKey="shipper_firstName" errors={errors} />
                                    <Field label="Last Name" placeholder="e.g. Smith" value={shipperAddr.lastName} onChange={setShipper("lastName")} errorKey="shipper_lastName" errors={errors} />
                                </div>
                                <Field label="Email" placeholder="e.g. johnsmith@gmail.com" value={shipperAddr.email} onChange={setShipper("email")} errorKey="shipper_email" errors={errors} />
                                <PhoneInput
                                    label="Phone Number"
                                    value={shipperAddr.phone}
                                    onChange={setShipper("phone")}
                                    countryCode={shipperAddr.countryCode}
                                    onCountryChange={(code) => setShipperAddr(prev => ({ ...prev, countryCode: code }))}
                                    error={errors.shipper_phone}
                                />
                                <AddressField
                                    label="Address"
                                    placeholder="e.g. 11 VerShip Road, Pittsburgh"
                                    value={shipperAddr.address}
                                    onChange={setShipper("address")}
                                    onPlaceSelected={(place) => {
                                        setShipperAddr(prev => ({
                                            ...prev,
                                            address: place.formatted_address || place.name,
                                            lat: place.geometry.location.lat().toString(),
                                            lng: place.geometry.location.lng().toString()
                                        }));
                                        setErrors(prev => ({ ...prev, shipper_address: "" }));
                                    }}
                                    errorKey="shipper_address"
                                    errors={errors}
                                    apiLoaded={apiLoaded}
                                />
                                <Field label="Suite / Apt / Building" placeholder="e.g. Apt 2B" value={shipperAddr.suiteAptBuilding} onChange={setShipper("suiteAptBuilding")} errorKey="" errors={errors} />
                            </div>
                        </div>

                        {/* Delivery */}
                        <div className="bg-[#2D413F] rounded-xl p-6">
                            <h4 className="text-xl font-semibold mb-2">Delivery Address</h4>
                            <label className="text-sm flex items-center mb-4 cursor-pointer text-white/70">
                                <input type="checkbox" className={checkboxCls} checked={deliveryAddr.sameAsPrimary} onChange={(e) => handleDeliverySameAsPrimary(e.target.checked)} />
                                Same as Primary Contact
                            </label>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="First Name" placeholder="e.g. John" value={deliveryAddr.firstName} onChange={setDelivery("firstName")} errorKey="delivery_firstName" errors={errors} />
                                    <Field label="Last Name" placeholder="e.g. Smith" value={deliveryAddr.lastName} onChange={setDelivery("lastName")} errorKey="delivery_lastName" errors={errors} />
                                </div>
                                <Field label="Email" placeholder="e.g. johnsmith@gmail.com" value={deliveryAddr.email} onChange={setDelivery("email")} errorKey="delivery_email" errors={errors} />
                                <PhoneInput
                                    label="Phone Number"
                                    value={deliveryAddr.phone}
                                    onChange={setDelivery("phone")}
                                    countryCode={deliveryAddr.countryCode}
                                    onCountryChange={(code) => setDeliveryAddr(prev => ({ ...prev, countryCode: code }))}
                                    error={errors.delivery_phone}
                                />
                                <AddressField
                                    label="Address"
                                    placeholder="e.g. 5 VerShip Close, Kingston"
                                    value={deliveryAddr.address}
                                    onChange={setDelivery("address")}
                                    onPlaceSelected={(place) => {
                                        setDeliveryAddr(prev => ({
                                            ...prev,
                                            address: place.formatted_address || place.name,
                                            lat: place.geometry.location.lat().toString(),
                                            lng: place.geometry.location.lng().toString()
                                        }));
                                        setErrors(prev => ({ ...prev, delivery_address: "" }));
                                    }}
                                    errorKey="delivery_address"
                                    errors={errors}
                                    apiLoaded={apiLoaded}
                                />
                                <Field label="Suite / Apt / Building" placeholder="e.g. Apt 2B" value={deliveryAddr.suiteAptBuilding} onChange={setDelivery("suiteAptBuilding")} errorKey="" errors={errors} />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center pt-10 pb-20">
                        <button
                            onClick={handleSubmit}
                            className="bg-yellow-400 text-black font-bold px-20 py-4 rounded-full hover:brightness-110 transition shadow-xl"
                        >
                            Finalize Booking
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuotesShipownHistory;
