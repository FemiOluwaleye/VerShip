import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Commonbanner from '../components/Commonbanner';
import { getPrepackedBarrel, createPrepackedOrder } from '../api/cms';
import { API_URL } from '../api/axios';

// The 14 parishes of Jamaica — delivery is Jamaica-only for this product.
const JAMAICA_PARISHES = [
    'Kingston', 'St. Andrew', 'St. Thomas', 'Portland', 'St. Mary',
    'St. Ann', 'Trelawny', 'St. James', 'Hanover', 'Westmoreland',
    'St. Elizabeth', 'Manchester', 'Clarendon', 'St. Catherine',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PrepackedBarrel = () => {
    const navigate = useNavigate();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmation, setConfirmation] = useState(null); // { order, accountExists }

    const [form, setForm] = useState({
        quantity: 1,
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        recipient_name: '',
        recipient_phone: '',
        delivery_street: '',
        delivery_town: '',
        delivery_parish: '',
        notes: '',
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await getPrepackedBarrel();
                if (!active) return;
                if (res?.success && res?.body) {
                    setProduct(res.body);
                } else {
                    setLoadError(res?.message || 'No pre-packed barrel is available right now.');
                }
            } catch (err) {
                if (!active) return;
                setLoadError(err?.response?.data?.message || 'Unable to load this product. Please try again.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const unitPrice = parseFloat(product?.price) || 0;
    const currency = product?.currency || 'USD';
    const qty = Math.max(1, parseInt(form.quantity, 10) || 1);
    const total = (unitPrice * qty).toFixed(2);
    const imageSrc = product?.image
        ? (product.image.startsWith('http') ? product.image : `${API_URL}/${product.image}`)
        : null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: '' }));
    };

    const validate = () => {
        const next = {};
        if (!form.firstName.trim()) next.firstName = 'First name is required';
        if (!form.email.trim()) next.email = 'Email is required';
        else if (!EMAIL_RE.test(form.email)) next.email = 'Enter a valid email';
        if (!form.recipient_name.trim()) next.recipient_name = "Recipient's name is required";
        if (!form.recipient_phone.trim()) next.recipient_phone = "Recipient's phone is required";
        if (!form.delivery_street.trim()) next.delivery_street = 'Street address is required';
        if (!form.delivery_town.trim()) next.delivery_town = 'Town / city is required';
        if (!form.delivery_parish.trim()) next.delivery_parish = 'Parish is required';
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) {
            toast.error('Please fill in all required fields.');
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = {
                product_id: product?.id,
                quantity: qty,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                countryCode: '+1',
                recipient_name: form.recipient_name.trim(),
                recipient_phone: form.recipient_phone.trim(),
                recipient_email: form.email.trim(),
                delivery_street: form.delivery_street.trim(),
                delivery_town: form.delivery_town.trim(),
                delivery_parish: form.delivery_parish,
                delivery_country: 'Jamaica',
                notes: form.notes.trim(),
            };

            const res = await createPrepackedOrder(payload);
            if (!res?.success) {
                toast.error(res?.message || 'Could not place your order. Please try again.');
                return;
            }

            const { order, accountExists, authtoken, user } = res.body || {};

            // New email → backend auto-creates a verified account and returns a
            // token. Log the buyer in (mirrors the Login page) so they can track
            // the order. Existing accounts get no token (takeover guard).
            if (authtoken && user) {
                localStorage.setItem('token', authtoken);
                localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('is_login', 1);
                window.dispatchEvent(new Event('userUpdated'));
            }

            toast.success('Order placed successfully!');
            setConfirmation({ order, accountExists: !!accountExists });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not place your order. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /* ---------- states ---------- */
    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFA]">
                <Commonbanner title="VerShip Pre-Packed Food Barrels" />
                <div className="max-w-3xl mx-auto px-4 py-20 text-center text-[#595d5e]">
                    Loading product…
                </div>
            </div>
        );
    }

    if (loadError || !product) {
        return (
            <div className="min-h-screen bg-[#F8FAFA]">
                <Commonbanner title="VerShip Pre-Packed Food Barrels" />
                <div className="max-w-3xl mx-auto px-4 py-20 text-center">
                    <p className="text-[#071618] text-lg font-semibold mb-4">
                        {loadError || 'This product is not available right now.'}
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="bg-[#0D4D4D] text-white px-6 h-[46px] rounded-full font-bold hover:bg-[#0A3D3D] transition-all"
                    >
                        Back to home
                    </button>
                </div>
            </div>
        );
    }

    if (confirmation) {
        const o = confirmation.order || {};
        return (
            <div className="min-h-screen bg-[#F8FAFA]">
                <Commonbanner title="Order Confirmed" />
                <div className="max-w-2xl mx-auto px-4 py-16">
                    <div className="bg-white rounded-[22px] border border-[#C1A35E]/30 p-8 shadow-lg text-center">
                        <div className="text-5xl mb-4" aria-hidden="true">✅</div>
                        <h2 className="text-2xl md:text-3xl font-bold text-[#071618] mb-2">Thank you — your order is in!</h2>
                        <p className="text-[#595d5e] mb-6">
                            We've received your pre-packed barrel order and will be in touch about payment and shipping.
                        </p>
                        <div className="bg-[#F8FAFA] rounded-2xl p-5 text-left mb-6 space-y-2">
                            <div className="flex justify-between"><span className="text-[#595d5e]">Order number</span><span className="font-semibold text-[#071618]">{o.orderId}</span></div>
                            <div className="flex justify-between"><span className="text-[#595d5e]">Quantity</span><span className="font-semibold text-[#071618]">{o.quantity}</span></div>
                            <div className="flex justify-between"><span className="text-[#595d5e]">Total</span><span className="font-semibold text-[#071618]">{currency} {o.total_price}</span></div>
                        </div>
                        {confirmation.accountExists ? (
                            <p className="text-sm text-[#595d5e] mb-6">
                                This email already has a VerShip account. Please{' '}
                                <button onClick={() => navigate('/login')} className="text-[#0D4D4D] font-semibold underline">log in</button>{' '}
                                to track this order.
                            </p>
                        ) : (
                            <p className="text-sm text-[#595d5e] mb-6">
                                We created a VerShip account for you so you can track this order. You're now signed in.
                            </p>
                        )}
                        <button
                            onClick={() => navigate('/')}
                            className="bg-[#C1A35E] text-[#071618] px-8 h-[46px] rounded-full font-bold hover:bg-[#E5C78A] transition-all"
                        >
                            Back to home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ---------- main ---------- */
    const inputClass = (field) =>
        `w-full bg-white border ${errors[field] ? 'border-red-500' : 'border-[#0D4D4D]/20'} rounded-xl px-4 py-3 text-[#071618] focus:outline-none focus:border-[#C1A35E] transition-colors`;

    return (
        <div className="min-h-screen bg-[#F8FAFA]">
            <Commonbanner title="VerShip Pre-Packed Food Barrels" />

            <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* ---------- Product ---------- */}
                <div>
                    <div className="bg-white rounded-[22px] border border-[#0D4D4D]/10 overflow-hidden shadow-sm">
                        {imageSrc ? (
                            <img src={imageSrc} alt={product.name} className="w-full h-64 object-cover" />
                        ) : (
                            <div className="w-full h-64 bg-[#0D4D4D]/5 flex items-center justify-center text-7xl" aria-hidden="true">🛢️</div>
                        )}
                        <div className="p-6 md:p-8">
                            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D4D4D]/80 mb-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C1A35E]" aria-hidden="true" />
                                USA to Jamaica · Door to door
                            </span>
                            <h1 className="text-2xl md:text-3xl font-bold text-[#071618]">{product.name}</h1>
                            {product.tagline && <p className="text-[#595d5e] mt-2">{product.tagline}</p>}

                            <div className="flex items-baseline gap-2 mt-5">
                                <span className="text-3xl font-bold text-[#0D4D4D]">{currency} {unitPrice.toFixed(2)}</span>
                                {product.transitTime && (
                                    <span className="text-sm text-[#595d5e]">· ships in {product.transitTime}</span>
                                )}
                            </div>

                            {product.description && (
                                <p className="text-[#595d5e] leading-relaxed mt-5 whitespace-pre-line">{product.description}</p>
                            )}

                            {Array.isArray(product.contents) && product.contents.length > 0 && (
                                <div className="mt-6">
                                    <h2 className="text-lg font-bold text-[#071618] mb-3">What's in the barrel</h2>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {product.contents.map((item) => (
                                            <li key={item.id} className="flex items-center gap-2 text-[#071618]">
                                                <span aria-hidden="true">{item.icon || '•'}</span>
                                                <span>{item.name}</span>
                                                {item.quantity && <span className="text-[#595d5e] text-sm">× {item.quantity}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ---------- Order form ---------- */}
                <div>
                    <form onSubmit={handleSubmit} className="bg-white rounded-[22px] border border-[#0D4D4D]/10 p-6 md:p-8 shadow-sm">
                        <h2 className="text-xl md:text-2xl font-bold text-[#071618] mb-6">Order this barrel</h2>

                        {/* Quantity */}
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-[#071618] mb-1">Quantity</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    name="quantity"
                                    min={1}
                                    value={form.quantity}
                                    onChange={handleChange}
                                    className="w-24 bg-white border border-[#0D4D4D]/20 rounded-xl px-4 py-3 text-[#071618] focus:outline-none focus:border-[#C1A35E]"
                                />
                                <span className="text-[#595d5e]">
                                    Total: <span className="font-bold text-[#0D4D4D]">{currency} {total}</span>
                                </span>
                            </div>
                        </div>

                        <h3 className="text-sm font-bold uppercase tracking-wide text-[#0D4D4D]/80 mb-3">Your details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-[#071618] mb-1">First name <span className="text-red-500">*</span></label>
                                <input type="text" name="firstName" value={form.firstName} onChange={handleChange} className={inputClass('firstName')} placeholder="First name" />
                                {errors.firstName && <span className="text-red-500 text-xs mt-1 block">{errors.firstName}</span>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#071618] mb-1">Last name</label>
                                <input type="text" name="lastName" value={form.lastName} onChange={handleChange} className={inputClass('lastName')} placeholder="Last name" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-[#071618] mb-1">Email <span className="text-red-500">*</span></label>
                                <input type="email" name="email" value={form.email} onChange={handleChange} className={inputClass('email')} placeholder="you@email.com" />
                                {errors.email && <span className="text-red-500 text-xs mt-1 block">{errors.email}</span>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#071618] mb-1">Phone</label>
                                <input type="tel" name="phone" value={form.phone} onChange={handleChange} className={inputClass('phone')} placeholder="Your phone" />
                            </div>
                        </div>

                        <h3 className="text-sm font-bold uppercase tracking-wide text-[#0D4D4D]/80 mb-3">Delivery in Jamaica</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-[#071618] mb-1">Recipient name <span className="text-red-500">*</span></label>
                                <input type="text" name="recipient_name" value={form.recipient_name} onChange={handleChange} className={inputClass('recipient_name')} placeholder="Who receives it" />
                                {errors.recipient_name && <span className="text-red-500 text-xs mt-1 block">{errors.recipient_name}</span>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#071618] mb-1">Recipient phone <span className="text-red-500">*</span></label>
                                <input type="tel" name="recipient_phone" value={form.recipient_phone} onChange={handleChange} className={inputClass('recipient_phone')} placeholder="Recipient phone" />
                                {errors.recipient_phone && <span className="text-red-500 text-xs mt-1 block">{errors.recipient_phone}</span>}
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-[#071618] mb-1">Street address <span className="text-red-500">*</span></label>
                            <input type="text" name="delivery_street" value={form.delivery_street} onChange={handleChange} className={inputClass('delivery_street')} placeholder="Street address" />
                            {errors.delivery_street && <span className="text-red-500 text-xs mt-1 block">{errors.delivery_street}</span>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-[#071618] mb-1">Town / City <span className="text-red-500">*</span></label>
                                <input type="text" name="delivery_town" value={form.delivery_town} onChange={handleChange} className={inputClass('delivery_town')} placeholder="Town or city" />
                                {errors.delivery_town && <span className="text-red-500 text-xs mt-1 block">{errors.delivery_town}</span>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#071618] mb-1">Parish <span className="text-red-500">*</span></label>
                                <select name="delivery_parish" value={form.delivery_parish} onChange={handleChange} className={inputClass('delivery_parish')}>
                                    <option value="">Select parish</option>
                                    {JAMAICA_PARISHES.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                                {errors.delivery_parish && <span className="text-red-500 text-xs mt-1 block">{errors.delivery_parish}</span>}
                            </div>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-[#071618] mb-1">Notes <span className="text-[#595d5e] text-xs">(optional)</span></label>
                            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className={inputClass('notes')} placeholder="Anything we should know" />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-[#C1A35E] text-[#071618] h-[50px] rounded-full font-bold text-lg hover:bg-[#E5C78A] transition-all shadow-[0_8px_16px_rgba(193,163,94,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Placing order…' : `Place order · ${currency} ${total}`}
                        </button>
                        <p className="text-xs text-[#595d5e] text-center mt-3">
                            No online payment now — we'll contact you to arrange payment and shipping.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PrepackedBarrel;
