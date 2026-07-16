import React, { useState, useEffect } from 'react'
import { man } from "../common/common-assets/assets-images";
import { useNavigate } from 'react-router-dom';
import ProfileMain from '../components/ProfileMain';
import Commonbanner from '../components/Commonbanner';
import { getProviderProfile, completeProfile } from '../api/cms';
import MultiSelect from '../components/MultiSelect';
import { toast } from 'sonner';
import SuccessPopup from '../components/SuccessPopup';
import countries from "world-countries";
import { FaSpinner, FaPlus, FaTrash } from "react-icons/fa";

const ORIGIN_CITIES = [
  "Fort Lauderdale, FL",
  "Miami, FL",
  "Pittsburgh, PA",
  "Orlando, FL",
];

const DESTINATION_CITIES = [
  "Kingston, Jamaica",
];

const CITY_COORDINATES = {
  "Fort Lauderdale, FL": { lat: "26.1224", lng: "-80.1373" },
  "Miami, FL": { lat: "25.7617", lng: "-80.1918" },
  "Pittsburgh, PA": { lat: "40.4387", lng: "-79.9972" },
  "Orlando, FL": { lat: "28.4778279", lng: "-81.2880713" },
};

const TRANSIT_TIME_NUMBERS = ["2", "3", "4"];
const TRANSIT_TIME_NUMBERS_OWN_BARREL = ["14", "21", "30"];
const TRANSIT_TIME_UNITS = ["days"];
const SHIPMENT_CONTENTS_OPTIONS = [
  "Food",
  "Household items",
  "Electronics & small appliances",
  "Clothes",
  "Toiletries",
  "Goods for resale"
];

const MAX_CUSTOMS = 999999999.99;

const normCustoms = (val) => {
  const str = String(val ?? "");
  const parts = str.split(",");
  if (parts.length === 25) return str;
  return Array(25).fill("").join(",");
};

// Validate a 25-slot per-barrel price string. Entries are optional (a freight
// user may price only the first N barrels), but whatever is entered must be
// filled sequentially from Barrel 1 with no gaps. Returns "" when valid.
const validateSequentialBarrelPrices = (value) => {
  const parts = String(value ?? "").split(",").map(v => (v ?? "").trim());
  const lastFilled = parts.reduce((acc, v, i) => (v !== "" ? i : acc), -1);
  if (lastFilled < 0) return ""; // fully optional: no entries is allowed
  const upto = parts.slice(0, lastFilled + 1);
  if (upto.some(v => v === "")) return "Enter barrel prices in order, with no gaps";
  if (upto.some(v => isNaN(v) || Number(v) < 0)) return "Enter a valid price";
  if (upto.some(v => Number(v) > MAX_CUSTOMS)) return `Price cannot exceed ${MAX_CUSTOMS.toLocaleString()}`;
  if (upto.some(v => { const d = v.split('.')[1]; return d && d.length > 2; })) return "Max 2 decimal places allowed";
  return "";
};

const customsDisplay = (raw, n) => {
  if (!raw) return "";
  const v = String(raw).split(",")[n - 1] ?? "";
  return v === "" || v === "0" || v === "0.00" ? "" : v;
};

const createBarrelConfigNext = ({
  pricePerMile = "",
  freeMiles = "",
  customsAndHandling = normCustoms(""),
  flatPickupCharge = normCustoms(""),
  flatDeliveryCharge = normCustoms(""),
  pickupFreeMiles = "",
  pickupPerMileCharge = "",
  deliveryFreeMiles = "",
  deliveryPerMileCharge = ""
} = {}) => ({
  originCountry: "",
  destinationCountry: "",
  basePrice: "",
  pricePerPound: "",
  pricePerMile,
  customsAndHandling,
  transitTime: "",
  shipmentContents: "",
  freeMiles,
  originLat: "",
  originLong: "",
  destinationLat: "",
  destinationLong: "",
  isVolumeDiscount: false,
  discountAfter: 5,
  discountPercent: 10,
  barrelPrices: [{ quantity: 1, price: "", discount: "0" }],
  flatPickupCharge,
  pickupFreeMiles,
  pickupPerMileCharge,
  flatDeliveryCharge,
  deliveryFreeMiles,
  deliveryPerMileCharge
});

const BusinessUploadNext = () => {
  const navigate = useNavigate();
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : {};

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    basePrice: "",
    pricePerMile: "",
    pricePerPound: "",
    originLat: "",
    originLong: "",
    destinationLat: "",
    destinationLong: "",
    shipmentType: "",
    originCountry: "",
    destinationCountry: "",
    transitTime: "",
    shipmentContents: ""
  });

  const [ownBarrelConfigs, setOwnBarrelConfigs] = useState([]);
  const [dropOffBarrelConfigs, setDropOffBarrelConfigs] = useState([]);

  const [selectedSubTypes, setSelectedSubTypes] = useState([]);
  const [errors, setErrors] = useState({});
  const [customsOpen, setCustomsOpen] = useState({});
  const [flatPickupOpen, setFlatPickupOpen] = useState({});
  const [flatDeliveryOpen, setFlatDeliveryOpen] = useState({});
  
  const toggleCustoms = (k) => setCustomsOpen(p => ({ ...p, [k]: !p[k] }));
  const toggleFlatPickup = (k) => setFlatPickupOpen(p => ({ ...p, [k]: !p[k] }));
  const toggleFlatDelivery = (k) => setFlatDeliveryOpen(p => ({ ...p, [k]: !p[k] }));

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user.id) return;
      try {
        const response = await getProviderProfile(user.id);
        if (response.success && response.body.businessInfo) {
          const info = response.body.businessInfo;
          setFormData({
            basePrice: info.basePrice || "",
            pricePerMile: info.pricePerMile || "",
            pricePerPound: info.pricePerPound || "",
            originLat: info.originLat || "",
            originLong: info.originLong || "",
            destinationLat: info.destinationLat || "",
            destinationLong: info.destinationLong || "",
            shipmentType: info.shipmentType || "",
            originCountry: info.originCountry || "",
            destinationCountry: info.destinationCountry || "",
            transitTime: info.transitTime || "",
            shipmentContents: info.shipmentContents || ""
          });

          if (info.shipmentItemTypes) {
            const subTypes = info.shipmentItemTypes.map(t => t.item_type);
            setSelectedSubTypes(subTypes);

            if (subTypes.includes("Ship Your Own Barrel")) {
              if (info.barrelOptions?.ownBarrel && Array.isArray(info.barrelOptions.ownBarrel) && info.barrelOptions.ownBarrel.length > 0) {
                const hydrateConfig = (config) => {
                  const dAfter = Number(config.discountAfter || 0);
                  const dPercent = Number(config.discountPercent || 0);
                  const hasDiscount = Boolean(config.isVolumeDiscount) || dAfter > 0 || dPercent > 0;
                  return {
                    ...createBarrelConfigNext(),
                    ...config,
                    customsAndHandling: normCustoms(config.customsAndHandling),
                    flatPickupCharge: normCustoms(config.flatPickupCharge),
                    flatDeliveryCharge: normCustoms(config.flatDeliveryCharge),
                    transitTime: config.transitTime || "",
                    shipmentContents: config.shipmentContents || "",
                    isVolumeDiscount: hasDiscount,
                    discountAfter: dAfter || 5,
                    discountPercent: dPercent || 10,
                    barrelPrices: [{ quantity: 1, price: config.basePrice || "", discount: "0" }],
                    pickupFreeMiles: config.pickupFreeMiles || "",
                    pickupPerMileCharge: config.pickupPerMileCharge || "",
                    deliveryFreeMiles: config.deliveryFreeMiles || "",
                    deliveryPerMileCharge: config.deliveryPerMileCharge || ""
                  };
                };
                setOwnBarrelConfigs(info.barrelOptions.ownBarrel.map(hydrateConfig));
              } else {
                setOwnBarrelConfigs([createBarrelConfigNext()]);
              }
            } else {
              setOwnBarrelConfigs([]);
            }

            if (subTypes.includes("Request Barrel Drop-Off")) {
              if (info.barrelOptions?.dropOffBarrel && Array.isArray(info.barrelOptions.dropOffBarrel) && info.barrelOptions.dropOffBarrel.length > 0) {
                const hydrateConfig = (config) => {
                  const dAfter = Number(config.discountAfter || 0);
                  const dPercent = Number(config.discountPercent || 0);
                  const hasDiscount = Boolean(config.isVolumeDiscount) || dAfter > 0 || dPercent > 0;
                  return {
                    ...createBarrelConfigNext(),
                    ...config,
                    customsAndHandling: normCustoms(config.customsAndHandling),
                    flatPickupCharge: normCustoms(config.flatPickupCharge),
                    flatDeliveryCharge: normCustoms(config.flatDeliveryCharge),
                    transitTime: config.transitTime || "",
                    shipmentContents: config.shipmentContents || "",
                    isVolumeDiscount: hasDiscount,
                    discountAfter: dAfter || 5,
                    discountPercent: dPercent || 10,
                    barrelPrices: [{ quantity: 1, price: config.basePrice || "", discount: "0" }],
                    pickupFreeMiles: config.pickupFreeMiles || "",
                    pickupPerMileCharge: config.pickupPerMileCharge || "",
                    deliveryFreeMiles: config.deliveryFreeMiles || "",
                    deliveryPerMileCharge: config.deliveryPerMileCharge || ""
                  };
                };
                setDropOffBarrelConfigs(info.barrelOptions.dropOffBarrel.map(hydrateConfig));
              } else {
                setDropOffBarrelConfigs([createBarrelConfigNext()]);
              }
            } else {
              setDropOffBarrelConfigs([]);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    };
    fetchProfile();
  }, [user.id]);

  const validateField = (name, value, type = 'main') => {
    let error = "";
    const strValue = (value !== null && value !== undefined) ? String(value) : "";

    if (strValue === "" && name !== "shipmentType" && name !== "sub_shipment_type" && name !== "originCountry" && name !== "destinationCountry") {
    }

    if (type === 'main') {
      switch (name) {
        case "basePrice":
          if (!strValue) error = "Base Price is required";
          else if (Number(strValue) === 0) error = "Price must be greater than 0";
          break;
        case "pricePerMile":
          if (!strValue) error = "Price Per Mile is required";
          else if (Number(strValue) === 0) error = "Price must be greater than 0";
          break;
        case "shipmentType":
          if (!strValue) error = "Shipment Type is required";
          break;
        case "sub_shipment_type":
          const subOptions = getSubOptions();
          if (subOptions.length > 0 && (!value || value.length === 0)) {
            error = "At least one sub-type must be selected";
          }
          break;
        case "originCountry":
          if (!strValue) error = "Origin Country is required";
          break;
        case "destinationCountry":
          if (!strValue) error = "Destination Country is required";
          break;
        case "transitTime":
          if (!strValue) error = "Transit Time is required";
          break;
        default:
          break;
      }
    }

    if (type.startsWith('ownBarrel_') || type.startsWith('dropOffBarrel_')) {
      const parts = type.split('_');
      const typePrefix = parts[0];
      const configIndex = parseInt(parts[1]);

      const isDropOff = typePrefix === 'dropOffBarrel';
      const skipFields = ['flatPickupCharge', 'pickupFreeMiles', 'pickupPerMileCharge', 'flatDeliveryCharge', 'deliveryFreeMiles', 'deliveryPerMileCharge'];

      if (isDropOff && skipFields.includes(name)) {
        return error;
      }

      switch (name) {
        case "originCountry":
          if (!strValue) error = "Origin city is required";
          break;
        case "destinationCountry":
          if (!strValue) error = "Destination city is required";
          break;
        case "basePrice":
          if (!strValue.trim()) error = "Base price is required";
          else if (Number(strValue) === 0) error = "Price must be greater than 0";
          break;
        case "customsAndHandling": {
          error = validateSequentialBarrelPrices(strValue);
          break;
        }
        case "flatPickupCharge": {
          if (!isDropOff) error = validateSequentialBarrelPrices(strValue);
          break;
        }
        case "flatDeliveryCharge": {
          if (!isDropOff) error = validateSequentialBarrelPrices(strValue);
          break;
        }
        case "transitTime":
          if (!strValue) error = "Transit time is required";
          break;
        case "pickupFreeMiles":
          if (!isDropOff) {
            if (!strValue.trim()) error = "Pickup free miles is required";
            else if (Number(strValue) < 0) error = "Cannot be negative";
            else if (Number(strValue) > 30) error = "Cannot exceed 30 miles";
          }
          break;
        case "pickupPerMileCharge":
          if (!isDropOff) {
            if (!strValue.trim()) error = "Pickup per mile charge is required";
            else if (Number(strValue) <= 0) error = "Must be greater than 0";
          }
          break;
        case "deliveryFreeMiles":
          if (!isDropOff) {
            if (!strValue.trim()) error = "Delivery free miles is required";
            else if (Number(strValue) < 0) error = "Cannot be negative";
            else if (Number(strValue) > 50) error = "Cannot exceed 50 miles";
          }
          break;
        case "deliveryPerMileCharge":
          if (!isDropOff) {
            if (!strValue.trim()) error = "Delivery per mile charge is required";
            else if (Number(strValue) <= 0) error = "Must be greater than 0";
          }
          break;
        default:
          break;
      }
      setErrors(prev => ({ ...prev, [`${typePrefix}_${configIndex}_${name}`]: error }));
    } else {
      setErrors(prev => ({ ...prev, [name]: error }));
    }

    return error;
  };

  const validateBarrelPrices = (barrelPrices, typePrefix, configIndex, errorsObj = null) => {
    const item = barrelPrices[0];
    if (!item) return false;

    const priceVal = Number(item.price);
    if (!item.price || item.price === "" || item.price === "0") {
      return false;
    }

    const hasError = isNaN(priceVal) || priceVal <= 0;
    if (hasError && errorsObj) {
      errorsObj[`${typePrefix}_${configIndex}_barrelPrice_0`] = "Price must be greater than 0";
    }
    return hasError;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name !== 'shipmentContents') {
      formattedValue = value.replace(/^\s+/, "");
    }

    const priceFields = ["basePrice", "pricePerMile"];

    if (priceFields.includes(name)) {
      formattedValue = formattedValue.replace(/[^0-9.]/g, "");
    }

    if (name === "shipmentType") {
      setSelectedSubTypes([]);
      setErrors(prev => ({ ...prev, sub_shipment_type: "" }));
      setOwnBarrelConfigs([]);
      setDropOffBarrelConfigs([]);
    }

    setFormData(prev => {
      const updated = { ...prev, [name]: formattedValue };
      if ((name === "originCountry" || name === "destinationCountry") && CITY_COORDINATES[formattedValue]) {
        const prefix = name === "originCountry" ? "origin" : "destination";
        updated[`${prefix}Lat`] = CITY_COORDINATES[formattedValue].lat;
        updated[`${prefix}Long`] = CITY_COORDINATES[formattedValue].lng;
      }
      return updated;
    });
    validateField(name, formattedValue);
  };

  const updateVolumePrices = (configIndex, type, basePrice) => {
    const setter = type === 'own' ? setOwnBarrelConfigs : setDropOffBarrelConfigs;
    setter(prev => {
      const updated = [...prev];
      const bPrice = parseFloat(basePrice) || 0;
      updated[configIndex] = {
        ...updated[configIndex],
        barrelPrices: [{ quantity: 1, price: bPrice.toFixed(2), discount: "0" }],
      };
      return updated;
    });
  };

  const handleVolumeToggle = (configIndex, type, enabled) => {
    const setter = type === 'own' ? setOwnBarrelConfigs : setDropOffBarrelConfigs;
    setter(prev => {
      const updated = [...prev];
      updated[configIndex] = { ...updated[configIndex], isVolumeDiscount: enabled };
      return updated;
    });
    const configs = type === 'own' ? ownBarrelConfigs : dropOffBarrelConfigs;
    if (configs[configIndex]?.basePrice) {
      updateVolumePrices(configIndex, type, configs[configIndex].basePrice);
    }
  };

  const handleVolumeChange = (configIndex, type, field, value) => {
    const setter = type === 'own' ? setOwnBarrelConfigs : setDropOffBarrelConfigs;
    setter(prev => {
      const updated = [...prev];
      updated[configIndex] = { ...updated[configIndex], [field]: Number(value) };
      return updated;
    });
  };

  const handleMultiFieldChange = (index, isOwn, fieldName, barrelNum, val) => {
    let fv = val.replace(/^\s+/, "").replace(/[^0-9.]/g, "");
    const pts = fv.split('.');
    if (pts.length > 2) fv = pts[0] + '.' + pts.slice(1).join('');
    if (fv !== "" && fv !== ".") {
      const n = parseFloat(fv);
      if (!isNaN(n) && n > MAX_CUSTOMS) fv = MAX_CUSTOMS.toFixed(2);
    }
    const dec = fv.split('.')[1];
    if (dec && dec.length > 2) fv = fv.split('.')[0] + '.' + dec.slice(0, 2);

    const configs = isOwn ? ownBarrelConfigs : dropOffBarrelConfigs;
    const arr = (configs[index][fieldName] || "").split(",");
    while (arr.length < 25) arr.push("");
    arr[barrelNum - 1] = fv;
    const newVal = arr.join(",");

    (isOwn ? setOwnBarrelConfigs : setDropOffBarrelConfigs)(prev => {
      const u = [...prev];
      u[index] = { ...u[index], [fieldName]: newVal };
      return u;
    });
    validateField(fieldName, newVal, isOwn ? `ownBarrel_${index}` : `dropOffBarrel_${index}`);
  };

  const handleOwnBarrelChange = (index, e) => {
    const { name, value } = e.target;
    let formattedValue = value.replace(/^\s+/, "");
    const priceFields = ["basePrice", "pricePerMile", "customsAndHandling",
      "flatPickupCharge", "pickupFreeMiles", "pickupPerMileCharge",
      "flatDeliveryCharge", "deliveryFreeMiles", "deliveryPerMileCharge"];
    if (priceFields.includes(name)) {
      formattedValue = formattedValue.replace(/[^0-9.]/g, "");
      const numValue = parseFloat(formattedValue);
      if (!isNaN(numValue) && formattedValue.includes('.')) {
        const parts = formattedValue.split('.');
        if (parts[1] && parts[1].length > 2) {
          formattedValue = numValue.toFixed(2);
        }
      }
    }
    setOwnBarrelConfigs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: formattedValue };
      if (name === "originCountry" && CITY_COORDINATES[formattedValue]) {
        updated[index].originLat = CITY_COORDINATES[formattedValue].lat;
        updated[index].originLong = CITY_COORDINATES[formattedValue].lng;
      }
      if (name === "destinationCountry" && CITY_COORDINATES[formattedValue]) {
        updated[index].destinationLat = CITY_COORDINATES[formattedValue].lat;
        updated[index].destinationLong = CITY_COORDINATES[formattedValue].lng;
      }
      return updated;
    });
    validateField(name, formattedValue, `ownBarrel_${index}`);
  };

  const handleDropOffBarrelChange = (index, e) => {
    const { name, value } = e.target;
    let formattedValue = value.replace(/^\s+/, "");

    const allowedPriceFields = ["basePrice", "customsAndHandling"];
    if (allowedPriceFields.includes(name)) {
      formattedValue = formattedValue.replace(/[^0-9.]/g, "");
      const numValue = parseFloat(formattedValue);
      if (!isNaN(numValue) && formattedValue.includes('.')) {
        const parts = formattedValue.split('.');
        if (parts[1] && parts[1].length > 2) {
          formattedValue = numValue.toFixed(2);
        }
      }
    }

    setDropOffBarrelConfigs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: formattedValue };
      if (name === "originCountry" && CITY_COORDINATES[formattedValue]) {
        updated[index].originLat = CITY_COORDINATES[formattedValue].lat;
        updated[index].originLong = CITY_COORDINATES[formattedValue].lng;
      }
      if (name === "destinationCountry" && CITY_COORDINATES[formattedValue]) {
        updated[index].destinationLat = CITY_COORDINATES[formattedValue].lat;
        updated[index].destinationLong = CITY_COORDINATES[formattedValue].lng;
      }
      return updated;
    });
    validateField(name, formattedValue, `dropOffBarrel_${index}`);
  };

  const addOwnBarrelConfig = () => {
    setOwnBarrelConfigs(prev => [...prev, createBarrelConfigNext()]);
  };

  const removeOwnBarrelConfig = (index) => {
    if (ownBarrelConfigs.length > 1) {
      setOwnBarrelConfigs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const addDropOffBarrelConfig = () => {
    setDropOffBarrelConfigs(prev => [...prev, createBarrelConfigNext()]);
  };

  const removeDropOffBarrelConfig = (index) => {
    if (dropOffBarrelConfigs.length > 1) {
      setDropOffBarrelConfigs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const toggleSubType = (typeId) => {
    setSelectedSubTypes(prev => {
      const isAdding = !prev.includes(typeId);
      const next = isAdding
        ? [...prev, typeId]
        : prev.filter(t => t !== typeId);

      if (isAdding) {
        if (typeId === "Ship Your Own Barrel") {
          setOwnBarrelConfigs(curr => {
            if (curr.length === 0) {
              return [createBarrelConfigNext({
                pricePerMile: "0",
                freeMiles: "0",
                customsAndHandling: normCustoms(""),
                flatPickupCharge: normCustoms(""),
                flatDeliveryCharge: normCustoms(""),
                pickupFreeMiles: "0",
                pickupPerMileCharge: "0",
                deliveryFreeMiles: "0",
                deliveryPerMileCharge: "0"
              })];
            }
            return curr;
          });
        } else if (typeId === "Request Barrel Drop-Off") {
          setDropOffBarrelConfigs(curr => {
            if (curr.length === 0) {
              return [createBarrelConfigNext({
                pricePerMile: "0",
                freeMiles: "0",
                customsAndHandling: normCustoms(""),
                flatPickupCharge: normCustoms(""),
                flatDeliveryCharge: normCustoms(""),
                pickupFreeMiles: "0",
                pickupPerMileCharge: "0",
                deliveryFreeMiles: "0",
                deliveryPerMileCharge: "0"
              })];
            }
            return curr;
          });
        }
      } else {
        if (!next.includes("Ship Your Own Barrel")) {
          setOwnBarrelConfigs([]);
        }
        if (!next.includes("Request Barrel Drop-Off")) {
          setDropOffBarrelConfigs([]);
        }
      }

      validateField("sub_shipment_type", next);
      return next;
    });
  };

  const getSubOptions = () => {
    switch (formData.shipmentType) {
      case "barrel":
        return [
          { id: "Ship Your Own Barrel", label: "Ship Your Own Barrel" },
          { id: "Request Barrel Drop-Off", label: "Request Barrel Drop-Off" }
        ];
      case "box":
        return [
          { id: "Small Box", label: "Small Box" },
          { id: "Large Box", label: "Large Box" }
        ];
      case "container":
        return [
          { id: "20FT FCL", label: "20FT FCL" },
          { id: "20FT LCL", label: "20FT LCL" },
          { id: "40FT FCL", label: "40FT FCL" },
          { id: "40FT LCL", label: "40FT LCL" }
        ];
      default:
        return [];
    }
  };

  const renderMultiFieldAccordion = ({
    isOpen,
    onToggle,
    value,
    onChange,
    label,
    fieldName,
    configIndex,
    isOwn,
    errorKey,
    error,
    bgColor = 'white/5',
    borderColor = 'white/20'
  }) => {
    const displayValue = (raw, n) => {
      if (!raw) return "";
      const v = String(raw).split(",")[n - 1] ?? "";
      return v === "" || v === "0" || v === "0.00" ? "" : v;
    };

    return (
      <div className="relative" style={{ zIndex: isOpen ? 40 : 'auto' }}>
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-white/90 whitespace-nowrap">{label}</h3>
            <span className="text-[11px] text-white/40 whitespace-nowrap">(1–25 barrels)</span>
          </div>
          <svg
            className={`w-4 h-4 text-white/50 transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute left-0 right-0 mt-1 p-4 rounded-lg border border-white/20 shadow-2xl"
            style={{ background: '#152b20', top: '100%', zIndex: 50 }}
          >
            <p className="text-[11px] text-white/40 mb-3">Optional — enter prices starting at Barrel 1 with no gaps. You can stop at any barrel; any order larger than your last entry is charged at your last entered price.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {Array.from({ length: 25 }, (_, i) => {
                const bn = i + 1;
                return (
                  <div key={bn} className="flex flex-col">
                    <label className="text-[10px] text-white/50 mb-1">Barrel {bn}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Enter"
                      value={displayValue(value, bn)}
                      onChange={(e) => onChange(configIndex, isOwn, fieldName, bn, e.target.value)}
                      className="w-full bg-white/5 border border-white/20 text-white placeholder:text-white/20 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-xs mt-1 font-medium">{error}</p>
        )}
      </div>
    );
  };

  const renderBarrelPrices = (type, config, configIndex) => {
    const isOwn = type === 'ownBarrel';
    const typeLabel = isOwn ? 'own' : 'dropoff';

    return (
      <div className="mt-4 p-5 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-yellow-400 font-bold text-lg">Volume Discount</h4>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.isVolumeDiscount}
                onChange={(e) => handleVolumeToggle(configIndex, typeLabel, e.target.checked)}
              />
              <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
            </label>
            <span className="text-white font-medium">Apply discount for larger orders</span>
          </div>
        </div>

        {config.isVolumeDiscount && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 transition-all duration-300">
            <div>
              <label className="text-sm text-white/60 block mb-2">Apply discount after how many barrels?</label>
              <select
                value={config.discountAfter}
                onChange={(e) => handleVolumeChange(configIndex, typeLabel, 'discountAfter', e.target.value)}
                className="w-full bg-white/5 border border-white/20 text-white rounded-lg px-4 h-[45px] focus:border-yellow-400 focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <option key={n} value={n} className="text-black">After {n} barrels</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60 block mb-2">Discount per barrel (%)</label>
              <select
                value={config.discountPercent}
                onChange={(e) => handleVolumeChange(configIndex, typeLabel, 'discountPercent', e.target.value)}
                className="w-full bg-white/5 border border-white/20 text-white rounded-lg px-4 h-[45px] focus:border-yellow-400 focus:outline-none"
              >
                {[10, 20, 30, 40, 50].map(p => (
                  <option key={p} value={p} className="text-black">{p}% off</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {config.basePrice && (
          <div className="space-y-3">
            <span className="text-sm text-white/60">Price preview per barrel</span>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 10 }, (_, i) => {
                const qty = i + 1;
                const bPrice = parseFloat(config.basePrice) || 0;
                const hasDiscount = config.isVolumeDiscount && qty > config.discountAfter;
                const discount = hasDiscount ? config.discountPercent : 0;
                const price = (bPrice * (1 - discount / 100)).toFixed(2);
                return (
                  <div
                    key={i}
                    className={`flex-1 min-w-[70px] p-2 rounded-lg border text-center transition-all ${hasDiscount
                      ? 'bg-yellow-400/10 border-yellow-400/50'
                      : 'bg-white/5 border-white/10'
                      }`}
                  >
                    <div className="text-[10px] text-white/40 uppercase mb-1">{qty} bbl</div>
                    <div className="text-sm font-bold text-white">${price}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBarrelForm = (type, configs, handleChange, title, isOwnBarrel) => {
    if (!selectedSubTypes.includes(type)) return null;
    if (configs.length === 0) return null;

    const originCities = ["Fort Lauderdale, FL", "Miami, FL", "Pittsburgh, PA", "Orlando, FL"];
    const destCities = ["Kingston, Jamaica"];

    const transitTimeNumbers = isOwnBarrel ? TRANSIT_TIME_NUMBERS_OWN_BARREL : TRANSIT_TIME_NUMBERS;

    return (
      <div className="mt-8 space-y-8 text-left">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-yellow-400">{title}</h3>
          <button
            type="button"
            onClick={isOwnBarrel ? addOwnBarrelConfig : addDropOffBarrelConfig}
            className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-2 rounded-full font-bold text-sm hover:bg-yellow-500 transition-all"
          >
            <FaPlus size={12} /> Add More
          </button>
        </div>

        {configs.map((data, index) => (
          <div key={index} className="p-6 border border-yellow-400/30 rounded-lg bg-white/5 relative">
            {configs.length > 1 && (
              <button
                type="button"
                onClick={() => isOwnBarrel ? removeOwnBarrelConfig(index) : removeDropOffBarrelConfig(index)}
                className="absolute top-4 right-4 text-red-400 hover:text-red-300 transition-colors"
              >
                <FaTrash size={20} />
              </button>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm mb-2 text-white/80 block">Origin city</label>
                <select name="originCountry" value={data.originCountry} onChange={(e) => handleChange(index, e)} className="w-full border border-white/20 text-white rounded-md px-4 py-2.5 bg-transparent focus:outline-none focus:border-yellow-400">
                  <option value="" disabled hidden>Select origin city</option>
                  {originCities.map(city => (
                    <option key={city} value={city} className="text-black">
                      {city}
                    </option>
                  ))}
                </select>
                {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_originCountry`] && (
                  <p className="text-red-400 text-xs mt-1">{errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_originCountry`]}</p>
                )}
              </div>
              <div>
                <label className="text-sm mb-2 text-white/80 block">Destination city</label>
                <select name="destinationCountry" value={data.destinationCountry} onChange={(e) => handleChange(index, e)} className="w-full border border-white/20 text-white rounded-md px-4 py-2.5 bg-transparent focus:outline-none focus:border-yellow-400">
                  <option value="" disabled hidden>Select destination city</option>
                  {destCities.map(city => <option key={city} value={city} className="text-black">{city}</option>)}
                </select>
                {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_destinationCountry`] && (
                  <p className="text-red-400 text-xs mt-1">{errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_destinationCountry`]}</p>
                )}
              </div>
              <div>
                <label className="text-sm mb-2 text-white/80 block">Base Price ($)</label>
                <input name="basePrice" value={data.basePrice} onChange={(e) => handleChange(index, e)} placeholder="Enter" className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400" type="text" />
                {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_basePrice`] && (
                  <p className="text-red-400 text-xs mt-1">{errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_basePrice`]}</p>
                )}
              </div>

              {!isOwnBarrel && (
                <div>
                  <label className="text-sm mb-2 text-white/80 block">Delivery ($)</label>
                  <input name="pricePerMile" value={data.pricePerMile} onChange={(e) => handleChange(index, e)} placeholder="Enter" className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400" type="text" />
                  {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pricePerMile`] && (
                    <p className="text-red-400 text-xs mt-1">{errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pricePerMile`]}</p>
                  )}
                </div>
              )}

              {renderMultiFieldAccordion({
                isOpen: customsOpen[`${isOwnBarrel ? 'own' : 'do'}_${index}`],
                onToggle: () => toggleCustoms(`${isOwnBarrel ? 'own' : 'do'}_${index}`),
                value: data.customsAndHandling,
                onChange: handleMultiFieldChange,
                label: "Customs & Handling ($)",
                fieldName: "customsAndHandling",
                configIndex: index,
                isOwn: isOwnBarrel,
                error: errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_customsAndHandling`]
              })}

              {isOwnBarrel && (
                <>
                  {renderMultiFieldAccordion({
                    isOpen: flatPickupOpen[`own_${index}`],
                    onToggle: () => toggleFlatPickup(`own_${index}`),
                    value: data.flatPickupCharge,
                    onChange: handleMultiFieldChange,
                    label: "Flat Pickup Charge ($)",
                    fieldName: "flatPickupCharge",
                    configIndex: index,
                    isOwn: true,
                    error: errors[`ownBarrel_${index}_flatPickupCharge`]
                  })}

                  <div>
                    <label className="text-sm mb-2 text-white/80 block">Pickup Free Miles</label>
                    <input
                      name="pickupFreeMiles"
                      value={data.pickupFreeMiles}
                      onChange={(e) => handleChange(index, e)}
                      placeholder="Enter pickup free miles"
                      className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400"
                      type="text"
                    />
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pickupFreeMiles`] && (
                      <p className="text-red-400 text-xs mt-1">{errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pickupFreeMiles`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm mb-2 text-white/80 block">Pickup Per Mile Charge ($)</label>
                    <input
                      name="pickupPerMileCharge"
                      value={data.pickupPerMileCharge}
                      onChange={(e) => handleChange(index, e)}
                      placeholder="Enter pickup per mile charge"
                      className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400"
                      type="text"
                    />
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pickupPerMileCharge`] && (
                      <p className="text-red-400 text-xs mt-1">{errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_pickupPerMileCharge`]}</p>
                    )}
                  </div>

                  {renderMultiFieldAccordion({
                    isOpen: flatDeliveryOpen[`own_${index}`],
                    onToggle: () => toggleFlatDelivery(`own_${index}`),
                    value: data.flatDeliveryCharge,
                    onChange: handleMultiFieldChange,
                    label: "Flat Delivery Charge ($)",
                    fieldName: "flatDeliveryCharge",
                    configIndex: index,
                    isOwn: true,
                    error: errors[`ownBarrel_${index}_flatDeliveryCharge`]
                  })}

                  <div>
                    <label className="text-sm mb-2 text-white/80 block">Delivery Free Miles</label>
                    <input
                      name="deliveryFreeMiles"
                      value={data.deliveryFreeMiles}
                      onChange={(e) => handleChange(index, e)}
                      placeholder="Enter delivery free miles"
                      className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400"
                      type="text"
                    />
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_deliveryFreeMiles`] && (
                      <p className="text-red-400 text-xs mt-1">{errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_deliveryFreeMiles`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm mb-2 text-white/80 block">Delivery Per Mile Charge ($)</label>
                    <input
                      name="deliveryPerMileCharge"
                      value={data.deliveryPerMileCharge}
                      onChange={(e) => handleChange(index, e)}
                      placeholder="Enter delivery per mile charge"
                      className="w-full bg-transparent border border-white/20 text-white placeholder:text-white/40 rounded-md px-4 py-2.5 focus:outline-none focus:border-yellow-400"
                      type="text"
                    />
                    {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_deliveryPerMileCharge`] && (
                      <p className="text-red-400 text-xs mt-1">{errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_deliveryPerMileCharge`]}</p>
                    )}
                  </div>
                </>
              )}

              {renderBarrelPrices(
                isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel',
                data,
                index
              )}
              <div>
                <label className="text-sm mb-2 text-white/80 block">Transit Time</label>
                <div className="flex gap-2">
                  <select
                    value={data.transitTime ? data.transitTime.split(" ")[0] : ""}
                    onChange={(e) => {
                      const unit = data.transitTime ? (data.transitTime.split(" ")[1] || "days") : "days";
                      handleChange(index, { target: { name: "transitTime", value: `${e.target.value} ${unit}` } });
                    }}
                    className="w-1/2 bg-transparent border border-white/20 text-white rounded-md px-4 h-[45px] focus:outline-none focus:border-yellow-400"
                  >
                    <option value="" disabled hidden>Select</option>
                    {transitTimeNumbers.map(n => <option key={n} value={n} className="text-black">{n}</option>)}
                  </select>
                  <select
                    value={data.transitTime ? (data.transitTime.split(" ")[1] || "days") : "days"}
                    onChange={(e) => {
                      const num = data.transitTime ? (data.transitTime.split(" ")[0] || "") : "";
                      handleChange(index, { target: { name: "transitTime", value: `${num} ${e.target.value}` } });
                    }}
                    className="w-1/2 bg-transparent border border-white/20 text-white rounded-md px-4 h-[45px] focus:outline-none focus:border-yellow-400"
                  >
                    {TRANSIT_TIME_UNITS.map(u => <option key={u} value={u} className="text-black">{u}</option>)}
                  </select>
                </div>
                {errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_transitTime`] && (
                  <p className="text-red-400 text-xs mt-1">{errors[`${isOwnBarrel ? 'ownBarrel' : 'dropOffBarrel'}_${index}_transitTime`]}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Handle submit triggered");

    const newErrors = {};

    if (formData.shipmentType !== 'barrel') {
      Object.keys(formData).forEach(key => {
        if (['originLat', 'originLong', 'destinationLat', 'destinationLong'].includes(key)) return;
        if (['basePrice', 'pricePerMile', 'originCountry', 'destinationCountry', 'transitTime', 'shipmentContents'].includes(key)) return;
        const error = validateField(key, formData[key]);
        if (error) newErrors[key] = error;
      });
    } else {
      const error = validateField('shipmentType', formData.shipmentType);
      if (error) newErrors.shipmentType = error;
    }

    const subTypeError = validateField("sub_shipment_type", selectedSubTypes);
    if (subTypeError) newErrors.sub_shipment_type = subTypeError;

    if (formData.shipmentType === 'barrel') {
      if (selectedSubTypes.includes("Ship Your Own Barrel")) {
        ownBarrelConfigs.forEach((config, index) => {
          Object.keys(config).forEach(key => {
            if (['originLat', 'originLong', 'destinationLat', 'destinationLong', 'barrelPrices', 'freeMiles'].includes(key)) return;
            if (key === 'barrelPrices') return;
            const error = validateField(key, config[key], `ownBarrel_${index}`);
            if (error) newErrors[`ownBarrel_${index}_${key}`] = error;
          });
        });
      }
      if (selectedSubTypes.includes("Request Barrel Drop-Off")) {
        dropOffBarrelConfigs.forEach((config, index) => {
          Object.keys(config).forEach(key => {
            const skipFields = ['flatPickupCharge', 'pickupFreeMiles', 'pickupPerMileCharge', 'flatDeliveryCharge', 'deliveryFreeMiles', 'deliveryPerMileCharge'];
            if (skipFields.includes(key)) return;
            if (['originLat', 'originLong', 'destinationLat', 'destinationLong', 'barrelPrices', 'freeMiles'].includes(key)) return;
            if (key === 'barrelPrices') return;
            const error = validateField(key, config[key], `dropOffBarrel_${index}`);
            if (error) newErrors[`dropOffBarrel_${index}_${key}`] = error;
          });
        });
      }
    }

    if (Object.values(newErrors).some(err => err)) {
      setErrors(newErrors);
      console.log("Validation errors:", newErrors);
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      const firstOwn = ownBarrelConfigs[0];
      const firstDropOff = dropOffBarrelConfigs[0];
      const barrelDetails = formData.shipmentType === 'barrel'
        ? (selectedSubTypes.includes("Ship Your Own Barrel") ? firstOwn : (selectedSubTypes.includes("Request Barrel Drop-Off") ? firstDropOff : null))
        : null;

      const payload = {
        ...formData,
        providerId: user.id,
        isFinalStep: "true",
        sub_shipment_type: selectedSubTypes,
        basePrice: barrelDetails?.basePrice || formData.basePrice || "0",
        pricePerPound: barrelDetails?.pricePerPound || formData.pricePerPound || "0",
        transitTime: barrelDetails?.transitTime || formData.transitTime || "",
        shipmentContents: barrelDetails?.shipmentContents || formData.shipmentContents || "",
        originCountry: barrelDetails?.originCountry || formData.originCountry || "",
        destinationCountry: barrelDetails?.destinationCountry || formData.destinationCountry || "",
        originLat: barrelDetails?.originLat || (barrelDetails?.originCountry ? CITY_COORDINATES[barrelDetails.originCountry]?.lat : "") || formData.originLat || "",
        originLong: barrelDetails?.originLong || (barrelDetails?.originCountry ? CITY_COORDINATES[barrelDetails.originCountry]?.lng : "") || formData.originLong || "",
        destinationLat: barrelDetails?.destinationLat || (barrelDetails?.destinationCountry ? CITY_COORDINATES[barrelDetails.destinationCountry]?.lat : "") || formData.destinationLat || "",
        destinationLong: barrelDetails?.destinationLong || (barrelDetails?.destinationCountry ? CITY_COORDINATES[barrelDetails.destinationCountry]?.lng : "") || formData.destinationLong || "",
        pricePerMile: barrelDetails?.pricePerMile || formData.pricePerMile || "0",
        customsAndHandling: barrelDetails?.customsAndHandling || formData.customsAndHandling || "0",
        freeMiles: barrelDetails?.freeMiles || formData.freeMiles || "0",
        flatPickupCharge: barrelDetails?.flatPickupCharge || "0",
        pickupFreeMiles: barrelDetails?.pickupFreeMiles || "0",
        pickupPerMileCharge: barrelDetails?.pickupPerMileCharge || "0",
        flatDeliveryCharge: barrelDetails?.flatDeliveryCharge || "0",
        deliveryFreeMiles: barrelDetails?.deliveryFreeMiles || "0",
        deliveryPerMileCharge: barrelDetails?.deliveryPerMileCharge || "0",
        barrelOptions: formData.shipmentType === 'barrel' ? {
          ownBarrel: selectedSubTypes.includes("Ship Your Own Barrel")
            ? ownBarrelConfigs.map(config => ({
              basePrice: config.basePrice || "0",
              pricePerMile: config.pricePerMile || "0",
              customsAndHandling: config.customsAndHandling || "0",
              freeMiles: config.freeMiles || "0",
              originCountry: config.originCountry || "",
              destinationCountry: config.destinationCountry || "",
              originLat: config.originLat || (CITY_COORDINATES[config.originCountry]?.lat || ""),
              originLong: config.originLong || (CITY_COORDINATES[config.originCountry]?.lng || ""),
              destinationLat: config.destinationLat || (CITY_COORDINATES[config.destinationCountry]?.lat || ""),
              destinationLong: config.destinationLong || (CITY_COORDINATES[config.destinationCountry]?.lng || ""),
              transitTime: config.transitTime || "",
              shipmentContents: config.shipmentContents || "",
              isVolumeDiscount: Boolean(config.isVolumeDiscount),
              discountAfter: Number(config.discountAfter || 0),
              discountPercent: Number(config.discountPercent || 0),
              barrelPrices: [{ quantity: 1, price: config.basePrice || "0", discount: "0" }],
              flatPickupCharge: config.flatPickupCharge || "0",
              pickupFreeMiles: config.pickupFreeMiles || "0",
              pickupPerMileCharge: config.pickupPerMileCharge || "0",
              flatDeliveryCharge: config.flatDeliveryCharge || "0",
              deliveryFreeMiles: config.deliveryFreeMiles || "0",
              deliveryPerMileCharge: config.deliveryPerMileCharge || "0"
            }))
            : null,
          dropOffBarrel: selectedSubTypes.includes("Request Barrel Drop-Off")
            ? dropOffBarrelConfigs.map(config => ({
              basePrice: config.basePrice || "0",
              pricePerMile: config.pricePerMile || "0",
              customsAndHandling: config.customsAndHandling || "0",
              freeMiles: config.freeMiles || "0",
              originCountry: config.originCountry || "",
              destinationCountry: config.destinationCountry || "",
              originLat: config.originLat || (CITY_COORDINATES[config.originCountry]?.lat || ""),
              originLong: config.originLong || (CITY_COORDINATES[config.originCountry]?.lng || ""),
              destinationLat: config.destinationLat || (CITY_COORDINATES[config.destinationCountry]?.lat || ""),
              destinationLong: config.destinationLong || (CITY_COORDINATES[config.destinationCountry]?.lng || ""),
              transitTime: config.transitTime || "",
              shipmentContents: config.shipmentContents || "",
              isVolumeDiscount: Boolean(config.isVolumeDiscount),
              discountAfter: Number(config.discountAfter || 0),
              discountPercent: Number(config.discountPercent || 0),
              barrelPrices: [{ quantity: 1, price: config.basePrice || "0", discount: "0" }],
              flatPickupCharge: "0",
              pickupFreeMiles: "0",
              pickupPerMileCharge: "0",
              flatDeliveryCharge: "0",
              deliveryFreeMiles: "0",
              deliveryPerMileCharge: "0"
            }))
            : null,
        } : null
      };

      const response = await completeProfile(payload);
      if (response.success) {
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const updatedUser = { ...currentUser, ...response.body, isProfileComplete: 1 };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        toast.success("Profile updated successfully!");
        navigate("/request");
      } else {
        toast.error(response.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Profile finish update error:", error);
      toast.error(error.response?.data?.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Commonbanner title="Edit Profile" />

      <div className='bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] py-10'>
        <div className='container mx-auto flex flex-col lg:flex-row justify-center items-start pb-[20px] gap-5'>
          <div className='w-full lg:w-[30%]'><ProfileMain show={false} /></div>

          <div className='w-full shadow-sm bg-[#2D413F] rounded-[18px] lg:w-[70%] p-6 lg:p-10'>
            <div className="w-full max-w-[480px] mb-10 mx-auto">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6].map((step) => (
                  <div
                    key={step}
                    className={`h-[4px] w-full rounded-full transition-all duration-300 ${step <= 6 ? "bg-yellow-400" : "bg-white/30"}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start gap-10">
              <form onSubmit={handleSubmit} className="w-full sm:w-[60%] flex flex-col gap-5 text-white text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Shipment Type</label>
                    <select name="shipmentType" value={formData.shipmentType} onChange={handleInputChange} className="w-full bg-[#2D413F] border border-white/20 rounded-lg px-3 py-2 focus:border-yellow-400 outline-none">
                      <option value="" disabled hidden>Select</option>
                      <option className="text-black" value="barrel">Barrel</option>
                    </select>
                    {errors.shipmentType && (
                      <p className="text-red-400 text-xs mt-1">{errors.shipmentType}</p>
                    )}
                  </div>
                </div>

                {getSubOptions().length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-3 block">Sub-shipment Type (Select multiple)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {getSubOptions().map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => toggleSubType(opt.id)}
                          className={`
                            border border-white/20 rounded-lg px-4 py-2 cursor-pointer transition-all
                            flex items-center gap-3
                            ${selectedSubTypes.includes(opt.id) ? 'bg-yellow-400/10 border-yellow-400' : 'hover:border-white/40'}
                          `}
                        >
                          <div className={`
                            w-4 h-4 rounded border flex items-center justify-center transition-all
                            ${selectedSubTypes.includes(opt.id) ? 'bg-yellow-400 border-yellow-400' : 'border-white/30'}
                          `}>
                            {selectedSubTypes.includes(opt.id) && <span className="text-black text-[10px] font-bold">✓</span>}
                          </div>
                          <span className={`${selectedSubTypes.includes(opt.id) ? 'text-yellow-400' : 'text-white/70'} text-sm`}>
                            {opt.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    {errors.sub_shipment_type && (
                      <p className="text-red-400 text-xs mt-1">{errors.sub_shipment_type}</p>
                    )}
                  </div>
                )}

                {formData.shipmentType === 'barrel' && (
                  <>
                    {renderBarrelForm("Ship Your Own Barrel", ownBarrelConfigs, handleOwnBarrelChange, "Ship Your Own Barrel Details", true)}
                    {renderBarrelForm("Request Barrel Drop-Off", dropOffBarrelConfigs, handleDropOffBarrelChange, "Request Barrel Drop-Off Details", false)}
                  </>
                )}

                <button
                  disabled={isLoading}
                  type="submit"
                  className="bg-[linear-gradient(180deg,#FFBF00_0%,#FFD864_100%)] text-black font-bold py-3 rounded-full mt-4 flex items-center justify-center gap-2 hover:scale-105 transition-all disabled:opacity-50"
                >
                  {isLoading ? <FaSpinner className="animate-spin" /> : "Finish"}
                </button>
              </form>

              <div className="hidden sm:flex w-[40%] items-center justify-center">
                <img src={man} alt="Business" className="w-full object-contain" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <SuccessPopup
        isOpen={isSuccessModalOpen}
        onClose={() => {
          setIsSuccessModalOpen(false);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/");
        }}
        title="Pending Verification"
        message="Congratulations, your profile is complete. Your account is now pending admin verification. You will be able to login once your documents are verified."
        buttonText="Logout"
      />
    </>
  );
};

export default BusinessUploadNext;