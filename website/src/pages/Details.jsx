import React from 'react'
import Commonbanner from "../components/Commonbanner";
import ShipmentDetailsSection from '../components/ShipmentDetailsSection';

const Details = () => {
  return (
    <div>
      <Commonbanner title="Payment Overview" />
      <ShipmentDetailsSection></ShipmentDetailsSection>
    </div>
  )
}

export default Details
