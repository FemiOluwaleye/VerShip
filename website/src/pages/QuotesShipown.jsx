import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Package, ArrowRight, Info } from "lucide-react";
import { toast } from "sonner";
import Commonbanner from "../components/Commonbanner";
import { getAvailableQuotes, getGuestQuotes } from "../api/cms";
import { selectRateCard, isPricingV2 } from "../utils/pricing";

/*
 * Quotes page: pick a forwarder, continue to checkout. The recipient /
 * shipper / payment forms that used to live under the quote list moved to
 * /checkout (one screen, payment inline). Guests get quotes too — the landing
 * form parks its payload in localStorage under guest_booking_payload and this
 * page prices it without persisting anything until they pay.
 *
 * Also serves /quotes (barrel drop-off requests) and
 * /quotes-shipown-history/:id (re-quote a past request); the previous
 * per-flow pages are kept as *.legacy.jsx until the new flow has shipped.
 */

const money = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

const QuotesShipown = () => {
    const navigate = useNavigate();
    // /quotes-shipown-history/:id re-quotes a past request (server copies it).
    const { id: requoteId } = useParams();
    const [isLoading, setIsLoading] = useState(true);
    const [providers, setProviders] = useState([]);
    const [bookingRequest, setBookingRequest] = useState(null);
    const [userSurvey, setUserSurvey] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [guest, setGuest] = useState(false);
    const [guestPayload, setGuestPayload] = useState(null);

    useEffect(() => {
        const load = async () => {
            const loggedIn = !!localStorage.getItem("token");
            let payload = null;
            try { payload = JSON.parse(localStorage.getItem("guest_booking_payload") || "null"); } catch { payload = null; }
            try {
                let response;
                if (!loggedIn) {
                    if (!payload) { toast.info("Tell us about your shipment first."); navigate("/"); return; }
                    response = await getGuestQuotes(payload);
                    setGuest(true);
                    setGuestPayload(payload);
                } else {
                    response = await getAvailableQuotes(requoteId);
                }
                if (response.success || response.status) {
                    setBookingRequest(response.body.bookingRequest);
                    setProviders(response.body.providers || []);
                    setUserSurvey(response.body.userSurvey || "");
                    const best = (response.body.providers || []).find((p) => p.isBestQuote);
                    if (best) setSelectedId(best.provider.id);
                    if ((response.body.providers || []).length === 0) {
                        toast.error("No forwarders match this shipment yet.", { id: "no-providers" });
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
        load();
    }, [navigate, requoteId]);

    const shipmentType = (() => {
        const sub = ((bookingRequest?.items?.[0]?.sub_type) || bookingRequest?.sub_type || "").toLowerCase();
        return sub.includes("drop-off") || sub.includes("dropoff") ? "dropoff" : "own";
    })();

    const priceFor = (pd) => {
        const card = selectRateCard(pd.barrelPrices, { type: shipmentType, origin: bookingRequest?.origin, destination: bookingRequest?.destination });
        return card ? (isPricingV2(card) ? card.seaFreightPrice : card.basePrice) : 0;
    };

    const goToCheckout = (id) => {
        const pid = id || selectedId;
        const pd = providers.find((p) => p.provider.id === pid);
        if (!pd) { toast.error("Please select a quote first."); return; }
        navigate("/checkout", {
            state: {
                providerId: pid,
                providerDetail: { id: pd.id, businessName: pd.businessName, averageRating: pd.averageRating, totalCompletedBookings: pd.totalCompletedBookings, deliveryTimeline: pd.deliveryTimeline, transitTime: pd.transitTime },
                bookingRequest: guest ? null : bookingRequest,
                guest,
                guestPayload: guest ? guestPayload : null,
            },
        });
    };

    const surveyLabel = (() => {
        const ids = userSurvey.split(",").map((s) => s.trim()).filter(Boolean);
        if (ids.length === 0) return "💰 Sorted by: Lowest Price";
        const labels = ids.map((id) => (id === "1" ? "⚡ Fast Delivery" : id === "2" ? "🛡️ Safety & Reliability" : id === "3" ? "💰 Lowest Price" : id));
        return `🎯 Priorities: ${labels.join(" + ")}`;
    })();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0a1612] flex items-center justify-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400" />
            </div>
        );
    }

    const bestQuotes = providers.filter((p) => p.isBestQuote);
    const others = providers.filter((p) => !p.isBestQuote);
    const quantity = parseInt(bookingRequest?.quantity || bookingRequest?.items?.[0]?.quantity || 1, 10) || 1;

    const Card = ({ pd, idx, isBest }) => {
        const active = selectedId === pd.provider.id;
        const perBarrel = parseFloat(priceFor(pd)) || 0;
        return (
            <div
                onClick={() => setSelectedId(pd.provider.id)}
                data-testid={`quote-card-${pd.provider.id}`}
                className={`cursor-pointer relative w-full rounded-xl p-4 sm:p-5 sm:px-8 mb-4 transition-all duration-300 ${
                    active ? "bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] border border-white shadow-lg" : "bg-[#2D413F] border border-transparent"}`}
            >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8 w-full">
                        <div className="bg-[#FFC929] text-black font-bold px-5 sm:px-6 py-1.5 sm:py-2 rounded-md text-sm h-fit whitespace-nowrap">
                            {money(perBarrel)} <span className="font-medium text-black/60">/ barrel</span>
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-white text-[18px] sm:text-[20px] lg:text-[22px] font-bold">{isBest ? "Best Quote" : `Quote ${idx}`}</h3>
                            <p className="text-white/60 text-sm">
                                Sea freight for {quantity} barrel{quantity === 1 ? "" : "s"} from {money(perBarrel * quantity)}
                                {pd.transitTime ? ` · ~${pd.transitTime} transit` : ""}
                                {pd.averageRating > 0 ? ` · ★ ${Number(pd.averageRating).toFixed(1)}` : ""}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                        {active && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); goToCheckout(pd.provider.id); }}
                                data-testid="continue-checkout"
                                className="text-sm font-semibold px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F] text-black hover:brightness-110 transition flex items-center gap-2"
                            >
                                Continue to checkout <ArrowRight size={16} />
                            </button>
                        )}
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${active ? "bg-[#FFD233] border-[#FFD233]" : "border-white/30"}`}>
                            {active && <span className="text-black font-bold text-sm">✓</span>}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#243d34] to-[#0a1612]">
            <Commonbanner title="Best Quotes" />
            <div className="container mx-auto px-4">
                <div className="py-12">
                    {providers.length === 0 ? (
                        <div className="text-center py-20 text-white/50">
                            <Package size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="text-xl">No shippers match your requirements right now.</p>
                            <p className="text-sm mt-2">Try adjusting your load details or origin/destination.</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 flex flex-wrap items-center gap-3">
                                <span className="inline-block bg-[#1b352b] border border-[#9fe0b8]/30 text-[#9fe0b8] text-xs font-medium px-4 py-2 rounded-full shadow-sm">{surveyLabel}</span>
                                <span className="text-white/50 text-xs flex items-center gap-1"><Info size={13} /> Prices are per barrel sea freight; customs &amp; delivery are shown at checkout and paid on arrival.</span>
                            </div>
                            <div className="mb-8">{bestQuotes.map((p, i) => <Card key={p.id} pd={p} idx={i + 1} isBest />)}</div>
                            {others.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-white text-[22px] font-semibold mb-3">Other Results</h3>
                                    {others.map((p, i) => <Card key={p.id} pd={p} idx={bestQuotes.length + i + 1} isBest={false} />)}
                                </div>
                            )}
                            <div className="flex justify-center mt-6">
                                <button
                                    type="button"
                                    onClick={() => goToCheckout()}
                                    disabled={!selectedId}
                                    data-testid="continue-checkout-bottom"
                                    className={`text-md font-semibold px-14 py-4 rounded-full transition ${!selectedId ? "bg-gray-600 text-gray-400 cursor-not-allowed opacity-50" : "bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F] text-black hover:brightness-110"}`}
                                >
                                    Continue to checkout
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuotesShipown;
