// const admin = require("firebase-admin");
const path = require("path");

// Service account will be loaded in shipone.js, but we can have a fallback or check here
module.exports = {
    sendNotification: async (deviceToken, title, body, data = {}) => {
        /*
        try {
            if (!deviceToken) {
                console.log("No device token provided for notification");
                return;
            }

            const message = {
                notification: {
                    title: title,
                    body: body,
                },
                data: data,
                token: deviceToken,
            };

            const response = await admin.messaging().send(message);
            console.log("Successfully sent notification:", response);
            return response;
        } catch (error) {
            console.error("Error sending notification:", error);
            throw error;
        }
        */
        console.log("Notification suppressed (Firebase disabled)");
        return null;
    },
};
