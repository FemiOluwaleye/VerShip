import React, { useState } from 'react'
import Messages from '../components/Messages'
import Screen from '../components/Screen'
import Commonbanner from '../components/Commonbanner'

const Chat = () => {
    const [activeChat, setActiveChat] = useState(null);
  return (
    <>
    <section className='bg-gradient-to-r from-[#244536] via-[#1b352b] to-[#0b1914] '>
      <Commonbanner title="Chat"/>
        <div className="container mx-auto">
         <div className='flex flex-col lg:flex-row justify-center gap-5 py-20'>
            <Messages activeChat={activeChat}
              setActiveChat={setActiveChat}/>
            <Screen activeChat={activeChat}    setActiveChat={setActiveChat}/>
         </div>
        </div>
    </section>
    </>
  )
}

export default Chat
