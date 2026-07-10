var express = require('express');
var router = express.Router();
const middleware = require('../middleware/authtoken');
const authController = require('../controller/apicontroller/authController');
const faqController = require('../controller/apicontroller/faqController');
const bookingController = require('../controller/apicontroller/bookingController');


router.use(middleware.authenticateHeader);
router.get("/getcms", authController.getCmsContent);
//fileupload
router.post('/fileupload', authController.fileUploadDriver)
router.post('/login', authController.login);


router.use(middleware.verifyUser);

router.post("/verifyOtp", authController.verifyOtp);
router.post("/resendotp", authController.resendOTP);
router.post("/deleteaccount", authController.deleteAccount);
router.post("/logout", authController.logout);
router.post('/notificationOnOff', authController.notificationOnOff);
router.post('/createcontact', authController.createContactUs);

//profile
router.post('/createAccount', authController.createAccount);
router.post('/profileedit', authController.editProfile);
router.get('/profileget', authController.getProfile);

//driver vehicle
router.post('/vehicleAdd', authController.vehicleAdd);
router.post('/vehicleedit', authController.vehicleEdit);
router.get('/vehicleget', authController.vehicleGet);

//admin bank details
router.get('/adminbankdetail', authController.bankDetail);

//faq
router.get('/faqlist', faqController.getAllFaqs);
router.get('/faqdetail/:id', faqController.getFaqs);

//home
router.get('/home', authController.home);


//ride search
router.post('/findride', bookingController.findRide);
router.post('/bookride', bookingController.bookRide);

router.post('/accpetreject', bookingController.driverAccptReject);
router.get('/requestList', bookingController.requestList);
router.post('/locationupdate', bookingController.updatedPickupLocation);
router.get('/bookingHistory', bookingController.bookingHistory);

router.get('/bookingdetail/:id', bookingController.bookingDetail);
router.post("/transactionSsHistory", authController.transactionSsHistory);
router.get("/userActiveRide", authController.userActiveRide);

router.post("/cancelRide", bookingController.cancelRide);


module.exports = router;
