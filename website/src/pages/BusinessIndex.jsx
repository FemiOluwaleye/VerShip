import React from 'react'
import Banner from '../components/Banner'
import Shiping from '../components/Shiping'
import Support from '../components/Support'
import Testimonials from '../components/Testimonials'
import Faq from '../components/Faq'
import Contact from '../components/Contact'

const BusinessIndex = () => {
  return (
   <>
   
   <Banner/>
   <Shiping/>
   <Support/>
   <Testimonials/>
   <Faq show={false}/>
   <Contact/>
   </>
  )
}

export default BusinessIndex
