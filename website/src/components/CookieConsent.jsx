import { Cookie, Check } from "lucide-react";
import { getCookiesListing, saveUserCookies } from "../api/cms";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
const CookieConsent = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [cookiesListing, setCookiesListing] = useState([]);
    const [selectedCookies, setSelectedCookies] = useState([]);
    const [userId, setUserId] = useState(null);
    const [showOptions, setShowOptions] = useState(true);

    useEffect(() => {
        const consent = localStorage.getItem("cookieConsentAccepted");
        if (!consent) {
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        if (isVisible) {
            const fetchCookies = async () => {
                try {
                    const response = await getCookiesListing();
                    console.log("response-=======123==s>>>>", response.body);
                    if (response.status === 200 || response.status === "1") {
                        setCookiesListing(response.body);
                        // Default select all
                        setSelectedCookies(response.body.map(c => c.id));
                    }
                } catch (error) {
                    console.error("Failed to fetch cookies:", error);
                }
            };
            fetchCookies();

            const userStr = localStorage.getItem("user");
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    setUserId(user.id);
                } catch (e) { }
            }
        }
    }, [isVisible]);

    const handleAccept = async () => {
        if (selectedCookies.length === 0) {
            toast.error("Please select at least one cookies option.");
            return;
        }

        // Store in localStorage regardless of login status
        localStorage.setItem("selectedCookies", JSON.stringify(selectedCookies));
        localStorage.setItem("cookieConsentAccepted", "true");

        if (userId && selectedCookies.length > 0) {
            try {
                await saveUserCookies({ userId, cookieIds: selectedCookies });
            } catch (error) {
                console.error("Failed to save cookie consent:", error);
            }
        }
        setIsVisible(false);
    };

    const handleDecline = () => {
        localStorage.setItem("cookieConsentAccepted", "false");
        setIsVisible(false);
    };

    const toggleCookie = (id) => {
        setSelectedCookies(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-[800px] animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="bg-[#1A2E24]/95 backdrop-blur-xl border border-[#2D4D3D] rounded-3xl p-6 lg:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 lg:gap-10">
                    <div className="bg-[#FCC604]/10 p-5 rounded-2xl hidden md:block">
                        <Cookie className="w-10 h-10 text-[#FCC604]" />
                    </div>

                    <div className="flex-1">
                        <h3 className="text-white font-bold text-xl mb-2">Cookie Privacy</h3>
                        {/* <p className="text-white/80 text-[15px] leading-relaxed">
                            We use cookies to improve your experience. You can choose which cookies to accept.
                            Learn more in our{" "}
                            <Link to="/cookie-policy" className="text-[#FCC604] hover:text-[#eab308] underline font-semibold transition-colors">
                                Cookie Policy
                            </Link>
                            .
                        </p> */}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={handleAccept}
                            className="w-full sm:w-auto px-10 py-3 rounded-xl bg-[#FCC604] hover:bg-[#eab308] text-black font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-[#FCC604]/20"
                        >
                            Accept
                        </button>
                    </div>
                </div>

                {cookiesListing.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {cookiesListing.map((cookie) => (
                            <div
                                key={cookie.id}
                                onClick={() => toggleCookie(cookie.id)}
                                className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${selectedCookies.includes(cookie.id)
                                    ? 'bg-[#FCC604]/10 border-[#FCC604]/30'
                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                                    }`}
                            >
                                <div className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${selectedCookies.includes(cookie.id)
                                    ? 'bg-[#FCC604] border-[#FCC604]'
                                    : 'border-white/30'
                                    }`}>
                                    {selectedCookies.includes(cookie.id) && <Check className="w-4 h-4 text-black" strokeWidth={3} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-white font-semibold text-sm">{cookie.name}</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 uppercase tracking-wider">
                                            {cookie.type}
                                        </span>
                                    </div>
                                    <p className="text-white/50 text-xs leading-snug break-words">
                                        {cookie.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CookieConsent;
