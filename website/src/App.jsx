import React, { useEffect, Suspense } from 'react'
import { Toaster, toast } from "sonner";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import AppRoutes from './routes/AppRoutes'
// import CookieConsent from './components/CookieConsent'

// The admin dashboard is a separate, code-split chunk (Redux + Bootstrap/jQuery
// theme). Lazy-loading it keeps all of that out of the public site's bundle —
// public visitors never download it.
const AdminApp = React.lazy(() => import('./admin/AdminApp'))

// Public site chrome (Navbar/Footer wrap every public route, but NOT admin).
const PublicLayout = () => (
    <>
        <a href="#main-content" className="skip-to-main">Skip to main content</a>
        <ScrollToTop />
        <Navbar />
        <main id="main-content">
            <AppRoutes />
        </main>
        <Footer />
        {/* <CookieConsent /> */}
    </>
)

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
                <Routes>
                    <Route
                        path="/admin/*"
                        element={
                            <Suspense fallback={<div style={{ padding: 40 }}>Loading admin…</div>}>
                                <AdminApp />
                            </Suspense>
                        }
                    />
                    <Route path="/*" element={<PublicLayout />} />
                </Routes>
            </Router>
            <Toaster richColors position="top-right" />
        </>
    )
}

export default App
