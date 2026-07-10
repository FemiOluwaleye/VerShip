let db = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;



module.exports = function (io) {
  io.on("connection", function (socket) {
    socket.on("connectUser", async (connectListener) => {
      try {
        const { userId } = connectListener;

        if (!userId) {
          return socket.emit("connectUser", {
            success: false,
            message: "User ID is required",
          });
        }
        const user = await db.users.findOne({
          where: { id: userId },
          raw: true,
        });

        if (!user) {
          return socket.emit("connectUser", {
            success: false,
            message: "User not found",
          });
        }

        await db.users.update(
          {
            socketId: socket.id,
            online: 1,
          },
          {
            where: { id: userId },
          }
        );

        socket.emit("connectUser", {
          success: true,
          message: "Connected successfully",
          socketId: socket.id,
        });
      } catch (error) {
        console.error("Error in connectUser:", error);
        socket.emit("connectUser", {
          success: false,
          message: "Internal server error",
        });
      }
    });
    socket.on("unreadNotificationCount", async (data) => {
      try {
        const { receiverId } = data;

        const unreadCount = await db.notifications.count({
          where: {
            receiverId: receiverId,
            isRead: '0',
          },
          raw: true,
        });

        socket.emit("unreadNotificationCount", {
          successMessage: "Unread count retrieved successfully",
          count: unreadCount,
        });
      } catch (error) {
        socket.emit("unreadNotificationCount", {
          error_message: "Failed to retrieve notification count",
          code: 500,
          error: error.message,
        });
      }
    });
    socket.on("readNotification", async (data) => {
      try {
        const { receiverId } = data;

        const [updatedCount] = await db.notifications.update(
          {
            isRead: '1',
          },
          {
            where: {
              receiverId: receiverId,
              isRead: '0',
            },
          }
        );

        socket.emit("readNotification", {
          successMessage: "Notifications marked as read successfully",
          count: updatedCount,
        });
      } catch (error) {
        console.error("Error marking notifications as read:", error);
        socket.emit("readNotification", {
          error_message: "Failed to mark notifications as read",
          code: 500,
          error: error.message,
        });
      }
    });
    socket.on("updateLocation", async (data) => {
      try {
        const { userId, latitude, longitude, location } = data;

        if (!userId || latitude === undefined || longitude === undefined) {
          return socket.emit("updateLocation", {
            success: false,
            message: "User ID, latitude, and longitude are required"
          });
        }

        const driver = await db.users.findOne({
          where: {
            id: userId,
            role: '2'
          }
        });

        if (!driver) {
          return socket.emit("updateLocation", {
            success: false,
            message: "Driver not found"
          });
        }

        await db.users.update({
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          location: location || null
        }, {
          where: {
            id: userId
          }
        });

        const updatedDriver = await db.users.findOne({
          where: { id: userId },
        });

        socket.emit("updateLocation", {
          success: true,
          message: "Location updated successfully",
          data: {
            driverId: updatedDriver.id,
            latitude: updatedDriver.latitude,
            longitude: updatedDriver.longitude,
            location: updatedDriver.location
          }
        });
        socket.broadcast.emit("updateLocation", {
          driverId: updatedDriver.id,
          latitude: updatedDriver.latitude,
          longitude: updatedDriver.longitude,
          location: updatedDriver.location,
        });

      } catch (error) {
        console.error("Error updating location:", error);
        socket.emit("updateLocation", {
          success: false,
          message: "Something went wrong while updating location",
          error: error.message
        });
      }
    });
    // socket.on("rideStatusUpdate", async (data) => {
    //   try {
    //     const { bookingId, status, otp, driverId } = data;

    //     if (!bookingId || !status || !driverId) {
    //       return socket.emit("rideStatusUpdate", {
    //         success: false,
    //         message: "Booking ID, status, and driver ID are required."
    //       });
    //     }

    //     if (!['0', '1', '2', '3', '4'].includes(status)) {
    //       return socket.emit("rideStatusUpdate", {
    //         success: false,
    //         message: "Invalid status value."
    //       });
    //     }

    //     const booking = await db.bookings.findOne({
    //       where: {
    //         id: bookingId,
    //         driverId: driverId,
    //       },
    //       include: [{
    //         model: db.users,
    //         as: 'userbook',
    //         attributes: ['id', 'rideOtp', 'socketId']
    //       }]
    //     });

    //     if (!booking) {
    //       return socket.emit("rideStatusUpdate", {
    //         success: false,
    //         message: "Booking not found",
    //         code: 404
    //       });
    //     }

    //     const currentStatus = booking.status;

    //     if (status === '2') {
    //       if (currentStatus === '2') {
    //         return socket.emit("rideStatusUpdate", {
    //           success: false,
    //           message: "Ride already started."
    //         });
    //       }

    //       if (!otp) {
    //         return socket.emit("rideStatusUpdate", {
    //           success: false,
    //           message: "OTP is required to start the ride."
    //         });
    //       }

    //       if (!booking.userbook) {
    //         return socket.emit("rideStatusUpdate", {
    //           success: false,
    //           message: "User not found for this booking."
    //         });
    //       }

    //       if (booking.userbook.rideOtp !== otp) {
    //         return socket.emit("rideStatusUpdate", {
    //           success: false,
    //           message: "OTP does not match. Please enter correct OTP."
    //         });
    //       }

    //       await db.bookings.update({
    //         status: status,
    //         otpbooking: otp
    //       }, {
    //         where: { id: bookingId }
    //       });

    //       if (booking.userbook && booking.userbook.socketId) {
    //         io.to(booking.userbook.socketId).emit("rideStatusUpdated", {
    //           success: true,
    //           message: "Ride has started",
    //           bookingId: booking.id,
    //           status: status
    //         });
    //       }

    //       return socket.emit("rideStatusUpdate", {
    //         success: true,
    //         message: "Ride started successfully",
    //         data: {
    //           bookingId: booking.id,
    //           status: status,
    //           otpVerified: true
    //         }
    //       });
    //     }

    //     if (status === '3' || status === '4') {
    //       if (currentStatus !== '2') {
    //         const action = status === '3' ? 'finish' : 'cancel';
    //         return socket.emit("rideStatusUpdate", {
    //           success: false,
    //           message: `Cannot ${action} ride. Ride must be started first (status 2).`
    //         });
    //       }

    //       await booking.update({ status: status });

    //       if (booking.userbook && booking.userbook.socketId) {
    //         io.to(booking.userbook.socketId).emit("rideStatusUpdated", {
    //           success: true,
    //           message: `Ride ${status === '3' ? 'finished' : 'cancelled'} successfully`,
    //           bookingId: booking.id,
    //           status: status
    //         });
    //       }

    //       return socket.emit("rideStatusUpdate", {
    //         success: true,
    //         message: `Ride ${status === '3' ? 'finished' : 'cancelled'} successfully`,
    //         data: {
    //           bookingId: booking.id,
    //           status: status
    //         }
    //       });
    //     }

    //     if (['0', '1'].includes(status)) {
    //       if (currentStatus >= '2') {
    //         return socket.emit("rideStatusUpdate", {
    //           success: false,
    //           message: `Cannot change status to ${status} after ride has started.`
    //         });
    //       }

    //       await booking.update({ status: status });

    //       if (booking.userbook && booking.userbook.socketId) {
    //         io.to(booking.userbook.socketId).emit("rideStatusUpdated", {
    //           success: true,
    //           message: "Ride status updated",
    //           bookingId: booking.id,
    //           status: status
    //         });
    //       }

    //       return socket.emit("rideStatusUpdate", {
    //         success: true,
    //         message: "Ride status updated successfully",
    //         data: {
    //           bookingId: booking.id,
    //           status: status
    //         }
    //       });
    //     }

    //     return socket.emit("rideStatusUpdate", {
    //       success: false,
    //       message: "Invalid status operation."
    //     });

    //   } catch (error) {
    //     console.error("Error updating ride status:", error);
    //     return socket.emit("rideStatusUpdate", {
    //       success: false,
    //       message: "Something went wrong while updating ride status.",
    //       error: error.message
    //     });
    //   }
    // });
    socket.on("rideStatusUpdate", async (data) => {
      try {
        const { bookingId, status, otp, driverId } = data;

        if (!bookingId || !status || !driverId) {
          return socket.emit("rideStatusUpdate", {
            success: false,
            message: "Booking ID, status, and driver ID are required."
          });
        }

        if (!['0', '1', '2', '3', '4'].includes(status)) {
          return socket.emit("rideStatusUpdate", {
            success: false,
            message: "Invalid status value."
          });
        }

        const booking = await db.bookings.findOne({
          where: {
            id: bookingId,
            driverId: driverId,
          },
          include: [{
            model: db.users,
            as: 'userbook',
            attributes: ['id', 'rideOtp', 'socketId']
          }]
        });

        if (!booking) {
          return socket.emit("rideStatusUpdate", {
            success: false,
            message: "Booking not found",
            code: 404
          });
        }

        const currentStatus = booking.status;

        // STATUS 1 → DRIVER ARRIVED AT PICKUP
        if (status === "1") {
          if (currentStatus !== "0") {
            return socket.emit("rideStatusUpdate", {
              success: false,
              message: "Driver can mark arrived only when status is 0."
            });
          }

          await booking.update({ status: "1" });

          // Notify user
          if (booking.userbook && booking.userbook.socketId) {
            io.to(booking.userbook.socketId).emit("rideStatusUpdated", {
              success: true,
              message: "Driver arrived",
              bookingId: booking.id,
              status: "1"
            });
          }

          return socket.emit("rideStatusUpdate", {
            success: true,
            message: "Driver arrived successfully",
            data: {
              bookingId: booking.id,
              status: "1"
            }
          });
        }

        // STATUS 2 → START RIDE (OTP VERIFY)
        if (status === '2') {
          if (currentStatus === '2') {
            return socket.emit("rideStatusUpdate", {
              success: false,
              message: "Ride already started."
            });
          }

          if (!otp) {
            return socket.emit("rideStatusUpdate", {
              success: false,
              message: "OTP is required to start the ride."
            });
          }

          if (!booking.userbook) {
            return socket.emit("rideStatusUpdate", {
              success: false,
              message: "User not found for this booking."
            });
          }

          if (booking.userbook.rideOtp !== otp) {
            return socket.emit("rideStatusUpdate", {
              success: false,
              message: "OTP does not match. Please enter correct OTP."
            });
          }

          await db.bookings.update({
            status: status,
            otpbooking: otp
          }, {
            where: { id: bookingId }
          });

          if (booking.userbook && booking.userbook.socketId) {
            io.to(booking.userbook.socketId).emit("rideStatusUpdated", {
              success: true,
              message: "Ride has started",
              bookingId: booking.id,
              status: status
            });
          }

          return socket.emit("rideStatusUpdate", {
            success: true,
            message: "Ride started successfully",
            data: {
              bookingId: booking.id,
              status: status,
              otpVerified: true
            }
          });
        }

        //  STATUS 3 → FINISHED
        //  STATUS 4 → CANCELLED
        if (status === '3' || status === '4') {
          if (currentStatus !== '2') {
            const action = status === '3' ? 'finish' : 'cancel';
            return socket.emit("rideStatusUpdate", {
              success: false,
              message: `Cannot ${action} ride. Ride must be started first (status 2).`
            });
          }

          await booking.update({ status: status });

          if (booking.userbook && booking.userbook.socketId) {
            io.to(booking.userbook.socketId).emit("rideStatusUpdated", {
              success: true,
              message: `Ride ${status === '3' ? 'finished' : 'cancelled'} successfully`,
              bookingId: booking.id,
              status: status
            });
          }

          return socket.emit("rideStatusUpdate", {
            success: true,
            message: `Ride ${status === '3' ? 'finished' : 'cancelled'} successfully`,
            data: {
              bookingId: booking.id,
              status: status
            }
          });
        }

        // -------------------------------------------------------
        // 📍 STATUS 0 → DRIVER ON THE WAY
        // -------------------------------------------------------
        if (status === "0") {
          if (currentStatus >= "2") {
            return socket.emit("rideStatusUpdate", {
              success: false,
              message: "Cannot change status to 0 after ride has started."
            });
          }

          await booking.update({ status: "0" });

          if (booking.userbook && booking.userbook.socketId) {
            io.to(booking.userbook.socketId).emit("rideStatusUpdated", {
              success: true,
              message: "Driver on the way",
              bookingId: booking.id,
              status: "0"
            });
          }

          return socket.emit("rideStatusUpdate", {
            success: true,
            message: "Driver on the way",
            data: {
              bookingId: booking.id,
              status: "0"
            }
          });
        }

        return socket.emit("rideStatusUpdate", {
          success: false,
          message: "Invalid status operation."
        });

      } catch (error) {
        console.error("Error updating ride status:", error);
        return socket.emit("rideStatusUpdate", {
          success: false,
          message: "Something went wrong while updating ride status.",
          error: error.message
        });
      }
    });


    socket.on("bookingHistory", async (data) => {
      try {
        const { userId, status } = data;

        if (!userId) {
          return socket.emit("bookingHistory", {
            success: false,
            message: "User ID is required"
          });
        }

        let statusCondition = {};

        if (status) {
          if (['0', '1', '2'].includes(status)) {
            statusCondition = { [Op.in]: ['0', '1', '2'] };
          } else if (status === '3') {
            statusCondition = { [Op.in]: ['3', "4"] };
          }
        } else {
          statusCondition = { [Op.in]: ['0', '1', '2'] };
        }

        const bookings = await db.bookings.findAll({
          where: {
            [Op.or]: [
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

        socket.emit("bookingHistory", {
          success: true,
          message: "Booking history fetched successfully",
          data: {
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
          }
        });

      } catch (error) {
        socket.emit("bookingHistory", {
          success: false,
          message: "Something went wrong while fetching booking history.",
          error: error.message
        });
      }
    });

    socket.on("onlineStatusUpdate", async (data) => {
      try {
        const { userId, status } = data;
        // status = '1' => online, status = '0' => offline

        const [updated] = await db.users.update(
          { online: status },
          {
            where: {
              id: userId
            }
          }
        );

        socket.emit("onlineStatusUpdate", {
          successMessage: "Online status updated successfully",
          updated: updated,
          status: status
        });

        // broadcast to others also
        socket.broadcast.emit("userOnlineStatus", {
          userId: userId,
          status: status
        });

      } catch (error) {
        console.error("Error updating online status:", error);
        socket.emit("onlineStatusUpdate", {
          error_message: "Failed to update online status",
          code: 500,
          error: error.message
        });
      }
    });

    // socket.on("user_constant_list1", async (get_data) => {
    //   try {
    //     var query = [
    //       Sequelize.literal(
    //         "(SELECT CONCAT(firstName,lastName) FROM users WHERE users.id  = Receiver_user_id)"
    //       ),
    //       "ReceiverName",
    //     ];
    //     var imgquery = [
    //       Sequelize.literal(
    //         "(SELECT image FROM users WHERE users.id  = Receiver_user_id)"
    //       ),
    //       "Receiverimage",
    //     ];

    //     var query = [
    //       Sequelize.literal(
    //         "(SELECT CONCAT(firstName,lastName) FROM users WHERE users.id  = Receiver_user_id)"
    //       ),
    //       "ReceiverName",
    //     ];
    //     var imgquery = [
    //       Sequelize.literal(
    //         "(SELECT image FROM users WHERE users.id  = Receiver_user_id)"
    //       ),
    //       "Receiverimage",
    //     ];
    //     var onlineStatus = [
    //       Sequelize.literal(
    //         "(SELECT online FROM users WHERE users.id  = Receiver_user_id)"
    //       ),
    //       "online",
    //     ];


    //     let constantList = await db.chat_constant.findAll({
    //       attributes: {
    //         include: [
    //           [
    //             Sequelize.literal(
    //               `CASE WHEN chat_constant.reciever_id = ${get_data.sender_id} THEN chat_constant.sender_id ELSE chat_constant.reciever_id END`
    //             ),
    //             "Receiver_user_id",
    //           ],

    //           [
    //             Sequelize.literal(
    //               `IFNULL((SELECT message FROM message WHERE message.id = chat_constant.lastMessage_id	AND deletedId != ${get_data.sender_id}  ),"")`
    //             ),
    //             "last_msg",
    //           ],

    //           [
    //             Sequelize.literal(
    //               `(SELECT createdAt FROM message where message.reciever_id = chat_constant.reciever_id AND message.sender_id= chat_constant.sender_id ORDER BY id DESC limit 1)`
    //             ),
    //             "CreatedAt",
    //           ],

    //           [
    //             Sequelize.literal(
    //               `(SELECT COUNT(*) FROM message 
    //                 WHERE message.reciever_id = ${get_data.sender_id} 
    //                 AND message.sender_id = Receiver_user_id 
    //                 AND message.readStatus = 0 )`
    //             ),
    //             "unread_msg"
    //           ],


    //           query,
    //           imgquery,
    //           onlineStatus,

    //         ],
    //       },
    //       where: {
    //         [Op.or]: [
    //           { sender_id: get_data.sender_id },
    //           { reciever_id: get_data.sender_id },
    //         ],
    //         deletedId: {
    //           [Op.not]: get_data.sender_id,
    //         },
    //       },
    //       order: [
    //         [
    //           Sequelize.literal(
    //             `(SELECT createdAt FROM message WHERE message.reciever_id = chat_constant.reciever_id AND message.sender_id = chat_constant.sender_id ORDER BY id DESC LIMIT 1)`
    //           ),
    //           'DESC',
    //         ],
    //       ],
    //     });



    //     socket.emit("user_constant_list", constantList);
    //   } catch (error) {
    //     console.log(error);
    //   }
    // });

    // socket.on("send_message1", async (get_data) => {
    //   try {
    //     // Find if there's an existing chat constant
    //     var findConstant = await db.chat_constant.findOne({
    //       where: {
    //         [Op.or]: [
    //           { sender_id: get_data.sender_id, reciever_id: get_data.reciever_id },
    //           { sender_id: get_data.reciever_id, reciever_id: get_data.sender_id },
    //         ],
    //       },
    //       raw: true,
    //     });

    //     let chatConstantId;

    //     // If no chat constant found, create one
    //     if (!findConstant) {
    //       var createConstant = await db.chat_constant.create({
    //         sender_id: get_data.sender_id,
    //         reciever_id: get_data.reciever_id,
    //       });
    //       chatConstantId = createConstant.id;
    //     } else {
    //       chatConstantId = findConstant.id;
    //     }

    //     // Create a new message
    //     var createMessage = await db.message.create({
    //       sender_id: get_data.sender_id,
    //       reciever_id: get_data.reciever_id,
    //       message: get_data.message,
    //       msgType: get_data.msgType,
    //       chatConstant_id: chatConstantId,
    //     });

    //     // Update chat constant with the last message
    //     await db.chat_constant.update(
    //       {
    //         lastMessage_id: createMessage.id,
    //         deletedId: 0,
    //       },
    //       {
    //         where: {
    //           id: chatConstantId,
    //         },
    //       }
    //     );
    //     //////////// Push Notification //////////

    //     ///////////////////////push end //////////////////

    //     // Retrieve message data with user details
    //     var getMsgData = await db.message.findOne({
    //       attributes: {
    //         include: [
    //           [
    //             Sequelize.literal(
    //               "(SELECT CONCAT(firstName,lastName) FROM users WHERE users.id  = message.sender_id)"
    //             ),
    //             "SenderName",
    //           ],
    //           [
    //             Sequelize.literal(
    //               "(SELECT image FROM users WHERE users.id  = message.sender_id)"
    //             ),
    //             "Senderimage",
    //           ],
    //           [
    //             Sequelize.literal(
    //               "(SELECT CONCAT(firstName,lastName) FROM users WHERE users.id  = message.reciever_id)"
    //             ),
    //             "ReceiverName",
    //           ],
    //           [
    //             Sequelize.literal(
    //               "(SELECT image FROM users WHERE users.id  = message.reciever_id)"
    //             ),
    //             "Receiverimage",
    //           ],
    //         ],
    //       },
    //       where: {
    //         id: createMessage.id,
    //       },
    //       raw: true,
    //     });

    //     // Send message to receiver via socket
    //     let socketUser = await db.users.findOne({
    //       where: {
    //         id: get_data.reciever_id,
    //       },
    //       raw: true,
    //     });


    //     if (socketUser) {
    //       io.to(socketUser.socket_id).emit("user_constant_list", null);
    //       io.to(socketUser.socket_id).emit("send_message", getMsgData);

    //     }

    //     // Acknowledge sender
    //     socket.emit("send_message", getMsgData);
    //   } catch (error) {
    //     console.error("Error in send_message:", error);
    //   }
    // });


    // socket.on("get_message_list1", async (get_data) => {
    //   try {
    //     const query = [

    //       Sequelize.literal(
    //         `(SELECT CONCAT(firstName,lastName) FROM users WHERE users.id  = message.reciever_id)`
    //       ),
    //       "ReceiverName",
    //     ];

    //     const imgquery = [
    //       Sequelize.literal(
    //         "(SELECT image FROM users WHERE users.id = message.reciever_id)"
    //       ),
    //       "Receiverimage",
    //     ];

    //     const querys = [
    //       Sequelize.literal(
    //         "(SELECT CONCAT(firstName,lastName) FROM users WHERE users.id = message.sender_id)"
    //       ),
    //       "SenderName",
    //     ];
    //     const imgquerys = [
    //       Sequelize.literal(
    //         "(SELECT image FROM users WHERE users.id = message.sender_id)"
    //       ),
    //       "Senderimage",
    //     ];

    //     const allMsg = await db.message.findAll({
    //       where: {
    //         [Op.or]: [
    //           { sender_id: get_data.sender_id, reciever_id: get_data.reciever_id },
    //           { sender_id: get_data.reciever_id, reciever_id: get_data.sender_id },
    //         ],
    //         deletedId: {
    //           [Op.not]: get_data.sender_id,
    //         },
    //       },
    //       attributes: {
    //         include: [querys, imgquerys, query, imgquery],
    //       },
    //     });



    //     const allMsg1 = {
    //       messageList: allMsg,

    //     };

    //     socket.emit("get_message_list", allMsg1);
    //   } catch (error) {
    //     console.log(error);
    //   }
    // });

    socket.on('cont_unread_msg', async (get_data) => {
      try {

        if (!get_data.reciever_id || !get_data.sender_id) {
          console.error("Invalid sender_id or reciever_id:", get_data);
          return;
        }

        const senderId = Number(get_data.sender_id);
        const receiverId = Number(get_data.reciever_id);

        if (isNaN(senderId) || isNaN(receiverId)) {
          console.error("Invalid sender or receiver ID:", get_data);
          return;
        }

        await db.message.update(
          {
            readStatus: 1,
          },
          {
            where: {
              sender_id: senderId,
              reciever_id: receiverId,
              deletedAt: null,
              readStatus: 0
            },
          }
        );

        socket.emit("cont_unread_msg", { success_message: "Read Status changed successfully" });
      } catch (error) {
        console.error("Error updating read status:", error);
      }
    });
    socket.on("user_constant_list", async (get_data) => {
      try {

        let whereCondition = {
          [Op.or]: [
            { sender_id: get_data.sender_id },
            { reciever_id: get_data.sender_id },
          ],
          deletedId: {
            [Op.not]: get_data.sender_id,
          },
        };

        if (get_data.bookingId) {
          whereCondition.bookingId = get_data.bookingId;
        }

        // Postgres cannot reference a SELECT-list alias (Receiver_user_id) inside
        // sibling subqueries the way MySQL does, so the CASE expression is defined
        // once and inlined everywhere the "other participant" id is needed.
        const receiverExpr = `(CASE WHEN chat_constant.reciever_id = ${get_data.sender_id} THEN chat_constant.sender_id ELSE chat_constant.reciever_id END)`;

        let constantList = await db.chat_constant.findAll({
          attributes: {
            include: [
              [
                Sequelize.literal(receiverExpr),
                "Receiver_user_id",
              ],
              [
                Sequelize.literal(
                  `COALESCE((SELECT message FROM message WHERE message.id = chat_constant."lastMessage_id" AND "deletedId" != ${get_data.sender_id}),'')`
                ),
                "last_msg",
              ],
              [
                Sequelize.literal(
                  `(SELECT "createdAt" FROM message WHERE message.reciever_id = chat_constant.reciever_id AND message.sender_id = chat_constant.sender_id ORDER BY id DESC LIMIT 1)`
                ),
                "CreatedAt",
              ],
              [
                Sequelize.literal(
                  `(SELECT COUNT(*) FROM message
                    WHERE message.reciever_id = ${get_data.sender_id}
                    AND message.sender_id = ${receiverExpr}
                    AND message."readStatus" = 0 )`
                ),
                "unread_msg"
              ],

              // Existing
              [
                Sequelize.literal(
                  `(SELECT CONCAT("firstName","lastName") FROM users WHERE users.id = ${receiverExpr})`
                ),
                "ReceiverName",
              ],
              [
                Sequelize.literal(
                  `(SELECT image FROM users WHERE users.id = ${receiverExpr})`
                ),
                "Receiverimage",
              ],
              [
                Sequelize.literal(
                  `(SELECT online FROM users WHERE users.id = ${receiverExpr})`
                ),
                "online",
              ],
            ],
          },
          where: whereCondition,
          order: [
            [
              Sequelize.literal(
                `(SELECT "createdAt" FROM message WHERE message.reciever_id = chat_constant.reciever_id AND message.sender_id = chat_constant.sender_id ORDER BY id DESC LIMIT 1)`
              ),
              "DESC",
            ],
          ],
        });

        socket.emit("user_constant_list", constantList);
      } catch (error) {
        console.log(error);
      }
    });
    socket.on("send_message", async (get_data) => {
      try {

        let findConstant = await db.chat_constant.findOne({
          where: {
            [Op.or]: [
              { sender_id: get_data.sender_id, reciever_id: get_data.reciever_id },
              { sender_id: get_data.reciever_id, reciever_id: get_data.sender_id },
            ],
            ...(get_data.bookingId && { bookingId: get_data.bookingId }),
          },
          raw: true,
        });

        let chatConstantId;

        if (!findConstant) {
          let createConstant = await db.chat_constant.create({
            sender_id: get_data.sender_id,
            reciever_id: get_data.reciever_id,
            bookingId: get_data.bookingId || null,
          });
          chatConstantId = createConstant.id;
        } else {
          chatConstantId = findConstant.id;
        }

        let createMessage = await db.message.create({
          sender_id: get_data.sender_id,
          reciever_id: get_data.reciever_id,
          message: get_data.message,
          msgType: get_data.msgType,
          chatConstant_id: chatConstantId,
          bookingId: get_data.bookingId || null,
        });

        await db.chat_constant.update(
          {
            lastMessage_id: createMessage.id,
            deletedId: 0,
          },
          { where: { id: chatConstantId } }
        );

        var getMsgData = await db.message.findOne({
          attributes: {
            include: [
              [
                Sequelize.literal(
                  `(SELECT CONCAT("firstName","lastName") FROM users WHERE users.id = message.sender_id)`
                ),
                "SenderName",
              ],
              [
                Sequelize.literal(
                  "(SELECT image FROM users WHERE users.id = message.sender_id)"
                ),
                "Senderimage",
              ],
              [
                Sequelize.literal(
                  `(SELECT CONCAT("firstName","lastName") FROM users WHERE users.id = message.reciever_id)`
                ),
                "ReceiverName",
              ],
              [
                Sequelize.literal(
                  "(SELECT image FROM users WHERE users.id = message.reciever_id)"
                ),
                "Receiverimage",
              ],
            ],
          },
          where: { id: createMessage.id },
          raw: true,
        });

        let socketUser = await db.users.findOne({
          where: { id: get_data.reciever_id },
          raw: true,
        });

        if (socketUser && socketUser.socketId) {
          io.to(socketUser.socketId).emit("user_constant_list", null);
          io.to(socketUser.socketId).emit("send_message", getMsgData);
        }

        socket.emit("send_message", getMsgData);

      } catch (error) {
        console.error(error);
      }
    });
    socket.on("get_message_list", async (get_data) => {
      try {

        let whereCondition = {
          [Op.or]: [
            { sender_id: get_data.sender_id, reciever_id: get_data.reciever_id },
            { sender_id: get_data.reciever_id, reciever_id: get_data.sender_id },
          ],
          deletedId: {
            [Op.not]: get_data.sender_id,
          },
        };

        if (get_data.bookingId) {
          whereCondition.bookingId = get_data.bookingId;
        }

        const allMsg = await db.message.findAll({
          where: whereCondition,
          attributes: {
            include: [
              [
                Sequelize.literal(
                  `(SELECT CONCAT("firstName","lastName") FROM users WHERE users.id = message.sender_id)`
                ),
                "SenderName",
              ],
              [
                Sequelize.literal(
                  "(SELECT image FROM users WHERE users.id = message.sender_id)"
                ),
                "Senderimage",
              ],
              [
                Sequelize.literal(
                  `(SELECT CONCAT("firstName","lastName") FROM users WHERE users.id = message.reciever_id)`
                ),
                "ReceiverName",
              ],
              [
                Sequelize.literal(
                  "(SELECT image FROM users WHERE users.id = message.reciever_id)"
                ),
                "Receiverimage",
              ],
            ],
          },
        });

        socket.emit("get_message_list", { messageList: allMsg });

      } catch (error) {
        console.log(error);
      }
    });


  });
};
