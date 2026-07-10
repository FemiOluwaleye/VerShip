import React, { useEffect } from 'react'
import { Toaster, toast } from "sonner";
import { BrowserRouter as Router } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import AppRoutes from './routes/AppRoutes'
// import CookieConsent from './components/CookieConsent'
const user = JSON.parse(localStorage.getItem("user") || "{}");
const role = user?.role;
// console.log("-==========ToastContainer===>>>>>>>>>", ToastContainer)

const App = () => {
    useEffect(() => {
        const deactivationMsg = localStorage.getItem("deactivationMsg");
        if (deactivationMsg) {
            toast.error(deactivationMsg);
            localStorage.removeItem("deactivationMsg");
        }
    }, []);

    return (
        <>
            <Router basename="/">
                <style>
                    {`
            .stripe-link-badge-container, 
            [class*="stripe-link-badge"],
            .__private-stripe-link-badge-container {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
          `}
                </style>
                <ScrollToTop />
                <Navbar />
                <AppRoutes />
                <Footer />
                {/* <CookieConsent /> */}
            </Router>
            <Toaster richColors position="top-right" />
        </>
    )
}

export default App
