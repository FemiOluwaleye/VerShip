import countries from 'world-countries';

/**
 * Country list optimized for phone selection
 */
export const COUNTRY_LIST = countries
    .map(c => ({
        name: c.name.common,
        code: c.cca2,
        flag: c.flag,
        dialCode: c.idd.root + (c.idd.suffixes && c.idd.suffixes.length === 1 ? c.idd.suffixes[0] : ''),
    }))
    .filter(c => c.dialCode) // Only countries with a dial code
    .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Simple validation rules for all countries
 */
export const validatePhoneForCountry = (dialCode, phone) => {
    if (!phone) return "Phone number is required";

    const cleanPhone = phone.replace(/\D/g, '');

    // Uniform validation for all countries
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
        return "Phone number must be 8-15 digits";
    }

    return "";
};