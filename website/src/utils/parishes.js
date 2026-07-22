// Jamaica's 14 parishes — the unit for the simplified "Customs & Delivery"
// pricing (one combined fee per parish). Order: Kingston first, then roughly
// east-to-west around the island.
export const JAMAICA_PARISHES = [
    'Kingston',
    'St. Andrew',
    'St. Thomas',
    'Portland',
    'St. Mary',
    'St. Ann',
    'Trelawny',
    'St. James',
    'Hanover',
    'Westmoreland',
    'St. Elizabeth',
    'Manchester',
    'Clarendon',
    'St. Catherine',
];

// Best-effort parish detection from a free-form Jamaican address string.
// Returns the parish name or '' when none matches.
export const detectParish = (address) => {
    if (!address) return '';
    const a = String(address).toLowerCase();
    // Longest names first so "St. Andrew" wins over "St. Ann" prefix overlaps.
    const sorted = [...JAMAICA_PARISHES].sort((x, y) => y.length - x.length);
    for (const p of sorted) {
        const plain = p.toLowerCase();
        const noDot = plain.replace('st. ', 'st ');
        const saint = plain.replace('st. ', 'saint ');
        if (a.includes(plain) || a.includes(noDot) || a.includes(saint)) return p;
    }
    return '';
};
