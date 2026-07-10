const db = require('../../models');
const bcrypt = require('bcryptjs');
const helper = require('../../helper/helper');
const { Validator } = require('node-input-validator');
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { Sequelize } = require('sequelize');

module.exports = {
    // findRide: async (req, res) => {
    //     try {
    //         const userId = req.user.id;
    //         const { pickupLatitude, pickupLongitude, dropLatitude, dropLongitude, pickupLocation, dropLocation } = req.body;

    //         if (!pickupLatitude || !pickupLongitude || !dropLatitude || !dropLongitude) {
    //             return helper.failure(res, 'Pickup and drop coordinates are required.',);
    //         }

    //         const pickupLat = parseFloat(pickupLatitude);
    //         const pickupLng = parseFloat(pickupLongitude);
    //         const dropLat = parseFloat(dropLatitude);
    //         const dropLng = parseFloat(dropLongitude);

    //         if (isNaN(pickupLat) || isNaN(pickupLng) || isNaN(dropLat) || isNaN(dropLng)) {
    //             return helper.failure(res, 'Invalid coordinates provided.',);
    //         }

    //         console.log("Parsed Pickup Coordinates:", pickupLat, pickupLng);
    //         console.log("Parsed Drop Coordinates:", dropLat, dropLng);
    //         console.log("Pickup Address:", pickupLocation || 'Not provided');
    //         console.log("Drop Address:", dropLocation || 'Not provided');

    //         const maxRadius = 30;

    //         const nearbyDrivers = await db.users.findAll({
    //             where: {
    //                 role: '2',
    //             },
    //             include: [{
    //                 model: db.vehicleDetails,
    //                 as: 'vehicleDetail',
    //                 required: true
    //             }],
    //         });

    //         function calculateDistance(lat1, lon1, lat2, lon2) {
    //             const R = 6371;
    //             const dLat = toRad(lat2 - lat1);
    //             const dLon = toRad(lon2 - lon1);
    //             const a =
    //                 Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    //                 Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    //                 Math.sin(dLon / 2) * Math.sin(dLon / 2);
    //             const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    //             return R * c;
    //         }

    //         function toRad(degrees) {
    //             return degrees * (Math.PI / 180);
    //         }

    //         const driversWithDistance = nearbyDrivers
    //             .map(driver => {
    //                 if (!driver.latitude || !driver.longitude) {
    //                     console.log(`Driver ${driver.id} has missing latitude/longitude`);
    //                     return null;
    //                 }

    //                 const driverLat = parseFloat(driver.latitude);
    //                 const driverLng = parseFloat(driver.longitude);

    //                 if (isNaN(driverLat) || isNaN(driverLng)) {
    //                     console.log(`Driver ${driver.id} has invalid coordinates`);
    //                     return null;
    //                 }

    //                 console.log(`Driver ${driver.firstName} ${driver.lastName} Location:`, driverLat, driverLng);

    //                 const distance = calculateDistance(
    //                     pickupLat,
    //                     pickupLng,
    //                     driverLat,
    //                     driverLng
    //                 );

    //                 console.log(`Distance from pickup to driver ${driver.firstName} ${driver.lastName}: ${distance} km`);

    //                 if (distance >= 0 && distance <= maxRadius) {
    //                     const fullName = `${driver.firstName || ''} ${driver.lastName || ''}`.trim();

    //                     return {
    //                         ...driver.toJSON(),
    //                         fullName: fullName,
    //                         distanceFromPickup: distance.toFixed(2),
    //                         distanceUnit: 'km',
    //                         vehicleDetails: driver.vehicleDetail
    //                     };
    //                 }
    //                 return null;
    //             })
    //             .filter(driver => driver !== null)
    //             .sort((a, b) => a.distanceFromPickup - b.distanceFromPickup);

    //         console.log('Drivers within 0-30 km radius:', driversWithDistance.length);

    //         if (driversWithDistance.length === 0) {
    //             return helper.error(res, 'No drivers available within 30 km of your pickup location', 404);
    //         }

    //         return helper.success(res, 'Nearby drivers found', {
    //             userId: userId,
    //             pickupLocation: {
    //                 latitude: pickupLat,
    //                 longitude: pickupLng,
    //                 address: pickupLocation || null
    //             },
    //             dropLocation: {
    //                 latitude: dropLat,
    //                 longitude: dropLng,
    //                 address: dropLocation || null
    //             },
    //             searchRadius: `0-${maxRadius} km`,
    //             totalDriversNearPickup: driversWithDistance.length,
    //             drivers: driversWithDistance.map(driver => ({
    //                 id: driver.id,
    //                 fullName: driver.fullName,
    //                 firstName: driver.firstName,
    //                 lastName: driver.lastName,
    //                 phone: driver.phone,
    //                 profileImage: driver.profileImage,
    //                 vehicleDetails: driver.vehicleDetails,
    //                 latitude: driver.latitude,
    //                 longitude: driver.longitude,
    //                 distanceFromPickup: driver.distanceFromPickup,
    //                 distanceUnit: driver.distanceUnit
    //             }))
    //         });

    //     } catch (error) {
    //         return helper.failure(res, "Something went wrong.");
    //     }
    // },
    findRide: async (req, res) => {
        try {
            const userId = req.user.id;
            const { pickupLatitude, pickupLongitude, dropLatitude, dropLongitude, pickupLocation, dropLocation } = req.body;

            if (!pickupLatitude || !pickupLongitude || !dropLatitude || !dropLongitude) {
                return helper.failure(res, 'Pickup and drop coordinates are required.');
            }

            const pickupLat = parseFloat(pickupLatitude);
            const pickupLng = parseFloat(pickupLongitude);
            const dropLat = parseFloat(dropLatitude);
            const dropLng = parseFloat(dropLongitude);

            if (isNaN(pickupLat) || isNaN(pickupLng) || isNaN(dropLat) || isNaN(dropLng)) {
                return helper.failure(res, 'Invalid coordinates provided.');
            }

            console.log("Parsed Pickup Coordinates:", pickupLat, pickupLng);
            console.log("Parsed Drop Coordinates:", dropLat, dropLng);
            console.log("Pickup Address:", pickupLocation || 'Not provided');
            console.log("Drop Address:", dropLocation || 'Not provided');

            const maxRadius = 30;

            // NEW CODE — FETCH BUSY DRIVERS (status 0,1,2 and request 0)
            const busyDrivers = await db.bookings.findAll({
                where: {
                    status: { [Sequelize.Op.in]: ['0', '1', '2'] },
                    request: '0'
                },
                attributes: ['driverId']
            });
            const busyDriverIds = busyDrivers.map(b => b.driverId);
            // END NEW CODE

            const nearbyDrivers = await db.users.findAll({
                where: {
                    role: '2',
                    id: { [Sequelize.Op.notIn]: busyDriverIds }
                },
                include: [{
                    model: db.vehicleDetails,
                    as: 'vehicleDetail',
                    required: true
                }],
            });

            function calculateDistance(lat1, lon1, lat2, lon2) {
                const R = 6371;
                const dLat = toRad(lat2 - lat1);
                const dLon = toRad(lon2 - lon1);
                const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
            }

            function toRad(degrees) {
                return degrees * (Math.PI / 180);
            }

            const driversWithDistance = nearbyDrivers
                .map(driver => {
                    if (!driver.latitude || !driver.longitude) {
                        console.log(`Driver ${driver.id} has missing latitude/longitude`);
                        return null;
                    }

                    const driverLat = parseFloat(driver.latitude);
                    const driverLng = parseFloat(driver.longitude);

                    if (isNaN(driverLat) || isNaN(driverLng)) {
                        console.log(`Driver ${driver.id} has invalid coordinates`);
                        return null;
                    }

                    console.log(`Driver ${driver.firstName} ${driver.lastName} Location:`, driverLat, driverLng);

                    const distance = calculateDistance(
                        pickupLat,
                        pickupLng,
                        driverLat,
                        driverLng
                    );

                    console.log(`Distance from pickup to driver ${driver.firstName} ${driver.lastName}: ${distance} km`);

                    if (distance >= 0 && distance <= maxRadius) {
                        const fullName = `${driver.firstName || ''} ${driver.lastName || ''}`.trim();

                        return {
                            ...driver.toJSON(),
                            fullName: fullName,
                            distanceFromPickup: distance.toFixed(2),
                            distanceUnit: 'km',
                            vehicleDetails: driver.vehicleDetail
                        };
                    }
                    return null;
                })
                .filter(driver => driver !== null)
                .sort((a, b) => a.distanceFromPickup - b.distanceFromPickup);

            console.log('Drivers within 0-30 km radius:', driversWithDistance.length);

            if (driversWithDistance.length === 0) {
                return helper.error(res, 'No drivers available within 30 km of your pickup location', 404);
            }

            return helper.success(res, 'Nearby drivers found', {
                userId: userId,
                pickupLocation: {
                    latitude: pickupLat,
                    longitude: pickupLng,
                    address: pickupLocation || null
                },
                dropLocation: {
                    latitude: dropLat,
                    longitude: dropLng,
                    address: dropLocation || null
                },
                searchRadius: `0-${maxRadius} km`,
                totalDriversNearPickup: driversWithDistance.length,
                drivers: driversWithDistance.map(driver => ({
                    id: driver.id,
                    fullName: driver.fullName,
                    firstName: driver.firstName,
                    lastName: driver.lastName,
                    phone: driver.phone,
                    profileImage: driver.profileImage,
                    vehicleDetails: driver.vehicleDetails,
                    latitude: driver.latitude,
                    longitude: driver.longitude,
                    distanceFromPickup: driver.distanceFromPickup,
                    distanceUnit: driver.distanceUnit
                }))
            });

        } catch (error) {
            return helper.failure(res, "Something went wrong.");
        }
    },


    bookRide: async (req, res) => {
        try {
            const userId = req.user.id;
            const {
                driverId,
                pickupLocation,
                dropLocation,
                pickupLatitude,
                pickupLongitude,
                dropLatitude,
                dropLongitude,
            } = req.body;

            if (!driverId) {
                return helper.failure(res, 'Driver ID is required.');
            }

            if (!pickupLocation || !dropLocation) {
                return helper.failure(res, 'Pickup and drop locations are required.');
            }

            if (!pickupLatitude || !pickupLongitude || !dropLatitude || !dropLongitude) {
                return helper.failure(res, 'All coordinates are required.');
            }

            const pickupLat = parseFloat(pickupLatitude);
            const pickupLng = parseFloat(pickupLongitude);
            const dropLat = parseFloat(dropLatitude);
            const dropLng = parseFloat(dropLongitude);

            if (isNaN(pickupLat) || isNaN(pickupLng) || isNaN(dropLat) || isNaN(dropLng)) {
                return helper.failure(res, 'Invalid coordinates provided.');
            }

            const driver = await db.users.findOne({
                where: {
                    id: driverId,
                    role: '2'
                },
                include: [{
                    model: db.vehicleDetails,
                    as: 'vehicleDetail',
                    required: true
                }]
            });

            if (!driver) {
                return helper.error(res, 'Driver not found or not available', 404);
            }

            const existingBooking = await db.bookings.findOne({
                where: {
                    userId: userId,
                    status: { [Sequelize.Op.in]: ['0', '1', '2'] },
                    request: '0'
                }
            });

            if (existingBooking) {
                return helper.error(res, 'You already have an active ride request');
            }

            const driverActiveBooking = await db.bookings.findOne({
                where: {
                    driverId: driverId,
                    status: { [Sequelize.Op.in]: ['0', '1', '2'] },
                    request: '0'
                }
            });

            if (driverActiveBooking) {
                return helper.error(res, 'Driver is currently busy with another ride', 400);
            }

            const generateOrderId = () => {
                return Math.floor(100000 + Math.random() * 900000).toString();
            };

            let orderId;
            let isUnique = false;

            while (!isUnique) {
                orderId = generateOrderId();
                const existingOrder = await db.bookings.findOne({
                    where: { orderId: orderId }
                });
                if (!existingOrder) {
                    isUnique = true;
                }
            }

            const newBooking = await db.bookings.create({
                userId: userId,
                driverId: driverId,
                orderId: orderId,
                status: '0',
                pickupLocation: pickupLocation,
                dropLocation: dropLocation,
                pickupLatitude: pickupLatitude.toString(),
                pickupLongitude: pickupLongitude.toString(),
                dropLatitude: dropLatitude.toString(),
                dropLongitude: dropLongitude.toString(),
                request: '0'
            });

            console.log(`Booking created for user ${userId} with driver ${driverId}, Order ID: ${orderId}`);

            return helper.success(res, 'Ride booking request sent successfully', {
                bookingId: newBooking.id,
                orderId: newBooking.orderId,
                userId: userId,
                driverId: driverId,
                status: newBooking.status,
                request: newBooking.request,
                pickupLocation: newBooking.pickupLocation,
                dropLocation: newBooking.dropLocation,
                coordinates: {
                    pickup: {
                        latitude: newBooking.pickupLatitude,
                        longitude: newBooking.pickupLongitude
                    },
                    drop: {
                        latitude: newBooking.dropLatitude,
                        longitude: newBooking.dropLongitude
                    }
                },
                driverDetails: {
                    id: driver.id,
                    fullName: `${driver.firstName} ${driver.lastName}`,
                    phone: driver.phoneNumber,
                    profileImage: driver.image,
                    vehicleDetails: driver.vehicleDetail
                },
                message: 'Waiting for driver to accept your request'
            });

        } catch (error) {
            console.error('Booking error:', error);
            return helper.failure(res, "Something went wrong while booking the ride.");
        }
    },
    driverAccptReject: async (req, res) => {
        try {
            const driverId = req.user.id;
            const { bookingId, request } = req.body;

            if (!bookingId || !request) {
                return helper.failure(res, 'Booking ID and request value are required.');
            }

            if (!['1', '2'].includes(request)) {
                return helper.failure(res, 'Invalid request value. Must be "1" (accept) or "2" (reject).');
            }

            const booking = await db.bookings.findOne({
                where: {
                    id: bookingId,
                    driverId: driverId,
                    status: '0',
                    request: '0'
                }
            });

            if (!booking) {
                return helper.error(res, 'Booking already processed');
            }

            if (request === '1') {
                // Accept → ONLY update request
                await booking.update({ request: request });
            } else {
                // Reject → update request + status = 4
                await booking.update({ request: request, status: 4 });
            }
            const message = request === '1'
                ? 'Booking accepted successfully'
                : 'Booking rejected successfully';

            const actionMessage = request === '1'
                ? 'You have accepted the ride request'
                : 'You have rejected the ride request';

            return helper.success(res, message, {
                bookingId: booking.id,
                request: request,
                message: actionMessage
            });

        } catch (error) {
            return helper.failure(res, "Something went wrong while processing the booking.");
        }
    },
    // driverAccptReject: async (req, res) => {
    //     try {
    //         const driverId = req.user.id;
    //         const { bookingId, request } = req.body;

    //         if (!bookingId || !request) {
    //             return helper.failure(res, 'Booking ID and request value are required.');
    //         }

    //         if (!['1', '2'].includes(request)) {
    //             return helper.failure(res, 'Invalid request value. Must be "1" (accept) or "2" (reject).');
    //         }

    //         const booking = await db.bookings.findOne({
    //             where: {
    //                 id: bookingId,
    //                 driverId: driverId,
    //                 status: '0',
    //                 request: '0'
    //             }
    //         });

    //         if (!booking) {
    //             return helper.error(res, 'Booking already processed');
    //         }

    //         if (request === '1') {
    //             // ACCEPT → update request + status
    //             await booking.update({ request: '1', status: '0' });

    //             // SOCKET EMIT → REFRESH USER
    //             const user = await db.users.findOne({
    //                 where: { id: booking.userId },
    //                 attributes: ['socketId']
    //             });

    //             if (user && user.socketId) {
    //                 io.to(user.socketId).emit("rideStatusUpdated", {
    //                     success: true,
    //                     message: "Driver accepted the ride",
    //                     bookingId: bookingId,
    //                     status: '0'
    //                 });
    //             }

    //         } else {
    //             // REJECT → update request + status
    //             await booking.update({ request: '2', status: '4' });
    //         }

    //         const message = request === '1'
    //             ? 'Booking accepted successfully'
    //             : 'Booking rejected successfully';

    //         const actionMessage = request === '1'
    //             ? 'You have accepted the ride request'
    //             : 'You have rejected the ride request';

    //         return helper.success(res, message, {
    //             bookingId: booking.id,
    //             request: request,
    //             message: actionMessage
    //         });

    //     } catch (error) {
    //         return helper.failure(res, "Something went wrong while processing the booking.");
    //     }
    // },


    requestList: async (req, res) => {
        try {
            const driverId = req.user.id;

            const requests = await db.bookings.findAll({
                where: {
                    driverId: driverId,
                    status: '0',
                    request: '0'
                },
                include: [{
                    model: db.users,
                    as: 'userbook',
                }]
            });

            return helper.success(res, 'Pending ride requests fetched successfully', {
                totalRequests: requests.length,
                requests: requests.map(booking => ({
                    bookingId: booking.id,
                    userId: booking.userId,
                    userDetails: booking.userbook,
                    pickupLocation: booking.pickupLocation,
                    dropLocation: booking.dropLocation,
                    pickupLatitude: booking.pickupLatitude,
                    pickupLongitude: booking.pickupLongitude,
                    dropLatitude: booking.dropLatitude,
                    dropLongitude: booking.dropLongitude,
                    status: booking.status,
                    request: booking.request,
                    bookingDate: booking.bookingDate
                }))
            });

        } catch (error) {
            return helper.failure(res, "Something went wrong while fetching requests.");
        }
    },
    updatedPickupLocation: async (req, res) => {
        try {
            const userId = req.user.id;
            const { bookingId, pickupLocation, pickupLatitude, pickupLongitude } = req.body;

            // if (!bookingId || !pickupLocation || !pickupLatitude || !pickupLongitude) {
            //     return helper.failure(res, 'Booking ID, pickup location, and coordinates are required.');
            // }

            const booking = await db.bookings.findOne({
                where: {
                    id: bookingId,
                    userId: userId,
                    status: '0',
                    request: '1'
                }
            });

            if (!booking) {
                return helper.error(res, 'Booking not found or cannot be updated', 404);
            }

            await booking.update({
                pickupLocation: pickupLocation,
                pickupLatitude: pickupLatitude.toString(),
                pickupLongitude: pickupLongitude.toString()
            });

            return helper.success(res, 'Pickup location updated successfully', {
                bookingId: booking.id,
                pickupLocation: booking.pickupLocation,
                pickupLatitude: booking.pickupLatitude,
                pickupLongitude: booking.pickupLongitude
            });

        } catch (error) {
            return helper.failure(res, "Something went wrong while updating pickup location.");
        }
    },
    bookingHistory: async (req, res) => {
        try {
            const userId = req.user.id;
            const { status } = req.query;

            let statusCondition = {};

            if (status) {
                if (['0', '1', '2'].includes(status)) {
                    statusCondition = { [Sequelize.Op.in]: ['0', '1', '2'] };
                } else if (status === '3') {
                    statusCondition = '3';
                } else if (status === '4') {
                    statusCondition = '4';
                }
            } else {
                statusCondition = { [Sequelize.Op.in]: ['0', '1', '2'] };
            }

            const bookings = await db.bookings.findAll({
                where: {
                    [Sequelize.Op.or]: [
                        { driverId: userId },
                        { userId: userId }
                    ],
                    status: statusCondition
                },
                include: [
                    {
                        model: db.users,
                        as: 'driverbook',
                        include: [{
                            model: db.vehicleDetails,
                            as: 'vehicleDetail',
                            required: false
                        }]
                    },
                    {
                        model: db.users,
                        as: 'userbook',
                    }
                ]
            });

            return helper.success(res, 'Booking history fetched successfully', {
                totalBookings: bookings.length,
                bookings: bookings.map(booking => ({
                    bookingId: booking.id,
                    orderId: booking.orderId,
                    driverId: booking.driverId,
                    driverDetails: booking.driverbook,
                    vehicleDetail: booking.driverbook?.vehicleDetail,
                    userDetails: booking.userbook,
                    pickupLocation: booking.pickupLocation,
                    dropLocation: booking.dropLocation,
                    pickupLatitude: booking.pickupLatitude,
                    pickupLongitude: booking.pickupLongitude,
                    dropLatitude: booking.dropLatitude,
                    dropLongitude: booking.dropLongitude,
                    status: booking.status,
                    request: booking.request,
                    bookingDate: booking.bookingDate
                }))
            });

        } catch (error) {
            console.error('Booking history error:', error);
            return helper.failure(res, "Something went wrong while fetching booking history.");
        }
    },
    bookingDetail: async (req, res) => {
        try {
            const userId = req.user.id;
            const { id } = req.params;

            if (!id) {
                return helper.failure(res, 'Booking ID is required.');
            }

            const booking = await db.bookings.findOne({
                where: {
                    id: id,
                    [Sequelize.Op.or]: [
                        { driverId: userId },
                        { userId: userId }
                    ]
                },
                include: [
                    {
                        model: db.users,
                        as: 'driverbook',
                        include: [{
                            model: db.vehicleDetails,
                            as: 'vehicleDetail',
                            required: false
                        }]
                    },
                    {
                        model: db.users,
                        as: 'userbook',
                    }
                ]
            });

            if (!booking) {
                return helper.error(res, 'Booking not found', 404);
            }

            return helper.success(res, 'Booking details fetched successfully', {
                bookingId: booking.id,
                orderId: booking.orderId,
                driverId: booking.driverId,
                driverDetails: booking.driverbook,
                vehicleDetail: booking.driverbook?.vehicleDetail,
                userDetails: booking.userbook,
                pickupLocation: booking.pickupLocation,
                dropLocation: booking.dropLocation,
                pickupLatitude: booking.pickupLatitude,
                pickupLongitude: booking.pickupLongitude,
                dropLatitude: booking.dropLatitude,
                dropLongitude: booking.dropLongitude,
                status: booking.status,
                request: booking.request,
                bookingDate: booking.bookingDate
            });

        } catch (error) {
            console.error('Ride details error:', error);
            return helper.failure(res, "Something went wrong while fetching ride details.");
        }
    },

    cancelRide: async (req, res) => {
        try {
            const loggedInUserId = req.user.id;
            const loggedInUserRole = req.user.role; // 1=user, 2=driver

            const { bookingId } = req.body;

            if (!bookingId) {
                return helper.failure(res, "Booking ID is required.");
            }

            // Only status 0 or 1 can be cancelled
            const cancellableStatus = ["0", "1"];

            const whereCond = {
                id: bookingId,
                status: { [Op.in]: cancellableStatus }
            };

            // Role-based check
            if (loggedInUserRole === "1") {
                whereCond.userId = loggedInUserId;
            }
            else if (loggedInUserRole === "2") {
                whereCond.driverId = loggedInUserId;
            }
            else {
                return helper.failure(res, "Only users or drivers can cancel a ride.");
            }

            const booking = await db.bookings.findOne({ where: whereCond });

            if (!booking) {
                return helper.failure(res, "Ride cannot be cancelled or already processed.");
            }

            // Update status → 4 = cancelled
            await booking.update({ status: "4" });

            const msg = loggedInUserRole === "1"
                ? "Ride cancelled by user successfully."
                : "Ride cancelled by driver successfully.";

            return helper.success(res, msg, {
                bookingId: booking.id,
                cancelledBy: loggedInUserRole === "1" ? "user" : "driver",
                status: "4",
                message: "Ride has been cancelled."
            });

        } catch (error) {
            console.log(error);
            return helper.failure(res, "Something went wrong while cancelling the ride.");
        }
    }








}