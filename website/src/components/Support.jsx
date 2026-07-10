import React from 'react'
import { support, support1, support2, support3 } from '../common/common-assets/assets-images'

const Support = () => {
  return (
    <>
      <section className='bg-[#162121] py-20 text-white'>
        <div className="container mx-auto">
          <div className='flex items-center justify-center gap-10 flex-col lg:flex-row'>
            <img className='w-full lg:w-[50%]' src={support} alt="" />
            <div className='w-full lg:w-[50%] py-5'><p className='text-[23px] sm:text-[30px] md:text-[35px] font-semibold text-white'>Real support from real people</p>
              <p className='text-[14px] sm:text-[16px] font-normal text-white/50'>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book.</p>

              <div className='my-5'>
                <div className='flex items-center justify-start gap-5 my-5'><img className='w-[63px] h-[63px]' src={support1} alt="" /> <p className='text-[20px] font-medium'>24/7 Live Support</p></div>
                <div className='flex items-center justify-start gap-5 my-5'><img className='w-[63px] h-[63px]' src={support2} alt="" /> <p className='text-[20px] font-medium'>Safe Package</p></div>
                <div className='flex items-center justify-start gap-5 my-5'><img className='w-[63px] h-[63px]' src={support3} alt="" /> <p className='text-[20px] font-medium'>Real Shipping Experts</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default Support
