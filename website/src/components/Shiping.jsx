import React from 'react'
import { ship2 } from '../common/common-assets/assets-images'

const Shiping = () => {
  return (
    <>
      <section className='bg-[#0E1614]'>
        <div className="container mx-auto  text-white">
          <div className='flex items-center justify-center gap-10 py-15 flex-col lg:flex-row'>
            <div className='w-full lg:w-[50%]'><img src={ship2} alt="" /></div>
            <div className='w-full lg:w-[50%]'><p className='text-[23px] sm:text-[30px] md:text-[35px] font-semibold'>Shipping with us is as easy as booking your next flight</p>
              <p className='text-[14px] sm:text-[16px] font-medium opacity-80 mt-3'>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type. Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default Shiping
