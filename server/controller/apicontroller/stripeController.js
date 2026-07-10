const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const publishkey = require('stripe')(process.env.STRIPE_PUBLISHABLE_KEY);
const helper = require('../../helper/helper');
const db = require('../../models');

exports.createPaymentIntent = async (req, res) => {
    try {
        const {
            amount,
            currency,
            bookingId,
            distance,
            deliveryFee,
            driverId
        } = req.body;

        if (!amount || !currency) {
            return res.status(400).json({
                success: false,
                message: "Amount and currency are required."
            });
        }

        const amountInCents = Math.round(Number(amount) * 100);
        if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount."
            });
        }

        let resolvedDriverId = driverId;
        let commissionPercentFromBooking = 0;

        if (bookingId) {
            const booking = await db.bookings.findOne({ where: { id: bookingId } });
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found."
                });
            }

            const adminCommission = Number(booking.adminCommission || 0);
            const serviceFee = Number(booking.serviceFee || 0);
            commissionPercentFromBooking = adminCommission + serviceFee;

            if (!resolvedDriverId && booking.driverId) {
                resolvedDriverId = booking.driverId;
            }
        }

        const paymentIntentPayload = {
            amount: amountInCents,
            currency: currency,
            metadata: {
                bookingId: bookingId ? bookingId.toString() : "",
                total_distance: distance ? distance.toString() : "0",
                delivery_fee: deliveryFee ? deliveryFee.toString() : "0",
                provider_id: resolvedDriverId ? resolvedDriverId.toString() : ""
            },
            automatic_payment_methods: {
                enabled: true,
            },
        };

        let destinationAccountId = null;
        let applicationFeeAmount = 0;

        if (resolvedDriverId) {
            const provider = await db.users.findOne({ where: { id: resolvedDriverId } });

            if (!provider) {
                return res.status(400).json({
                    success: false,
                    message: "Provider not found."
                });
            }


            const hashAccountValue = String(provider.hashAccount || '0');

            if (hashAccountValue !== '1') {

                return res.status(400).json({
                    success: false,
                    message: "This provider cannot accept payments at this time. Please select another provider.",
                    code: "PROVIDER_NOT_VERIFIED"
                });
            }

            if (!provider.accountId) {
                return res.status(400).json({
                    success: false,
                    message: "Provider Stripe account not connected."
                });
            }

            try {
                const stripeAccount = await stripe.accounts.retrieve(provider.accountId);

                const hasTransfersCapability = stripeAccount.capabilities?.transfers === 'active';
                const hasLegacyPayments = stripeAccount.capabilities?.legacy_payments === 'active';

                if (!hasTransfersCapability && !hasLegacyPayments) {
                    console.error(`Provider ${resolvedDriverId} account ${provider.accountId} missing transfer capabilities`);
                    return res.status(400).json({
                        success: false,
                        message: "Provider payment account is not fully configured. Please contact support.",
                        code: "PROVIDER_ACCOUNT_INCOMPLETE"
                    });
                }
            } catch (stripeError) {
                console.error("Stripe account verification error:", stripeError);
                return res.status(400).json({
                    success: false,
                    message: "Provider payment account verification failed.",
                    code: "PROVIDER_ACCOUNT_ERROR"
                });
            }

            const commissionPercent = Number(commissionPercentFromBooking);
            if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking commission. adminCommission + serviceFee must be between 0 and 100."
                });
            }

            applicationFeeAmount = Math.round((amountInCents * commissionPercent) / 100);
            destinationAccountId = provider.accountId;

            paymentIntentPayload.application_fee_amount = applicationFeeAmount;
            paymentIntentPayload.transfer_data = {
                destination: destinationAccountId,
            };
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentPayload);
        const providerAmount = amountInCents - applicationFeeAmount;

        res.status(200).json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            publishkey: process.env.STRIPE_PUBLISHABLE_KEY,
            paymentIntentId: paymentIntent.id,
            split: {
                destinationAccountId,
                adminAmount: Number((applicationFeeAmount / 100).toFixed(2)),
                providerAmount: Number((providerAmount / 100).toFixed(2)),
                totalAmount: Number((amountInCents / 100).toFixed(2))
            }
        });
    } catch (error) {
        console.error("Stripe Error:", error);

        if (error.code === 'insufficient_capabilities_for_transfer') {
            return res.status(400).json({
                success: false,
                message: "Provider payment account is not properly configured for transfers.",
                code: "PROVIDER_ACCOUNT_INCOMPLETE"
            });
        }

        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

exports.createStripeAccount = async (req, res) => {
    try {
        const user = await db.users.findOne({ where: { id: req.user.id } });
        if (!user) return res.status(401).json({ message: "User not found" });

        let account;

        if (!user.accountId) {
            account = await stripe.accounts.create({
                type: "express",
                email: user.email,
                country: "US",
                capabilities: {
                    transfers: { requested: true },
                    card_payments: { requested: true },
                },
            });

            await db.users.update(
                { accountId: account.id, hashAccount: "0" },
                { where: { id: user.id } }
            );
        } else {
            account = await stripe.accounts.retrieve(user.accountId);
        }

        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            type: "account_onboarding",
            refresh_url: 'https://vershipgo.com/stripe/refresh',
            return_url: `https://admin.vershipgo.com/website/stripe/return/${req.user.id}`,
        });

        return helper.success(res, "Connect Successfully", {
            account_id: account.id,
            url: accountLink.url,
        });

    } catch (err) {
        console.log("Stripe Connect Error:", err);
        return res.status(400).json({ error: err.message });
    }
};
exports.stripeReturn = async (req, res) => {
    try {
        const userId = req.params.userId;

        await db.users.update(
            { hashAccount: "1" },
            { where: { id: userId } }
        );

        console.log(`✅ hashAccount updated to "1" for user: ${userId}`);

        return res.redirect('https://vershipgo.com');

    } catch (error) {
        console.error('Error:', error);
        return res.redirect('https://vershipgo.com');
    }
};
exports.createPaymentIntent12 = async (req, res) => {
    try {
        const { amount, currency, bookingId, distance, deliveryFee } = req.body;

        if (!amount || !currency) {
            return res.status(400).json({
                success: false,
                message: "Amount and currency are required."
            });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects amount in cents
            currency: currency,
            metadata: {
                bookingId: bookingId.toString(),
                total_distance: distance ? distance.toString() : "0",
                delivery_fee: deliveryFee ? deliveryFee.toString() : "0"
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.status(200).json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            publishkey: process.env.STRIPE_PUBLISHABLE_KEY,

        });
    } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};