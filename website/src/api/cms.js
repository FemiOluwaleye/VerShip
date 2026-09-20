import axios from './axios';
export const updateProfile = async (data) => {
    try {
        const response = await axios.post('/website/update-profile', data);
        return response.data;
    } catch (error) {
        console.error('Error fetching update profile:', error.message);
        throw error;
    }
}
export const getPrivacyPolicy = async () => {
    try {
        const response = await axios.get('/website/privacy');
        return response.data;
    } catch (error) {
        console.error('Error fetching privacy policy:', error);
        throw error;
    }
};

export const getAboutUs = async () => {
    try {
        const response = await axios.get('/website/about');
        return response.data;
    } catch (error) {
        console.error('Error fetching about us:', error);
        throw error;
    }
};

// Pre-packed food barrel (owner-sold fixed product)
export const getPrepackedBarrel = async () => {
    try {
        const response = await axios.get('/website/prepacked-barrel');
        return response.data;
    } catch (error) {
        console.error('Error fetching pre-packed barrel:', error);
        throw error;
    }
};

export const addBookingAdditionalCost = async (data) => {
    try {
        const response = await axios.post('/website/booking-additional-cost', data);
        return response.data;
    } catch (error) {
        console.error('Error adding additional cost:', error);
        throw error;
    }
};

export const payAdditionalCost = async (data) => {
    try {
        const response = await axios.post('/website/additional-cost/pay-intent', data);
        return response.data;
    } catch (error) {
        console.error('Error creating additional cost payment:', error);
        throw error;
    }
};

export const confirmAdditionalCostPayment = async (data) => {
    try {
        const response = await axios.post('/website/additional-cost/confirm', data);
        return response.data;
    } catch (error) {
        console.error('Error confirming additional cost payment:', error);
        throw error;
    }
};

export const confirmPrepackedPayment = async (data) => {
    try {
        const response = await axios.post('/website/prepacked-order/confirm', data);
        return response.data;
    } catch (error) {
        console.error('Error confirming pre-packed payment:', error);
        throw error;
    }
};

export const getMyPrepackedOrders = async () => {
    try {
        const response = await axios.get('/website/prepacked-orders');
        return response.data;
    } catch (error) {
        console.error('Error fetching pre-packed orders:', error);
        throw error;
    }
};

export const createPrepackedOrder = async (data) => {
    try {
        const response = await axios.post('/website/prepacked-order', data);
        return response.data;
    } catch (error) {
        console.error('Error creating pre-packed order:', error);
        throw error;
    }
};

export const getTermsAndConditions = async () => {
    try {
        const response = await axios.get('/website/terms');
        return response.data;
    } catch (error) {
        console.error('Error fetching terms and conditions:', error);
        throw error;
    }
};

export const getCookiePolicy = async () => {
    try {
        const response = await axios.get('/website/cookie-policy');
        return response.data;
    } catch (error) {
        console.error('Error fetching cookie policy:', error);
        throw error;
    }
};

export const getFreightContent = async () => {
    try {
        const response = await axios.get('/website/freight-content');
        return response.data;
    } catch (error) {
        console.error('Error fetching freight content:', error);
        throw error;
    }
};

export const getRefundPolicy = async () => {
    try {
        const response = await axios.get('/website/refund-policy');
        return response.data;
    } catch (error) {
        console.error('Error fetching refund policy:', error);
        throw error;
    }
};
export const getFaqs = async () => {
    try {
        const response = await axios.get('/website/faq');
        return response.data;
    } catch (error) {
        console.error('Error fetching faqs:', error);
        throw error;
    }
};
export const contactUs = async (data) => {
    try {
        const response = await axios.post('/website/contact/us', data);
        return response.data;
    } catch (error) {
        console.error('Error fetching contact us:', error);
        throw error;
    }

};

export const updateBookingPayment = async (data) => {
    try {
        const response = await axios.post('/website/update-booking-payment', data);
        return response.data;
    } catch (error) {
        console.error('Error updating booking payment:', error);
        throw error;
    }
};

export const subscribeNewsletter = async (data) => {
    try {
        const response = await axios.post('/website/newsletter/subscribe', data);
        return response.data;
    } catch (error) {
        console.error('Error subscribing to newsletter:', error);
        throw error;
    }
};


export const register = async (data) => {
    try {
        const response = await axios.post('/website/register', data);
        return response.data;
    } catch (error) {
        console.error('Error fetching register:', error);
        throw error;
    }
};
export const login = async (data) => {
    try {
        // console.log("Login datDFSDFSDSFDa:", data);
        // return
        const response = await axios.post('/website/login', data);
        console.log("Login response:", response);
        return response.data;
    } catch (error) {
        console.error('Error fetching login:', error.response.data);
        throw error;
    }
};
export const logoutAPI = async () => {
    try {
        const response = await axios.post('/website/logout');
        return response.data;
    } catch (error) {
        console.error('Error during logout:', error);
        throw error;
    }
};
export const socialLogin = async (data) => {
    try {
        const response = await axios.post('/website/social-login', data);
        return response.data;
    } catch (error) {
        console.error('Error fetching social login:', error);
        throw error;
    }
};

export const forgotPassword = async (data) => {
    try {
        const response = await axios.post('/website/forgot-password', data);
        return response.data;
    } catch (error) {
        console.error('Error in forgot password:', error);
        throw error;
    }
};

export const verify = async (data) => {
    try {
        const response = await axios.post('/website/verify', data);
        return response.data;
    } catch (error) {
        console.error('Error fetching verify:', error);
        throw error;
    }
};
export const resendOtp = async (data) => {
    try {
        const response = await axios.post('/website/resend-otp', data);
        return response.data;
    } catch (error) {
        console.error('Error fetching resend-otp:', error);
        throw error;
    }
};
// Final step of the forgot-password flow. Expects { email, resetToken, newPassword, confirmPassword }.
// The resetToken is the single-use ticket returned by verify({ purpose: 'reset_password' }).
export const resetPassword = async (data) => {
    try {
        const response = await axios.post('/website/reset-password', data);
        return response.data;
    } catch (error) {
        console.error('Error in reset password:', error);
        throw error;
    }
};
export const deleteAccount = async (data) => {
    try {
        console.log("Delete data:", data);
        const response = await axios.post('/website/delete-account', data);
        return response.data;
    } catch (error) {
        console.error('Error fetching delete-account:', error);
        throw error;
    }
};


export const saveBookingRequest = async (data) => {
    try {
        const response = await axios.post("/website/save-booking-request", data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const updateBookingRequest = async (id, data) => {
    try {
        const response = await axios.post(`/website/update-booking-request/${id}`, data);
        return response.data;
    } catch (error) {
        throw error;
    }
};


export const completeProfile = async (data) => {
    try {
        console.log('[cms.completeProfile] request.payload', data);
        const response = await axios.post('/website/complete-profile', data);
        console.log('[cms.completeProfile] response.raw', response);
        console.log('[cms.completeProfile] response.data', response.data);
        return response.data;
    } catch (error) {
        console.error('[cms.completeProfile] error.message', error?.message);
        console.error('[cms.completeProfile] error.status', error?.response?.status);
        console.error('[cms.completeProfile] error.data', error?.response?.data);
        console.error('Error saving booking request:', error);
        throw error;
    }
};

export const createStripeAccount = async () => {
    try {
        const response = await axios.post('/website/createStripeAccount');
        return response.data;
    } catch (error) {
        console.error('Error creating Stripe account:', error);
        throw error;
    }
};

export const getProviderProfile = async (id) => {
    try {
        const response = await axios.get(`/website/get-profile?id=${id}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching profile:', error);
        throw error;
    }

};
export const getProviderList = async (id) => {
    try {
        const response = await axios.get(`/website/providerlist`);
        return response.data;
    } catch (error) {
        console.error('Error fetching providerlist:', error);
        throw error;
    }

};
export const getAvailableQuotes = async (id) => {
    try {
        const url = id ? `/website/get-available-quotes?id=${id}` : '/website/get-available-quotes';
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching available quotes:', error);
        throw error;
    }
};

export const createBooking = async (data) => {
    try {
        const response = await axios.post('/website/create-booking', data);
        return response.data;
    } catch (error) {
        console.error('Error creating booking:', error);
        throw error;
    }
};

export const getBookings = async () => {
    try {
        const response = await axios.get('/website/get-bookings');
        return response.data;
    } catch (error) {
        console.error('Error fetching bookings:', error);
        throw error;
    }
};

export const getEarnings = async () => {
    try {
        const response = await axios.get('/website/get-earnings');
        return response.data;
    } catch (error) {
        console.error('Error fetching earnings:', error);
        throw error;
    }
};

export const getBookingDetail = async (bookingId) => {
    try {
        const response = await axios.get(`/website/get-booking-detail?bookingId=${bookingId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching booking detail:', error);
        throw error;
    }
};

export const updateBookingStatus = async (data) => {
    try {
        const response = await axios.post('/website/update-booking-status', data);
        return response.data;
    } catch (error) {
        console.error('Error updating booking status:', error);
        throw error;
    }
};

export const uploadBookingDocument = async (data) => {
    try {
        const response = await axios.post('/website/upload-booking-document', data, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error uploading booking document:', error);
        throw error;
    }
};

export const getNotifications = async () => {
    try {
        const response = await axios.get("/website/get-notifications");
        return response.data;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }
};

export const createPaymentIntent = async (data) => {
    try {
        const response = await axios.post('/website/create-payment-intent', data);
        return response.data;
    } catch (error) {
        console.error('Error creating payment intent:', error);
        throw error;
    }
};

export const updatePayLaterStatus = async (data) => {
    try {
        const response = await axios.post('/website/update-pay-later-status', data);
        return response.data;
    } catch (error) {
        console.error('Error updating pay later status:', error);
        throw error;
    }
};

export const clearNotifications = async () => {
    try {
        const response = await axios.delete("/website/clear-notifications");
        return response.data;
    } catch (error) {
        console.error('Error clearing notifications:', error);
        throw error;
    }
};

export const updateDeviceToken = async (data) => {
    try {
        const response = await axios.post('/website/update-device-token', data);
        return response.data;
    } catch (error) {
        console.error('Error updating device token:', error);
        throw error;
    }
};

export const submitRating = async (data) => {
    try {
        const response = await axios.post('/website/submit-rating', data);
        return response.data;
    } catch (error) {
        console.error('Error submitting rating:', error);
        throw error;
    }
};

export const checkRatingStatus = async (bookingId) => {
    try {
        const response = await axios.get(`/website/check-rating-status?bookingId=${bookingId}`);
        return response.data;
    } catch (error) {
        console.error('Error checking rating status:', error);
        throw error;
    }
};
export const getCookiesListing = async () => {
    try {
        const response = await axios.get('/website/get-cookies');
        return response.data;
    } catch (error) {
        console.error('Error fetching cookies listing:', error);
        throw error;
    }
};

export const saveUserCookies = async (data) => {
    try {
        const response = await axios.post('/website/save-user-cookies', data);
        return response.data;
    } catch (error) {
        console.error('Error saving user cookies:', error);
        throw error;
    }
};

export const syncUserCookies = async (userId) => {
    const selectedCookiesStr = localStorage.getItem("selectedCookies");
    if (selectedCookiesStr) {
        try {
            const cookieIds = JSON.parse(selectedCookiesStr);
            if (cookieIds && cookieIds.length > 0) {
                await saveUserCookies({ userId, cookieIds });
            }
        } catch (e) {
            console.error('Failed to sync cookies:', e);
        }
    }
};

export const getUserCookies = async () => {
    try {
        const response = await axios.get('/website/get-user-cookies');
        return response.data;
    } catch (error) {
        console.error('Error fetching user cookies:', error);
        throw error;
    }
};
export const getTopForwarders = async () => {
    try {
        const response = await axios.get('/website/get-forwarders');
        return response.data;
    } catch (error) {
        console.error('Error fetching top forwarders:', error);
        throw error;
    }
};
export const getAddons = async () => {
    try {
        const response = await axios.get('/website/get-addons');
        return response.data;
    } catch (error) {
        console.error('Error fetching add-ons:', error);
        throw error;
    }
};

export const getServiceFeePercent = async () => {
    try {
        const response = await axios.get('/website/service-fee-percent');
        return response.data;
    } catch (error) {
        console.error('Error fetching service fee percent:', error);
        throw error;
    }
};
export const getRatings = async () => {
    try {
        const response = await axios.get('/website/ratings');
        return response.data;
    } catch (error) {
        console.error('Error fetching ratings:', error);
        throw error;
    }
};
/* ── Checkout redesign / milestone payments / held payouts ── */
export const getGuestQuotes = async (payload) => (await axios.post('/website/guest-quotes', payload)).data;
export const getQuoteBreakdown = async (params) => (await axios.get('/website/quote-breakdown', { params })).data;
export const postQuoteBreakdown = async (payload) => (await axios.post('/website/quote-breakdown', payload)).data;
export const guestCheckout = async (payload) => (await axios.post('/website/guest-checkout', payload)).data;
export const createChargeIntent = async (payload) => (await axios.post('/website/charge-intent', payload)).data;
export const confirmCharge = async (paymentId) => (await axios.post('/website/confirm-charge', { paymentId })).data;
export const getBookingCharges = async (bookingId) => (await axios.get('/website/booking-charges', { params: { bookingId } })).data;
export const getMyCharges = async () => (await axios.get('/website/my-charges')).data;
export const accountSetup = async (payload) => (await axios.post('/website/account-setup', payload)).data;
export const getMyPayouts = async () => (await axios.get('/website/payouts/me')).data;
export const collectPayouts = async () => (await axios.post('/website/payouts/collect')).data;
export const getStripeConfig = async () => (await axios.get('/website/stripe-config')).data;
