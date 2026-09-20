/*
 * Phone rules shared with website/src/utils/countryPhoneData.js — keep both in
 * step. Numbers are stored as (countryCode, local digits): Jamaica keeps 7 local
 * digits behind +1876, NANP countries 10 behind +1, everything else 8–15.
 */
const RULES = {
    '+1876': { local: 7, strip: ['1876', '876'], hint: 'Enter the 7-digit number after +1876' },
    '+1': { local: 10, strip: ['1'], hint: 'Enter the 10-digit number after +1' },
};

const digits = (v) => String(v || '').replace(/\D/g, '');

/** Strip a re-typed dial prefix so "8765551234" with +1876 becomes "5551234". */
function normalizePhoneForCountry(dialCode, phone) {
    let d = digits(phone);
    const rule = RULES[String(dialCode || '').trim()];
    if (!rule) return d;
    for (const p of rule.strip) {
        if (d.length === rule.local + p.length && d.startsWith(p)) return d.slice(p.length);
    }
    return d;
}

function validatePhoneForCountry(dialCode, phone) {
    const d = normalizePhoneForCountry(dialCode, phone);
    if (!d) return 'Phone number is required';
    const rule = RULES[String(dialCode || '').trim()];
    if (rule) return d.length === rule.local ? '' : rule.hint;
    if (d.length < 8 || d.length > 15) return 'Phone number must be 8-15 digits';
    return '';
}

module.exports = { RULES, normalizePhoneForCountry, validatePhoneForCountry };
