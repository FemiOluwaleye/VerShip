import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { toast } from 'sonner';

const CheckoutForm = ({ amount, bookingId, onSuccess, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Return URL can be a success page, but since we handle it in-app:
                return_url: window.location.origin + "/history",
            },
            redirect: 'if_required',
        });

        if (error) {
            toast.error(error.message);
            setIsProcessing(false);
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            toast.success("Payment Successful!");
            onSuccess(paymentIntent);
        } else {
            toast.error("An unexpected error occurred.");
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement options={{
                layout: 'tabs',
            }} />
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-8 py-3 rounded-full border border-gray-300 font-semibold hover:bg-gray-100 transition"
                    disabled={isProcessing}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!stripe || isProcessing}
                    className="bg-gradient-to-r from-[#FFB800] via-[#FFD24D] to-[#FFE58F] text-black font-semibold px-12 py-3 rounded-full hover:brightness-110 transition disabled:opacity-50"
                >
                    {isProcessing ? "Processing..." : `Pay $${amount}`}
                </button>
            </div>
        </form>
    );
};

export default CheckoutForm;
