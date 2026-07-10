import React from 'react'
import { message1,message2 } from '../common/common-assets/assets-images'
const Messages = ({ activeChat, setActiveChat }) => {
   
    const message = [
       {
        id: 1,
        img : message1,
        name : "John",
        about : "Great! Thank you so much",
        time : "10:30pm"
       },
              {
        id: 2,
        img : message2,
        name : "John Martin",
        about : "Great! Thank you so much",
        time : "1:00pm"
       },
              {
        id: 3,
        img : message1,
        name : "John",
        about : "Great! Thank you so much",
        time : "12:30pm"
       },
              {
        id: 4,
        img : message2,
        name : "John Martin",
        about : "Great! Thank you so much",
        time : "9:30am"
       },
              {
        id: 5,
        img : message1,
        name : "John",
        about : "Great! Thank you so much",
        time : "4:30pm"
       },
              {
        id: 6,
        img : message2,
        name : "John Martin",
        about : "Great! Thank you so much",
        time : "8:30pm"
       },
    ]

  return (
    <div   className={`w-full lg:w-[40%] bg-[#2D413F] rounded-[10px] overflow-y-auto 
  ${activeChat ? "hidden lg:block" : "block"}`}>
      <div className='w-full p-8'>
        <input type="search" className='bg-white p-5 rounded-[13px] text-[12px] w-full font-normal' placeholder='Search...' name="" id="" />
      </div>
      <div>
        {
          message.map((item)=>(
           <div key={item.id} onClick={()=> setActiveChat(item)} className='flex items-center justify-between text-white border-t border-white/20 px-8'>
            <div className='flex items-center justify-center gap-3  py-5'>
              <div><img className='w-[70px] h-[70px]' src={item.img} alt="" /></div>
              <div className='space-y-2'><p className='text-[15px] font-semibold'>John</p><p className='text-[11px] font-normal'>Great! Thank you so much</p></div>
            </div>
            <div className='text-[10px] font-semibold'>{item.time}</div>
           </div>

          ))
        }
      </div>
    </div>
  )
}

export default Messages
