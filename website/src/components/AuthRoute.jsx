// import React from 'react';
// import { Navigate } from 'react-router-dom';

// const AuthRoute = ({ children }) => {
//     const token = localStorage.getItem('token');
//     const storedUserStr = localStorage.getItem("user");
//     let role = null;

//     if (storedUserStr) {
//         try {
//             const storedUser = JSON.parse(storedUserStr);
//             role = storedUser?.role || storedUser?.user?.role;
//             if (role) role = Number(role);
//         } catch (e) {
//             console.error("Error parsing user from localStorage in AuthRoute", e);
//         }
//     }

//     if (token) {
//         if (role == "2") {
//             return <Navigate to="/request" replace />;
//         } else {
//             return <Navigate to="/" replace />;
//         }
//     }

//     return children;
// };

// export default AuthRoute;
import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

import Index from '../pages/Index';
import Signup from '../pages/Signup';
import Login from '../pages/Login';
import Forgot from '../pages/Forgot';
import Verification from '../pages/Verification';
import Profile from '../pages/Profile';
import Quotes from '../pages/Quotes';
import QuotesShipown from '../pages/QuotesShipown';
import Details from '../pages/Details';
import History from '../pages/History';
import Support from '../pages/Support';
import Edit from '../pages/Edit';
import Reset from '../pages/Reset';
import Chat from '../pages/Chat';
import Cards from '../pages/Cards';
import Faqs from '../pages/Faqs';
import Notification from '../pages/Notification';
import About from '../pages/About';
import Terms from '../pages/Terms';
import Privacy from '../pages/Privacy';
import Contact from '../pages/Contact';
import Help from '../pages/Help';
import Type from '../pages/Type';
import BussinessSignup from '../pages/BussinessSignup';
import Verified from '../pages/Verified';
import BussinessProfile from '../pages/BussinessProfile';
import BussinessEdit from '../pages/BussinessEdit';
import BussinessEditNext from '../pages/BussinessEditNext';
import Delete from '../pages/Delete';
import Request from '../pages/Request';
import Earning from '../pages/Earning';
import Current from '../pages/Current';
import Delivered from '../pages/Delivered';
import BusinessDetail from '../pages/BussinessDetail';
import BusinessCreateAccount from '../pages/BussinessCreateAccount';
import BusinessDocument from '../pages/BussinessDocument';
import BuisnessContact from '../pages/BusinessContact';
import BuisnessTime from '../pages/BusinessTime';
import BusinessPolicies from '../pages/BusinessPolicies';
import BuisnessUpload from '../pages/BusinessUpload';
import NoRequest from '../pages/NoRequest';
import BussinessEditContact from '../pages/BusinessEditContact';
import EditNextDocument from '../pages/EditNextDocument';
import BussinessTimeEdit from '../pages/BusinessTimeEdit';
import BusinessPoliciesEdit from '../pages/BusinessPoliciesEdit';
import EditTimelineNext from '../pages/EditTimelineNext';
import BusinessUploadNext from '../pages/BusinessUploadNext';
import BusinessVerification from '../pages/BusinessVerification';
import BarrelRequestForm from '../pages/BarrelRequestForm';
import PrepackedBarrel from '../pages/PrepackedBarrel';
import ForgotPasswordReset from '../pages/ForgotPasswordReset';
import ForgotVerification from '../pages/ForgotVerification';
import ProtectedRoute from '../components/ProtectedRoute';

const AppRoutes = () => {
    /* ---------- ROLE FROM LOCAL STORAGE ---------- */
    const storedUserStr = localStorage.getItem("user");
    console.log("storedUserStr", storedUserStr);
    let storedUser = {};
    try {
        storedUser = JSON.parse(storedUserStr || "{}");
    } catch (e) {
        console.error("Error parsing user from localStorage", e);
        localStorage.clear();
        console.log("Logging out and redirecting to home due to parsing error...");
        // Hard redirect to ensure all state is cleared and AppRoutes re-calculates everything
        window.location.href = "/";
    }

    // Role can be in storedUser.role or storedUser.user.role
    const rawRole = storedUser?.role || storedUser?.user?.role;
    const role = rawRole ? Number(rawRole) : null;
    const token = localStorage.getItem("token");

    // VERIFY: token must be present AND role must be 2 for provider redirection
    const isProvider = !!token && role === 2;

    console.log("AppRoutes DEBUG:", { token: !!token, role, isProvider });


    const isComplete = storedUser?.isProfileComplete == "1" || storedUser?.user?.isProfileComplete == "1" || storedUser?.isProfileComplete == 1 || storedUser?.user?.isProfileComplete == 1;

    console.log("AppRoutes Check:", {
        role,
        isProvider,
        isComplete,
        storedUser
    });

    return (
        <Routes>

            {/* ---------- ROOT (ROLE BASED) ---------- */}
            <Route
                path="/"
                element={
                    isProvider
                        ? <Navigate to="/request" replace />
                        : <Index />
                }
            />

            {/* ---------- AUTH ---------- */}
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/verification" element={<Verification />} />
            <Route path="/forgot-verification" element={<ForgotVerification />} />
            <Route path="/forgot-password-reset" element={<ForgotPasswordReset />} />
            <Route path="/reset" element={<Reset />} />

            {/* ---------- USER ---------- */}
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
            <Route path="/quotes-shipown" element={<ProtectedRoute><QuotesShipown /></ProtectedRoute>} />
            <Route path="/detail" element={<ProtectedRoute><Details /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            <Route path="/edit" element={<ProtectedRoute><Edit /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/cards" element={<ProtectedRoute><Cards /></ProtectedRoute>} />
            <Route path="/faqs" element={<ProtectedRoute><Faqs /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notification /></ProtectedRoute>} />

            {/* ---------- STATIC ---------- */}
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/help" element={<Help />} />

            {/* ---------- BUSINESS ---------- */}
            <Route path="/type" element={<Type />} />
            <Route path="/businessSignup" element={<BussinessSignup />} />
            <Route path="/verified" element={<Verified />} />
            <Route path="/businessProfile" element={<ProtectedRoute><BussinessProfile /></ProtectedRoute>} />
            <Route path="/businessedit" element={<ProtectedRoute><BussinessEdit /></ProtectedRoute>} />
            <Route path="/businesseditnext" element={<ProtectedRoute><BussinessEditNext /></ProtectedRoute>} />
            <Route path="/delete" element={<ProtectedRoute><Delete /></ProtectedRoute>} />

            {/* ---------- DRIVER / PROVIDER ---------- */}
            {/* <Route
                path="/request"
                element={
                    isProvider
                        ? (isComplete
                            ? <Request />
                            : (() => {
                                const step = Number(storedUser?.profile_step || storedUser?.user?.profile_step || 1);
                                const stepRoutes = {
                                    1: "/businessCreateAccount",
                                    2: "/businesscontact",
                                    3: "/businessdoument",
                                    4: "/businesspolicies",
                                    5: "/businesstime",
                                    6: "/businessupload"
                                };
                                return <Navigate to={stepRoutes[step] || "/businessCreateAccount"} replace />;
                            })())
                        : <Navigate to="/" replace />
                }
            /> */}
            <Route path="/request" element={<ProtectedRoute><Request /></ProtectedRoute>} />
            <Route path="/earning" element={<ProtectedRoute><Earning /></ProtectedRoute>} />
            <Route path="/current" element={<ProtectedRoute><Current /></ProtectedRoute>} />
            <Route path="/delivered" element={<ProtectedRoute><Delivered /></ProtectedRoute>} />
            <Route path="/norequest" element={<ProtectedRoute><NoRequest /></ProtectedRoute>} />

            {/* ---------- BUSINESS SETUP ---------- */}
            <Route path="/businessdetail" element={<ProtectedRoute><BusinessDetail /></ProtectedRoute>} />
            <Route path="/businessCreateAccount" element={<ProtectedRoute><BusinessCreateAccount /></ProtectedRoute>} />
            <Route path="/businessdoument" element={<ProtectedRoute><BusinessDocument /></ProtectedRoute>} />
            <Route path="/businesscontact" element={<ProtectedRoute><BuisnessContact /></ProtectedRoute>} />
            <Route path="/businesstime" element={<ProtectedRoute><BuisnessTime /></ProtectedRoute>} />
            <Route path="/businesspolicies" element={<ProtectedRoute><BusinessPolicies /></ProtectedRoute>} />
            <Route path="/businessupload" element={<ProtectedRoute><BuisnessUpload /></ProtectedRoute>} />
            <Route path="/businesseditcontact" element={<ProtectedRoute><BussinessEditContact /></ProtectedRoute>} />
            <Route path="/editnextdocument" element={<ProtectedRoute><EditNextDocument /></ProtectedRoute>} />
            <Route path="/businesseditpolicies" element={<ProtectedRoute><BusinessPoliciesEdit /></ProtectedRoute>} />
            <Route path="/businesstimeedit" element={<ProtectedRoute><BussinessTimeEdit /></ProtectedRoute>} />
            <Route path="/edittimelinenext" element={<ProtectedRoute><EditTimelineNext /></ProtectedRoute>} />
            <Route path="/businessuploadnext" element={<ProtectedRoute><BusinessUploadNext /></ProtectedRoute>} />
            <Route path="/businessverification" element={<BusinessVerification />} />
            <Route path="/barrel-request/:id" element={<BarrelRequestForm />} />
            <Route path="/prepacked-barrel" element={<PrepackedBarrel />} />

        </Routes>
    );
};

export default AppRoutes;
