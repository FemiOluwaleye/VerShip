import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import NoInternet from './NoInternet';
import Login from './Admin/Login';
import Dashboard from './Admin/Dashboard';
import Layout from './Admin/Common/Layout';
import PrivateRoute from './PrivateRoute';
import Profile from './Admin/Profile';
import Password from './Admin/Password';
import ContactList from './Admin/Contactus/ContactList';
import PrivacyPolicy from './Admin/Cms/PrivacyPolicy';
import AboutUs from './Admin/Cms/AboutUS';
import TermsConditions from './Admin/Cms/TermsConditions';
import CookiePolicy from './Admin/Cms/CookiePolicy';
import FreightForwarderAgreement from './Admin/Cms/FreightForwarderAgreement';
import RefundPolicy from './Admin/Cms/RefundPolicy';
import FaqList from './Admin/Faq\'s/FaqList';
import FaqAdd from './Admin/Faq\'s/FaqAdd';
import FaqEdit from './Admin/Faq\'s/FaqEdit';
import RatingList from './Admin/Ratings/RatingList';
import UserList from './Admin/Users/UserList';
import ReportList from './Admin/Reports/ReportList';
import BannerList from './Admin/Banners/BannnerList';
import BannerAdd from './Admin/Banners/BannerAdd';
import BannerEdit from './Admin/Banners/BannerEdit';
import ActiveBookingList from './Admin/Bookings/ActiveBookingList';
import BookingCompleted from './Admin/Bookings/BookingCompleted';
import Bookinglist from './Admin/Bookings/BookingList';
import ProviderList from './Admin/Providers/ProvidersListing';
import CookieList from './Admin/Cookies/CookieList';
import CookieAdd from './Admin/Cookies/CookieAdd';
import CookieEdit from './Admin/Cookies/CookieEdit';



const App = () => {
  const isAuthenticated = localStorage.getItem("admin_token");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return <NoInternet />;
  }
  return (
    <>
      <Router>
        <Routes>
          <Route path='/login' element={<Login />} />
          <Route path='/' element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<PrivateRoute element={<Dashboard />} />} />
            <Route path="/profile" element={<PrivateRoute element={<Profile />} />} />
            <Route path="/password" element={<PrivateRoute element={<Password />} />} />
            <Route path="/userlist" element={<PrivateRoute element={<UserList />} />} />
            <Route path="/providerlist" element={<PrivateRoute element={<ProviderList />} />} />
            <Route path="/contactlist" element={<PrivateRoute element={<ContactList />} />} />
            <Route path="/privacypolicy" element={<PrivateRoute element={<PrivacyPolicy />} />} />
            <Route path="/aboutus" element={<PrivateRoute element={<AboutUs />} />} />
            <Route path="/termsConditions" element={<PrivateRoute element={<TermsConditions />} />} />
            <Route path="/cookiepolicy" element={<PrivateRoute element={<CookiePolicy />} />} />
            <Route path="/freightforwarder" element={<PrivateRoute element={<FreightForwarderAgreement />} />} />
            <Route path="/refundpolicy" element={<PrivateRoute element={<RefundPolicy />} />} />
            <Route path="/faqlist" element={<PrivateRoute element={<FaqList />} />} />
            <Route path="/addfaq" element={<PrivateRoute element={<FaqAdd />} />} />
            <Route path="/updatefaq/:id" element={<PrivateRoute element={<FaqEdit />} />} />
            <Route path="/activeridelist" element={<PrivateRoute element={<ActiveBookingList />} />} />
            <Route path="/ratinglist" element={<PrivateRoute element={<RatingList />} />} />
            <Route path="/reportlist" element={<PrivateRoute element={<ReportList />} />} />
            <Route path="/bannerlist" element={<PrivateRoute element={<BannerList />} />} />
            <Route path="/addbanner" element={<PrivateRoute element={<BannerAdd />} />} />
            <Route path="/updatebanner/:id" element={<PrivateRoute element={<BannerEdit />} />} />
            <Route path="/cookielist" element={<PrivateRoute element={<CookieList />} />} />
            <Route path="/addcookie" element={<PrivateRoute element={<CookieAdd />} />} />
            <Route path="/updatecookie/:id" element={<PrivateRoute element={<CookieEdit />} />} />
            <Route path="/bookingcompleted" element={<PrivateRoute element={<BookingCompleted />} />} />
            <Route path="/Bookinglist" element={<PrivateRoute element={<Bookinglist />} />} />
          </Route>
        </Routes>

      </Router>

    </>
  )
}

export default App
