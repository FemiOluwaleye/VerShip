const nodemailer = require('nodemailer');

const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// The From header for every outbound email — override per environment with
// MAIL_FROM. This MUST be an address on a domain verified in Resend: several
// senders used to fall back to "no-reply@shipone.com", an unverified domain, so
// Resend replaced it with the account owner's own identity and customers saw a
// personal name on their OTP mail. Keep this the single source of truth.
const DEFAULT_FROM = process.env.MAIL_FROM || 'VerShip <info@vershipgo.com>';

// --- Email transport seam -------------------------------------------------------------------
// Prefer Resend when RESEND_API_KEY is configured; otherwise fall back to SMTP/nodemailer so
// existing environments keep working. All senders funnel through deliver() below, so switching
// providers is a single decision made here, not in each template.
const resendApiKey = process.env.RESEND_API_KEY;
let resendClient = null;
if (resendApiKey) {
    try {
        const { Resend } = require('resend');
        resendClient = new Resend(resendApiKey);
        console.log('📧 Mailer: using Resend transport');
    } catch (err) {
        console.error('Failed to init Resend, falling back to SMTP:', err.message);
    }
}

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Strip HTML to a reasonable plaintext alternative for clients that prefer it (and for
// deliverability — multipart mail scores better than HTML-only).
const htmlToText = (html) =>
    String(html || '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

// Unified send. Uses Resend when available, else nodemailer. Returns the provider response.
const deliver = async ({ to, subject, html, text, from, replyTo }) => {
    const fromAddr = from || DEFAULT_FROM;
    const plain = text || htmlToText(html);

    // Dev/test: MAIL_PREVIEW_DIR writes each email to disk instead of sending,
    // so templates can be eyeballed without a real mailbox.
    if (process.env.MAIL_PREVIEW_DIR) {
        const fs = require('fs');
        const path = require('path');
        fs.mkdirSync(process.env.MAIL_PREVIEW_DIR, { recursive: true });
        const file = path.join(process.env.MAIL_PREVIEW_DIR, `${Date.now()}-${String(subject).replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.html`);
        fs.writeFileSync(file, `<!-- to: ${Array.isArray(to) ? to.join(', ') : to} | from: ${fromAddr} | subject: ${subject} -->\n${html}`);
        console.log('📧 Email previewed to %s (subject=%s)', file, subject);
        return { id: `preview:${file}` };
    }

    if (resendClient) {
        const { data, error } = await resendClient.emails.send({
            from: fromAddr,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
            text: plain,
            ...(replyTo ? { replyTo } : {}),
        });
        if (error) {
            // Normalise Resend's error object into a thrown Error so callers' try/catch works.
            throw new Error(error.message || 'Resend send failed');
        }
        // Log the resolved From — a wrong/unverified sender is silently rewritten
        // by Resend, and this is the only place it is observable.
        console.log('📧 Email sent via Resend: id=%s from=%s subject=%s', data && data.id, fromAddr, subject);
        return data;
    }

    const info = await transporter.sendMail({
        from: fromAddr,
        to,
        subject,
        html,
        text: plain,
        ...(replyTo ? { replyTo } : {}),
    });
    console.log('📧 Email sent via SMTP: id=%s from=%s subject=%s', info.messageId, fromAddr, subject);
    return info;
};


// Link back to the environment that generated the email (stage links must not
// dead-end on prod). Override per env with STAGE_APP_URL / PROD_APP_URL / APP_URL.
const appBaseUrl = () => {
    const { env } = require('./envConfig');
    return env('APP_URL')
        || (process.env.REPLIT_DEPLOYMENT
            ? 'https://vershipgo.com'
            : (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://vershipgo.com'));
};

// Shared shell for the transactional templates below.
const shell = ({ tagline, body }) => `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 550px; margin: 0 auto; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 35px rgba(0,0,0,0.15);">
                <div style="background: linear-gradient(135deg, #FFBF00 0%, #FFD864 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #2D413F; font-size: 28px; font-weight: bold;">VerShip</h1>
                    <p style="margin: 10px 0 0; color: #2D413F; font-size: 14px; opacity: 0.85;">${escapeHtml(tagline)}</p>
                </div>
                <div style="padding: 40px 30px; background: white;">${body}</div>
                <div style="background: #f8f9fa; padding: 18px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} VerShip. All rights reserved.</p>
                </div>
            </div>`;
const cta = (href, label) => `
                    <div style="text-align: center; margin: 30px 0 10px;">
                        <a href="${href}" style="background: #0D4D4D; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 999px; font-weight: bold; font-size: 15px; display: inline-block;">${escapeHtml(label)}</a>
                    </div>`;
const amountBox = (label, amount) => `
                    <div style="background: #f8f9fa; border-left: 4px solid #FFBF00; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
                        <p style="margin: 0 0 8px 0; color: #2D413F; font-size: 15px;">${escapeHtml(label)}</p>
                        <p style="margin: 0; color: #2D413F; font-size: 26px; font-weight: bold;">$${escapeHtml(amount)} USD</p>
                    </div>`;

module.exports = {
    // Signup email-verification code. Purpose-specific copy so a reset code and a verify code
    // never look interchangeable to the recipient.
    sendVerificationOtpEmail: async (email, otp) => {
        const mailOptions = {
            from: DEFAULT_FROM,
            to: email,
            subject: 'Verify your email — VerShip',
            html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 550px; margin: 0 auto; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 35px rgba(0,0,0,0.15);">
                <div style="background: linear-gradient(135deg, #FFBF00 0%, #FFD864 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #2D413F; font-size: 28px; font-weight: bold;">VerShip</h1>
                    <p style="margin: 10px 0 0; color: #2D413F; font-size: 14px; opacity: 0.85;">Confirm your email address</p>
                </div>
                <div style="padding: 40px 30px; background: white;">
                    <h2 style="color: #2D413F; margin: 0 0 10px 0; font-size: 24px;">Welcome to VerShip</h2>
                    <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0; font-size: 15px;">Use the code below to verify your email and activate your account:</p>
                    <div style="text-align: center; margin: 35px 0;">
                        <div style="background: #f8f9fa; border: 2px dashed #FFBF00; border-radius: 15px; padding: 25px; display: inline-block; min-width: 250px;">
                            <p style="margin: 0 0 10px 0; color: #666; font-size: 13px; letter-spacing: 1px;">YOUR VERIFICATION CODE</p>
                            <div style="font-size: 44px; font-weight: bold; color: #2D413F; letter-spacing: 8px; font-family: monospace;">${escapeHtml(otp)}</div>
                            <p style="margin: 15px 0 0 0; color: #999; font-size: 12px;">Valid for 10 minutes</p>
                        </div>
                    </div>
                    <p style="color: #666; line-height: 1.6; margin: 0; font-size: 14px;">If you didn't create a VerShip account, you can safely ignore this email.</p>
                </div>
                <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} VerShip. All rights reserved.</p>
                </div>
            </div>`,
        };
        const info = await deliver(mailOptions);
        console.log('✅ Verification OTP email sent to: %s', email);
        return info;
    },
    sendResetEmail12: async (email, link) => {
        try {
            const mailOptions = {
                from: DEFAULT_FROM,
                to: email,
                subject: 'Password Reset Request',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                        <h2 style="color: #2D413F; text-align: center;">Password Reset Request</h2>
                        <p>Hi,</p>
                        <p>You requested a password reset for your account. Please click the button below to set a new password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${link}" style="background-color: #FFBF00; color: #000; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Reset Password</a>
                        </div>
                        <p>If you did not request this, please ignore this email or contact support.</p>
                        <p>This link will take you to: <br/> <a href="${link}">${link}</a></p>
                        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #777; text-align: center;">&copy; ${new Date().getFullYear()} Vership. All rights reserved.</p>
                    </div>
                `,
            };

            const info = await deliver(mailOptions);
            console.log('Message sent: %s', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            throw error;
        }
    },
    sendOtpEmail12: async (email, otp) => {
        try {
            const mailOptions = {
                from: DEFAULT_FROM,
                to: email,
                subject: 'Password Reset OTP',
                html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 550px; margin: 0 auto; background: linear-gradient(135deg, #2D413F 0%, #1a2a28 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 35px rgba(0,0,0,0.2);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #FFBF00 0%, #FFD864 100%); padding: 30px 20px; text-align: center;">
                        <h1 style="margin: 0; color: #2D413F; font-size: 28px; font-weight: bold;">Vership</h1>
                        <p style="margin: 10px 0 0; color: #2D413F; font-size: 14px; opacity: 0.8;">Secure Password Reset</p>
                    </div>
                    
                    <!-- Body -->
                    <div style="padding: 40px 30px; background: white;">
                        <h2 style="color: #2D413F; margin: 0 0 10px 0; font-size: 24px;">Reset Your Password</h2>
                        <p style="color: #666; line-height: 1.6; margin: 0 0 25px 0; font-size: 16px;">Hello,</p>
                        <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0; font-size: 15px;">We received a request to reset your password. Use the verification code below to proceed:</p>
                        
                        <!-- OTP Box -->
                        <div style="text-align: center; margin: 35px 0;">
                            <div style="background: #f8f9fa; border: 2px dashed #FFBF00; border-radius: 15px; padding: 25px; display: inline-block; min-width: 250px;">
                                <p style="margin: 0 0 10px 0; color: #666; font-size: 13px; letter-spacing: 1px;">YOUR VERIFICATION CODE</p>
                                <div style="font-size: 48px; font-weight: bold; color: #2D413F; letter-spacing: 8px; font-family: monospace;">${otp}</div>
                                <p style="margin: 15px 0 0 0; color: #999; font-size: 12px;">Valid for 10 minutes only</p>
                            </div>
                        </div>
                        
                        <p style="color: #666; line-height: 1.6; margin: 0 0 5px 0; font-size: 14px;">If you didn't request this, please ignore this email or contact our support team.</p>
                        
                        <!-- Note -->
                        <div style="background: #fff9e6; border-left: 4px solid #FFBF00; padding: 12px 20px; margin: 20px 0 0 0; border-radius: 8px;">
                            <p style="margin: 0; color: #666; font-size: 13px;">⚠️ Never share this OTP with anyone. Our team will never ask for it.</p>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
                        <p style="margin: 0 0 10px 0; font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Vership. All rights reserved.</p>
                        <p style="margin: 0; font-size: 11px; color: #bbb;">This is an automated message, please do not reply.</p>
                    </div>
                </div>
            `,
            };

            const info = await deliver(mailOptions);
            console.log('✅ OTP email sent successfully to: %s', email);
            console.log('📧 Message ID: %s', info.messageId);
            return info;
        } catch (error) {
            console.error('❌ Error sending OTP email:', error);
            throw error;
        }
    },
    sendSubscriptionEmail: async (email) => {
        try {
            const mailOptions = {
                from: DEFAULT_FROM,
                to: email,
                subject: 'Welcome to Vership Newsletter!',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h1 style="color: #2D413F; margin: 0;">Welcome aboard!</h1>
                        </div>
                        <p>Hi there,</p>
                        <p>Thank you for subscribing to the Vership newsletter. We're excited to have you with us!</p>
                        <p>From now on, you'll be the first to know about our latest updates, shipping tips, and exclusive offers.</p>
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                            <p style="margin: 0; font-style: italic;">"Making global logistics simpler, one shipment at a time."</p>
                        </div>
                        <p>If you have any questions, feel free to reply to this email.</p>
                        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #777; text-align: center;">
                            You are receiving this email because you subscribed to our newsletter.<br/>
                            &copy; ${new Date().getFullYear()} Vership. All rights reserved.
                        </p>
                    </div>
                `,
            };

            const info = await deliver(mailOptions);
            return info;
        } catch (error) {
            console.error('Error sending subscription email:', error);
            throw error;
        }
    },

    sendFreightForwarderRegistrationEmail: async (forwarderDetails) => {
        try {
            const {
                legalName,
                doingBusinessAs,
                email,
                phone,
                mainAddress,
                streetAddress,
                city,
                state,
                userId,
                documentsSubmitted,
                registrationNumber,
                countryOfRegistration,
            } = forwarderDetails;

            const adminEmail =
                process.env.FREIGHT_FORWARDER_NOTIFY_EMAIL ||
                'dejoun.green@vershipgo.com';

            const registeredAt = new Date().toLocaleString('en-US', {
                dateStyle: 'full',
                timeStyle: 'short',
            });

            const detailRow = (label, value) => {
                if (!value) return '';
                return `
                    <tr>
                        <td style="padding: 10px 0; color: #666; font-size: 14px; width: 40%; vertical-align: top;">${label}</td>
                        <td style="padding: 10px 0; color: #2D413F; font-size: 14px; font-weight: 600;">${escapeHtml(value)}</td>
                    </tr>
                `;
            };

            const mailOptions = {
                from: DEFAULT_FROM,
                to: adminEmail,
                subject: 'New Freight Forwarder Registration — Vership',
                html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #2D413F 0%, #1a2a28 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 35px rgba(0,0,0,0.2);">
                    <div style="background: linear-gradient(135deg, #FFBF00 0%, #FFD864 100%); padding: 28px 24px; text-align: center;">
                        <h1 style="margin: 0; color: #2D413F; font-size: 26px; font-weight: bold;">Vership</h1>
                        <p style="margin: 8px 0 0; color: #2D413F; font-size: 14px; opacity: 0.85;">The Smart Way to Ship</p>
                    </div>

                    <div style="padding: 36px 28px; background: #ffffff;">
                        <h2 style="color: #2D413F; margin: 0 0 8px 0; font-size: 22px;">New Freight Forwarder Registered</h2>
                        <p style="color: #666; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px;">
                            A new freight forwarder has completed registration and submitted required documents on Vership. Review the details below and verify their documents in the admin panel.
                        </p>

                        <div style="background: #f8f9fa; border-radius: 12px; padding: 8px 20px; border: 1px solid #e8eceb;">
                            <table style="width: 100%; border-collapse: collapse;">
                                ${detailRow('Legal Name', legalName)}
                                ${detailRow('Doing Business As', doingBusinessAs)}
                                ${detailRow('Email', email)}
                                ${detailRow('Phone', phone)}
                                ${detailRow('Main Location', mainAddress)}
                                ${detailRow('Street Address', streetAddress)}
                                ${detailRow('City', city)}
                                ${detailRow('State', state)}
                                ${detailRow('Registration Number', registrationNumber)}
                                ${detailRow('Country of Registration', countryOfRegistration)}
                                ${detailRow('User ID', userId)}
                                ${detailRow('Documents Submitted', documentsSubmitted ? 'Yes — Certificate, Tax ID, and Government ID' : 'No')}
                                ${detailRow('Submitted At', registeredAt)}
                            </table>
                        </div>

                        <div style="text-align: center; margin: 28px 0 8px 0;">
                            <a href="https://web.vershipgo.com" style="background: linear-gradient(180deg, #FFBF00 0%, #FFD864 100%); color: #000; padding: 14px 28px; text-decoration: none; border-radius: 999px; font-weight: bold; font-size: 15px; display: inline-block;">
                                Open Vership Admin
                            </a>
                        </div>

                        <p style="color: #999; font-size: 12px; text-align: center; margin: 16px 0 0 0;">
                            This is an automated notification sent after document upload during freight forwarder onboarding.
                        </p>
                    </div>

                    <div style="background: #f8f9fa; padding: 18px; text-align: center; border-top: 1px solid #e0e0e0;">
                        <p style="margin: 0; font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Vership. All rights reserved.</p>
                    </div>
                </div>
                `,
            };

            const info = await deliver(mailOptions);
            console.log('Freight forwarder registration email sent to: %s', adminEmail);
            return info;
        } catch (error) {
            console.error('Error sending freight forwarder registration email:', error);
            throw error;
        }
    },

    sendOtpEmail: async (email, otp) => {
        try {
            const mailOptions = {
                from: DEFAULT_FROM,
                to: email,
                subject: 'OTP Verification',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                        <h2 style="color: #2D413F; text-align: center;">OTP Verification</h2>
                        <p>Hi,</p>
                        <p>Your OTP for verification is <strong>${otp}</strong>.</p>
                        <p>Please enter this OTP to proceed.</p>
                        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #777; text-align: center;">&copy; ${new Date().getFullYear()} Vership. All rights reserved.</p>
                    </div>
                `,
            };

            const info = await deliver(mailOptions);
            console.log('Message sent: %s', info.messageId);
            return info;
        } catch (error) {
            console.error('Error sending OTP email:', error);
            throw error;
        }
    },

    sendNewOrderPlacedEmailToProvider: async (email, orderDetails = {}) => {
        try {
            const {
                providerName,
                orderId,
                customerName,
                totalAmount,
                payNow,
                bookingId,
            } = orderDetails;

            const detailRow = (label, value) => {
                if (value === undefined || value === null || value === '') return '';
                return `
                    <tr>
                        <td style="padding: 10px 0; color: #666; font-size: 14px; width: 40%; vertical-align: top;">${label}</td>
                        <td style="padding: 10px 0; color: #2D413F; font-size: 14px; font-weight: 600;">${escapeHtml(value)}</td>
                    </tr>
                `;
            };

            const mailOptions = {
                from: DEFAULT_FROM,
                to: email,
                subject: `New Order Placed — ${orderId || 'Vership'}`,
                html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #2D413F 0%, #1a2a28 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 35px rgba(0,0,0,0.2);">
                    <div style="background: linear-gradient(135deg, #FFBF00 0%, #FFD864 100%); padding: 28px 24px; text-align: center;">
                        <h1 style="margin: 0; color: #2D413F; font-size: 26px; font-weight: bold;">Vership</h1>
                        <p style="margin: 8px 0 0; color: #2D413F; font-size: 14px; opacity: 0.85;">The Smart Way to Ship</p>
                    </div>

                    <div style="padding: 36px 28px; background: #ffffff;">
                        <h2 style="color: #2D413F; margin: 0 0 8px 0; font-size: 22px;">New Order Received</h2>
                        <p style="color: #666; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px;">
                            Hi ${escapeHtml(providerName || 'there')},
                        </p>
                        <p style="color: #666; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px;">
                            A customer has placed a new order and completed payment. Please review the order details below and prepare for fulfillment.
                        </p>

                        <div style="background: #f8f9fa; border-radius: 12px; padding: 8px 20px; border: 1px solid #e8eceb;">
                            <table style="width: 100%; border-collapse: collapse;">
                                ${detailRow('Order ID', orderId)}
                                ${detailRow('Booking ID', bookingId)}
                                ${detailRow('Customer', customerName)}
                                ${detailRow('Total Amount', totalAmount != null ? `$${totalAmount}` : '')}
                                ${detailRow('Paid Now', payNow != null ? `$${payNow}` : '')}
                            </table>
                        </div>

                        <p style="color: #999; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
                            Log in to your Vership provider dashboard to view full booking details.
                        </p>
                    </div>

                    <div style="background: #f8f9fa; padding: 18px; text-align: center; border-top: 1px solid #e0e0e0;">
                        <p style="margin: 0; font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} Vership. All rights reserved.</p>
                    </div>
                </div>
                `,
            };

            const info = await deliver(mailOptions);
            console.log('New order email sent to provider: %s', email);
            return info;
        } catch (error) {
            console.error('Error sending new order email to provider:', error);
            throw error;
        }
    },
    sendNewOrderPlacedEmailToProvider12: async (email, orderDetails = {}) => {
        try {
            const {
                providerName,
                orderId,
                bookingId,
                customerName,
                totalAmount,
            } = orderDetails;

            const mailOptions = {
                from: DEFAULT_FROM,
                to: email,
                subject: `New Order Received - Order #${orderId || bookingId}`,
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #2D413F; text-align: center;">New Order Received! 🎉</h2>
                    
                    <p>Hello ${providerName},</p>
                    
                    <p>A customer has placed a new order and completed payment.</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Order ID:</strong> ${orderId || 'N/A'}</p>
                        <p><strong>Booking ID:</strong> ${bookingId || 'N/A'}</p>
                        <p><strong>Customer:</strong> ${customerName || 'N/A'}</p>
                        <p><strong>Total Amount:</strong> $${parseFloat(totalAmount).toFixed(2)} USD</p>
                        <p><strong>Payment Status:</strong> Paid ✅</p>
                    </div>
                    
                    <p>Please log in to your provider dashboard to view the complete order details and prepare for shipment.</p>
                    
                    <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                    
                    <p style="font-size: 12px; color: #777; text-align: center;">
                        © ${new Date().getFullYear()} Vership. All rights reserved.
                    </p>
                </div>
            `,
            };

            const info = await deliver(mailOptions);
            console.log('✅ New order email sent to provider: %s', email);
            return info;
        } catch (error) {
            console.error('❌ Error sending email to provider:', error);
            throw error;
        }
    },
    sendBookingStatusUpdateEmailToUser: async (email, orderDetails = {}) => {
    try {
        const {
            customerName,
            orderId,
            bookingId,
            status,
            statusLabel,
            providerName,
        } = orderDetails;

        const mailOptions = {
            from: DEFAULT_FROM,
            to: email,
            subject: `Booking Status Update - Order #${orderId || bookingId}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #2D413F; text-align: center;">Booking Status Updated</h2>
                    
                    <p>Hello ${customerName || 'Customer'},</p>
                    
                    <p>Your booking status has been updated by ${providerName || 'the provider'}.</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Order ID:</strong> ${orderId || 'N/A'}</p>
                        <p><strong>Booking ID:</strong> ${bookingId || 'N/A'}</p>
                        <p><strong>New Status:</strong> 
                            <span style="color: #FFC928; font-weight: bold;">${statusLabel || status}</span>
                        </p>
                    </div>
                    
                    <p>You can track your order status in your dashboard.</p>
                    
                    <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                    
                    <p style="font-size: 12px; color: #777; text-align: center;">
                        © ${new Date().getFullYear()} Vership. All rights reserved.
                    </p>
                </div>
            `,
        };

        const info = await deliver(mailOptions);
        console.log('✅ Status update email sent to customer: %s', email);
        return info;
    } catch (error) {
        console.error('❌ Error sending status update email:', error);
        throw error;
    }
},

// A forwarder requested an extra charge on a booking; link the customer to
// their History page where the in-app Stripe flow collects it.
sendAdditionalCostRequestEmail: async (email, { customerName, businessName, orderId, amount, description }) => {
    try {
        // Link back to the environment that generated the email: a stage-created
        // charge only exists in the stage DB, so a prod link would dead-end.
        // Override per env with STAGE_APP_URL / PROD_APP_URL (or plain APP_URL).
        const { env } = require('./envConfig');
        const appUrl = env('APP_URL')
            || (process.env.REPLIT_DEPLOYMENT
                ? 'https://vershipgo.com'
                : (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://vershipgo.com'));
        const mailOptions = {
            from: DEFAULT_FROM,
            to: email,
            subject: `Payment requested for order ${orderId} — VerShip`,
            html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 550px; margin: 0 auto; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 35px rgba(0,0,0,0.15);">
                <div style="background: linear-gradient(135deg, #FFBF00 0%, #FFD864 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #2D413F; font-size: 28px; font-weight: bold;">VerShip</h1>
                    <p style="margin: 10px 0 0; color: #2D413F; font-size: 14px; opacity: 0.85;">Additional cost on your shipment</p>
                </div>
                <div style="padding: 40px 30px; background: white;">
                    <h2 style="color: #2D413F; margin: 0 0 10px 0; font-size: 22px;">Hi ${escapeHtml(customerName)},</h2>
                    <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0; font-size: 15px;">
                        <strong>${escapeHtml(businessName)}</strong> has requested payment for an additional cost on your order <strong>${escapeHtml(orderId)}</strong>:
                    </p>
                    <div style="background: #f8f9fa; border-left: 4px solid #FFBF00; border-radius: 8px; padding: 18px 20px; margin: 20px 0;">
                        <p style="margin: 0 0 8px 0; color: #2D413F; font-size: 15px;">${escapeHtml(description)}</p>
                        <p style="margin: 0; color: #2D413F; font-size: 26px; font-weight: bold;">$${escapeHtml(amount)} USD</p>
                    </div>
                    <div style="text-align: center; margin: 30px 0 10px;">
                        <a href="${appUrl}/history" style="background: #0D4D4D; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 999px; font-weight: bold; font-size: 15px; display: inline-block;">Review &amp; Pay</a>
                    </div>
                    <p style="color: #999; line-height: 1.6; margin: 15px 0 0; font-size: 13px; text-align: center;">
                        You can review this charge under My History after signing in. If you weren't expecting it, contact your forwarder before paying.
                    </p>
                </div>
            </div>
            `,
        };
        const info = await deliver(mailOptions);
        console.log('✅ Additional cost email sent to customer: %s', email);
        return info;
    } catch (error) {
        console.error('❌ Error sending additional cost email:', error);
        throw error;
    }
},

// Sent to the buyer the moment they place an order (shipment booking or a
// pre-packed barrel). Acknowledges receipt and lists the essentials; used by
// createBooking and createPrepackedOrder. Best-effort — callers swallow errors.
sendOrderConfirmationToCustomer: async (email, orderDetails = {}) => {
    try {
        const {
            customerName,
            orderId,
            orderType,     // e.g. "Shipment" or "Pre-Packed Barrel"
            itemSummary,   // e.g. "VerShip Pre-Packed Food Barrel × 1"
            amount,        // total (number or string)
            currency,      // e.g. "USD"
            deliveryTo,    // recipient / destination line (optional)
            note,          // optional next-step line (e.g. payment / tracking)
        } = orderDetails;

        const detailRow = (label, value) => {
            if (value === undefined || value === null || value === '') return '';
            return `
                <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; width: 40%; vertical-align: top;">${escapeHtml(label)}</td>
                    <td style="padding: 10px 0; color: #2D413F; font-size: 14px; font-weight: 600;">${escapeHtml(value)}</td>
                </tr>
            `;
        };

        const mailOptions = {
            from: DEFAULT_FROM,
            to: email,
            subject: `Order confirmed${orderId ? ` — ${orderId}` : ''} — VerShip`,
            html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 35px rgba(0,0,0,0.15);">
                <div style="background: linear-gradient(135deg, #FFBF00 0%, #FFD864 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #2D413F; font-size: 28px; font-weight: bold;">VerShip</h1>
                    <p style="margin: 10px 0 0; color: #2D413F; font-size: 14px; opacity: 0.85;">The Smart Way to Ship</p>
                </div>
                <div style="padding: 40px 30px; background: #ffffff;">
                    <h2 style="color: #2D413F; margin: 0 0 10px 0; font-size: 22px;">Thanks${customerName ? `, ${escapeHtml(customerName)}` : ''} — we've got your order!</h2>
                    <p style="color: #666; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px;">
                        Your ${escapeHtml(orderType || 'order')} has been placed successfully. Here are the details for your records:
                    </p>
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 8px 20px; border: 1px solid #e8eceb;">
                        <table style="width: 100%; border-collapse: collapse;">
                            ${detailRow('Order number', orderId)}
                            ${detailRow('Item', itemSummary)}
                            ${detailRow('Total', amount != null && amount !== '' ? `${currency || 'USD'} ${amount}` : '')}
                            ${detailRow('Delivering to', deliveryTo)}
                        </table>
                    </div>
                    <p style="color: #666; line-height: 1.6; margin: 24px 0 0 0; font-size: 14px;">
                        ${escapeHtml(note || "We'll keep you posted as your order progresses. You can track it any time under My History after signing in.")}
                    </p>
                </div>
                <div style="background: #f8f9fa; padding: 18px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} VerShip. All rights reserved.</p>
                </div>
            </div>
            `,
        };

        const info = await deliver(mailOptions);
        console.log('✅ Order confirmation email sent to customer: %s', email);
        return info;
    } catch (error) {
        console.error('❌ Error sending order confirmation email:', error);
        throw error;
    }
},

// Sent to a freight forwarder when a VerShip admin changes their rate card.
// This is a notice, not a request: the change is already live for new quotes.
// Admins may suppress it per-edit, but the default is to send — a forwarder's
// published pricing is their commercial position and they are entitled to know
// it moved, and to see exactly what moved.
sendPricingChangedEmailToProvider: async (email, details = {}) => {
    try {
        const {
            businessName,
            route,
            barrelType,
            changes = {},
            fieldLabels = {},
            reason,
            retired = false,
        } = details;

        // parishFees is a JSON blob; rendering the raw string would be useless,
        // so summarise it and let the dashboard show the per-parish detail.
        const renderValue = (field, value) => {
            if (value === null || value === undefined || value === '') return '—';
            if (field === 'parishFees') return 'see your dashboard for the full parish table';
            if (field === 'isVolumeDiscount') return String(value) === '1' ? 'On' : 'Off';
            return String(value);
        };

        const changeRows = Object.entries(changes).map(([field, { from, to }]) => `
            <tr>
                <td style="padding: 10px 0; color: #666; font-size: 14px; width: 44%; vertical-align: top;">${escapeHtml(fieldLabels[field] || field)}</td>
                <td style="padding: 10px 0; color: #999; font-size: 14px; text-decoration: line-through;">${escapeHtml(renderValue(field, from))}</td>
                <td style="padding: 10px 0; color: #2D413F; font-size: 14px; font-weight: 600;">${escapeHtml(renderValue(field, to))}</td>
            </tr>
        `).join('');

        const mailOptions = {
            from: DEFAULT_FROM,
            to: email,
            subject: retired
                ? 'A rate card on your VerShip account was retired'
                : 'Your VerShip pricing was updated by an administrator',
            html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 35px rgba(0,0,0,0.15);">
                <div style="background: linear-gradient(135deg, #FFBF00 0%, #FFD864 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #2D413F; font-size: 28px; font-weight: bold;">VerShip</h1>
                    <p style="margin: 10px 0 0; color: #2D413F; font-size: 14px; opacity: 0.85;">The Smart Way to Ship</p>
                </div>
                <div style="padding: 40px 30px; background: #ffffff;">
                    <h2 style="color: #2D413F; margin: 0 0 10px 0; font-size: 22px;">
                        ${retired ? 'A rate card was retired' : 'Your pricing was updated'}${businessName ? ` — ${escapeHtml(businessName)}` : ''}
                    </h2>
                    <p style="color: #666; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px;">
                        A VerShip administrator ${retired ? 'retired one of your rate cards' : 'updated your rate card'}
                        ${route ? ` for <strong>${escapeHtml(route)}</strong>` : ''}${barrelType ? ` (${escapeHtml(barrelType)})` : ''}.
                        ${retired
                            ? 'It will no longer be offered on new quotes.'
                            : 'The new figures apply to new quotes from now on.'}
                        Orders already placed keep the price they were booked at.
                    </p>
                    ${changeRows ? `
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 8px 20px; border: 1px solid #e8eceb;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <th style="text-align: left; padding: 8px 0; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Field</th>
                                <th style="text-align: left; padding: 8px 0; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Was</th>
                                <th style="text-align: left; padding: 8px 0; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Now</th>
                            </tr>
                            ${changeRows}
                        </table>
                    </div>` : ''}
                    ${reason ? `
                    <p style="color: #666; line-height: 1.6; margin: 24px 0 0 0; font-size: 14px;">
                        <strong style="color: #2D413F;">Reason given:</strong> ${escapeHtml(reason)}
                    </p>` : ''}
                    <p style="color: #666; line-height: 1.6; margin: 24px 0 0 0; font-size: 14px;">
                        You can review your full pricing any time under your business profile. If this change looks wrong,
                        reply to this email and we'll take another look.
                    </p>
                </div>
                <div style="background: #f8f9fa; padding: 18px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0; font-size: 12px; color: #999;">&copy; ${new Date().getFullYear()} VerShip. All rights reserved.</p>
                </div>
            </div>
            `,
        };

        const info = await deliver(mailOptions);
        console.log('✅ Pricing-change notice sent to forwarder: %s', email);
        return info;
    } catch (error) {
        console.error('❌ Error sending pricing-change notice:', error);
        throw error;
    }
},

// ─── Held payouts ────────────────────────────────────────────────────────────
// Forwarder has money waiting but no working Stripe account. Sent on a schedule
// by helper/payoutService.js (day 1, 3, 7, then weekly) and once per new booking.
// `newPayment` set → sent the moment a customer pays (reminderNumber 0);
// otherwise it is a scheduled reminder (day 1/3/7/weekly).
sendPayoutReminderEmail: async (email, { forwarderName, amount, orderIds = [], reminderNumber = 1, heldSinceDays = 0, newPayment = null }) => {
    try {
        const orders = orderIds.length ? orderIds.map(escapeHtml).join(', ') : 'your recent booking';
        const mailOptions = {
            from: DEFAULT_FROM,
            to: email,
            subject: newPayment
                ? `New booking paid: $${newPayment} — set up payouts to collect it`
                : `$${amount} is waiting for you — set up payouts to collect it`,
            html: shell({
                tagline: newPayment ? 'You have a new paid booking' : 'Payment waiting for you',
                body: `
                    <h2 style="color: #2D413F; margin: 0 0 10px 0; font-size: 22px;">Hi ${escapeHtml(forwarderName)},</h2>
                    <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0; font-size: 15px;">
                        ${newPayment
                            ? `A customer just paid <strong>$${escapeHtml(newPayment)}</strong> for ${orders}. VerShip is holding it for you until you set up payouts —`
                            : `Customers have paid for ${orders}. VerShip is holding your share until you set up payouts —`}
                        it takes about five minutes and the money is transferred to you as soon as you finish.
                    </p>
                    ${amountBox(heldSinceDays > 0 ? `Held for you (${heldSinceDays} day${heldSinceDays === 1 ? '' : 's'})` : 'Held for you', amount)}
                    ${cta(`${appBaseUrl()}/businessProfile`, 'Set up payouts')}
                    <p style="color: #999; line-height: 1.6; margin: 15px 0 0; font-size: 13px; text-align: center;">
                        ${reminderNumber > 1 ? `This is reminder ${reminderNumber}. ` : ''}Already done it? Open your profile and press "Collect funds".
                    </p>`,
            }),
        };
        const info = await deliver(mailOptions);
        console.log('✅ Payout reminder sent to forwarder: %s ($%s)', email, amount);
        return info;
    } catch (error) {
        console.error('❌ Error sending payout reminder:', error);
        throw error;
    }
},

// Plain operational alert to the admin (failed transfers, 30-day escalations).
sendAdminAlertEmail: async (email, { subject, text }) => {
    const mailOptions = {
        from: DEFAULT_FROM,
        to: email,
        subject: `[VerShip admin] ${subject}`,
        html: shell({
            tagline: 'Admin alert',
            body: `<p style="color: #2D413F; line-height: 1.7; margin: 0; font-size: 15px;">${escapeHtml(text)}</p>${cta(`${appBaseUrl()}/admin/payouts`, 'Open payouts')}`,
        }),
    };
    const info = await deliver(mailOptions);
    console.log('✅ Admin alert sent: %s', subject);
    return info;
},

// ─── Pay as Your Shipment Moves ──────────────────────────────────────────────
// The forwarder marked the shipment Arrived in Jamaica: customs & delivery is now due.
sendMilestoneDueEmail: async (email, { customerName, businessName, orderId, amount, description }) => {
    try {
        const mailOptions = {
            from: DEFAULT_FROM,
            to: email,
            subject: `Your barrel has arrived — $${amount} customs & delivery is now due (${orderId})`,
            html: shell({
                tagline: 'Your shipment has arrived in Jamaica',
                body: `
                    <h2 style="color: #2D413F; margin: 0 0 10px 0; font-size: 22px;">Hi ${escapeHtml(customerName)},</h2>
                    <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0; font-size: 15px;">
                        <strong>${escapeHtml(businessName)}</strong> has confirmed that order <strong>${escapeHtml(orderId)}</strong> has arrived in Jamaica.
                        As explained at checkout, the remaining charge is due now so your barrel can clear customs and be delivered.
                    </p>
                    ${amountBox(description, amount)}
                    ${cta(`${appBaseUrl()}/history`, 'Pay now')}
                    <p style="color: #999; line-height: 1.6; margin: 15px 0 0; font-size: 13px; text-align: center;">
                        Sign in and open My History to pay. Questions about the amount? Message your forwarder from the order.
                    </p>`,
            }),
        };
        const info = await deliver(mailOptions);
        console.log('✅ Milestone-due email sent to customer: %s', email);
        return info;
    } catch (error) {
        console.error('❌ Error sending milestone-due email:', error);
        throw error;
    }
},

// ─── Guest checkout ──────────────────────────────────────────────────────────
// Receipt for a customer whose account was created at checkout; carries the
// tokenised "set your password" link (24h) in case they skipped it on the page.
sendGuestReceiptEmail: async (email, { customerName, orderId, businessName, paidNow, laterEstimate, setupUrl }) => {
    try {
        const mailOptions = {
            from: DEFAULT_FROM,
            to: email,
            subject: `Payment received for order ${orderId} — VerShip`,
            html: shell({
                tagline: 'Thanks for shipping with VerShip',
                body: `
                    <h2 style="color: #2D413F; margin: 0 0 10px 0; font-size: 22px;">Hi ${escapeHtml(customerName)},</h2>
                    <p style="color: #666; line-height: 1.6; margin: 0 0 15px 0; font-size: 15px;">
                        We've received your payment for order <strong>${escapeHtml(orderId)}</strong> with <strong>${escapeHtml(businessName)}</strong>.
                    </p>
                    ${amountBox('Paid today', paidNow)}
                    ${laterEstimate && parseFloat(laterEstimate) > 0 ? `<p style="color: #666; line-height: 1.6; margin: 0 0 15px 0; font-size: 14px;">Estimated customs &amp; delivery of <strong>$${escapeHtml(laterEstimate)}</strong> is <em>not</em> due yet — we'll email you when your barrel arrives in Jamaica.</p>` : ''}
                    <p style="color: #666; line-height: 1.6; margin: 15px 0 0; font-size: 15px;">
                        We created a VerShip account for <strong>${escapeHtml(email)}</strong> so you can track this shipment. Set a password to sign in:
                    </p>
                    ${cta(setupUrl, 'Set your password')}
                    <p style="color: #999; line-height: 1.6; margin: 15px 0 0; font-size: 13px; text-align: center;">This link works for 24 hours. If it expires, use "Forgot password" on the sign-in page.</p>`,
            }),
        };
        const info = await deliver(mailOptions);
        console.log('✅ Guest receipt sent: %s', email);
        return info;
    } catch (error) {
        console.error('❌ Error sending guest receipt:', error);
        throw error;
    }
},
};
