var express = require('express');
var router = express.Router();
const auth = require('../controller/admincontroller/authcontroller');
const authtoken = require('../middleware/authtoken');
const usercontroller = require('../controller/admincontroller/usercontroller');
const provider = require("../controller/admincontroller/providerController");
const contactUsController = require('../controller/admincontroller/contactUsController');
const cmsController = require('../controller/admincontroller/cmsController');
const faqController = require('../controller/admincontroller/faqController');
const tutorialController = require('../controller/admincontroller/tutorialController');
const bookingController = require('../controller/admincontroller/bookingController');
const ratingController = require('../controller/admincontroller/ratingController');
const reportController = require('../controller/admincontroller/reportController');
const bannerController = require('../controller/admincontroller/bannerController');
const cookieController = require('../controller/admincontroller/cookieController');


router.post('/login', auth.login);
router.use(authtoken.verifyToken);
router.get('/profile', auth.profile);
router.post('/updateprofile', auth.editProfile);
router.post('/updatepassword', auth.resetPassword);
router.post('/logout', auth.logout);
router.get('/dashboard', auth.dashboard);
router.post('/chartdata', auth.chartData);
router.get('/metrics', auth.getDashboardMetrics);

// bank details of admin
router.get('/bankdetails', auth.AdminBank);
router.post('/updatebank', auth.updateBankDetails);

// router for users
router.post('/userStatus', usercontroller.userStatus);
router.post('/userDelete/:id', usercontroller.userDelete);
router.get('/userlist', usercontroller.userList);
router.post('/blockstatus', usercontroller.block);
router.post('/suspendstatus', usercontroller.suspend);
router.post('/approvedriver', usercontroller.approveDriver);

//routes for Provider
router.get("/providers", provider.providerList);
router.post("/verify-password", provider.verifyAdminPassword);
router.put("/provider/status", provider.providerStatus);
router.put("/provider/block", provider.providerBlock);
router.put("/provider/suspend", provider.providerSuspend);
router.delete("/provider/:id", provider.providerDelete);
router.put("/provider/document-verify", provider.updateDocumentVerify);
router.put("/provider/update-ranking", provider.updateRanking);
router.get("/download-document", provider.downloadDocument);

// router for contact us
router.get('/contactList', contactUsController.contactGet);
router.get('/contactDetail/:id', contactUsController.contactView);
router.post('/contact/:id', contactUsController.contactDelete);

// router for cms
router.get('/privacypolicy', cmsController.privacy_policy);
router.post('/privacypolicy', cmsController.privacypolicy);
router.get('/aboutus', cmsController.aboutus);
router.post('/aboutus', cmsController.updateabout);
router.get('/termsconditions', cmsController.term);
router.post('/termsconditions', cmsController.updateterm);
router.get('/cookiepolicy', cmsController.cookiepolicy_get);
router.post('/cookiepolicy', cmsController.cookiepolicy_update);
router.get('/freightforwarder', cmsController.freightforwarder_get);
router.post('/freightforwarder', cmsController.freightforwarder_update);
router.get('/refundpolicy', cmsController.refundpolicy_get);
router.post('/refundpolicy', cmsController.refundpolicy_update);

// faqs
router.get('/faqlist', faqController.FAQList);
router.post('/craetefaq', faqController.createFAQ);
router.post("/faqdelete/:id", faqController.FAQDelete);
router.get('/faqdetail/:id', faqController.FAQDetail);
router.post("/FAQUpdate/:id", faqController.FAQUpdate);

//tutorial routes
router.get('/tutoriallist', tutorialController.tutorialList);
router.get('/tutorialdetail/:id', tutorialController.tutorialDetail);
router.post('/tutorialdelete/:id', tutorialController.tutorialDelete);
router.post('/tutorialupdate', tutorialController.tutorialStatus);
router.post('/createtutorial', tutorialController.tutorialCreate);
router.post('/tutorialupdate/:id', tutorialController.tutorialUpdate);
router.post('/imagedelete/:id', tutorialController.imageDelete);

//booking
router.get('/bookinglist', bookingController.bookingList);
router.post('/bookingdelete/:id', bookingController.bookingDelete);
router.get('/activebookinglist', bookingController.activeBookinglist);
router.get('/bookingcompleted', bookingController.bookingCompleted);
router.post('/assignbooking', bookingController.assignBooking);



//rating
router.get('/ratinglist', ratingController.ratingList);
router.post('/ratingdelete/:id', ratingController.ratingDelete);
//report
router.get('/reportlist', reportController.reportList);
router.post('/reportdelete/:id', reportController.reportDelete);

//banner routes 
router.post('/addbanner', bannerController.addBanner);
router.get('/bannerlist', bannerController.bannerList);
router.post('/bannerdelete/:id', bannerController.bannerDelete);
router.post('/bannerupdate/:id', bannerController.bannerUpdate);
router.get('/bannerdetail/:id', bannerController.bannerDetail);

// cookie routes
router.get('/cookielist', cookieController.cookieList);
router.post('/createcookie', cookieController.createCookie);
router.post('/cookiedelete/:id', cookieController.cookieDelete);
router.get('/cookiedetail/:id', cookieController.cookieDetail);
router.post('/cookieupdate/:id', cookieController.updateCookie);


module.exports = router;
