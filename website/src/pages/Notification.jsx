import React, { useEffect, useState } from 'react'
import Commonbanner from '../components/Commonbanner'
import { getNotifications, clearNotifications } from '../api/cms'
import { toast } from 'sonner'
import moment from 'moment'
import { Loader2 } from 'lucide-react'

const Notification = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await getNotifications();
      if (response.status) {
        setNotifications(response.body);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    try {
      const response = await clearNotifications();
      if (response.status) {
        toast.success("Notifications cleared");
        setNotifications([]);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      toast.error("Failed to clear notifications");
    }
  };

  return (
    <div className='bg-[linear-gradient(180deg,#2C4736_0%,#09120F_100%)] min-h-screen pb-10'>
      <Commonbanner title="Notification" />

      <div className='w-full px-[30px] py-10 pb-20 sm:px-[70px] 2xl:px-[150px] '>
        {notifications.length > 0 && (
          <p
            onClick={handleClearAll}
            className='text-[14px] lg:text-[18px] text-[#F11515] cursor-pointer font-bold flex justify-end underline mb-5'
          >
            Clear All
          </p>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-[#FFC928]" size={40} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-gray-400 mt-10 text-lg">
            No notifications found.
          </div>
        ) : (
          notifications.map((item, index) => (
            <div key={index} className='px-5 xl:px-10 py-5 flex flex-col sm:flex-row rounded-[24px] bg-[#2D413F] gap-5 w-full justify-center items-start my-5 shadow-lg'>
              <div className='w-full space-y-2'>
                <p className='text-[18px] lg:text-[21px] text-white font-medium'>
                  {item.sender ? `${item.sender.firstName} ${item.sender.lastName || ''}` : 'System'}
                </p>
                <p className='text-[#707070] text-[12px] lg:text-[14px] xxl:text-[16px] text-white/70 font-normal'>
                  {item.message}
                </p>
                <p className='text-[#929090] text-[12px] lg:text-[14px] xxl:text-[16px] text-end text-white/50 font-normal'>
                  {moment(item.createdAt).format('MMM DD, YYYY')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Notification
