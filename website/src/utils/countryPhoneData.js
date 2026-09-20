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
 * Per-country phone rules — mirrored in server/helper/phone.js; keep both in
 * step. Numbers are stored as (dial code, local digits): Jamaica keeps the 7
 * local digits behind +1876 and US/Canada 10 behind +1; other countries 8–15.
 * A customer who types the dial prefix again ("876 555 1234" with +1876
 * selected) is normalised rather than rejected.
 */
export const PHONE_RULES = {
    '+1876': { local: 7, strip: ['1876', '876'], hint: 'Enter the 7-digit number after +1876', example: '555 1234' },
    '+1': { local: 10, strip: ['1'], hint: 'Enter the 10-digit number after +1', example: '412 555 0123' },
};

const digitsOnly = (v) => String(v || '').replace(/\D/g, '');

export const normalizePhoneForCountry = (dialCode, phone) => {
    const d = digitsOnly(phone);
    const rule = PHONE_RULES[String(dialCode || '').trim()];
    if (!rule) return d;
    for (const p of rule.strip) {
        if (d.length === rule.local + p.length && d.startsWith(p)) return d.slice(p.length);
    }
    return d;
};

export const phonePlaceholderForCountry = (dialCode) =>
    PHONE_RULES[String(dialCode || '').trim()]?.example || 'Enter phone number';

export const validatePhoneForCountry = (dialCode, phone) => {
    const d = normalizePhoneForCountry(dialCode, phone);
    if (!d) return "Phone number is required";
    const rule = PHONE_RULES[String(dialCode || '').trim()];
    if (rule) return d.length === rule.local ? "" : rule.hint;
    if (d.length < 8 || d.length > 15) return "Phone number must be 8-15 digits";
    return "";
};
