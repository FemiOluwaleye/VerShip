import React from 'react'
import Commonbanner from "../components/Commonbanner";
import { banner, no } from "../common/common-assets/assets-images";

const NoRequest = () => {
  return (
    <div>
            <Commonbanner title="Requests" />
             <div className="py-10 bg-gradient-to-b from-[#1f3b2f] to-[#0b1a14]">
               <div className='container mx-auto'>
                <div className='text-center'>
                    <img src={no} className='mx-auto d-block'></img>
                    <h2 className='text-white md:text-[35px] text-[25px] font-medium'><b>No New Requests</b></h2>
                    </div>
               </div>
             </div>
    </div>
  )
}

export default NoRequest
