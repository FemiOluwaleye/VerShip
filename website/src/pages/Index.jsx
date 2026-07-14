import React from 'react'
import Seo from '../components/Seo'
import Banner from '../components/Banner'
import HowItWorks from '../components/HowItWorks'
import MoveBusinessForward from '../components/MoveBusinessForward'
import BookingProcess from '../components/BookingProcess'
import ClientTestimonials from '../components/ClientTestimonials'
import TopForwarders from '../components/TopForwarders'
import Shiping from '../components/Shiping'
import Support from '../components/Support'
// import Testimonials from '../components/Testimonials'
import Faq from '../components/Faq'
import Contact from '../components/Contact'
import TrustBar from '../components/TrustBar'
import { Navigate } from "react-router-dom";
import processFlow from '../assets/booking-process-flow.png'





import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';

const Index = () => {
  const location = useLocation();

  React.useEffect(() => {
    if (location.state?.message) {
      toast.error(location.state.message, { id: 'auth-error' });
      // Optional: Clear state to avoid toast on every mount/refresh
      window.history.replaceState({}, document.title);
    }
    if (location.state?.scrollTo) {
      const element = document.getElementById(location.state.scrollTo);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        // Clear state after scrolling
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state]);

  return (
    <>
      <Seo path="/" />

      <Banner />
      <HowItWorks />
      <MoveBusinessForward />
      <BookingProcess />
      {/* <ClientTestimonials /> */}
      {/* <TopForwarders /> */}
      {/* <div className="container mx-auto px-4 my-10 flex flex-col items-center">
        <img
          src={processFlow}
          alt="Booking to delivery process flow"
          className="w-full max-w-7xl h-auto shadow-xl rounded-2xl"
        />
      </div> */}
      {/* <Shiping /> */}
      {/* <Support /> */}
      {/* <Testimonials /> */}
      {/* <TrustBar /> */}
      {/* <Faq show={false} /> */}
      {/* <Contact /> */}
    </>
  )
}

export default Index
