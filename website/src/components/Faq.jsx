import React, { useEffect, useState } from 'react'
import { FiChevronDown } from "react-icons/fi";
import { arrow } from '../common/common-assets/assets-images';
import Commonbanner from './Commonbanner';
import { toast } from "sonner";
import { getFaqs } from "../api/cms";

const Faq = ({ show = true }) => {
  const [faqs, setFaqs] = useState([]);
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const response = await getFaqs();
        const data = await response;
        console.log("data=------------=--=-=-=>>>>", data);
        if (data.status) {
          setFaqs(data.body);
        }
      } catch (error) {
        console.error('Error fetching faqs:', error);
      }
    };
    fetchFaqs();
  }, []);

  //     const faqs = [
  //   {
  //     id: 1,
  //     question: "Is my information kept confidential?",
  //     answer:
  //       "Yes, all your personal information is kept strictly confidential and protected."
  //   },
  //   {
  //     id: 2,
  //     question: "Do you offer refunds?",
  //     answer:
  //       "Refunds are available based on our refund policy. Please check our terms for details."
  //   },
  //   {
  //     id: 3,
  //     question: "What details are shared with my coach?",
  //     answer:
  //       "Only relevant information required for your session is shared with your coach."
  //   },
  //   {
  //     id: 4,
  //     question: "What payment methods do you accept?",
  //     answer:
  //       "We accept credit cards, debit cards, UPI, and net banking."
  //   },
  //   {
  //     id: 5,
  //     question: "Who has access to my data?",
  //     answer:
  //       "Your data is accessible only to authorized personnel."
  //   },
  //   {
  //     id: 6,
  //     question: "What kind of support do you offer?",
  //     answer:
  //       "We provide email and chat support for all users."
  //   },
  //   {
  //     id: 7,
  //     question: "What is a session?",
  //     answer:
  //       "A session is a one-on-one interaction with your coach."
  //   },
  //   {
  //     id: 8,
  //     question: "Can I get help for a specific issue?",
  //     answer:
  //       "Yes, our coaches can help you with specific concerns."
  //   },
  //   {
  //     id: 9,
  //     question: "How long is a session?",
  //     answer:
  //       "Each session typically lasts 45–60 minutes."
  //   },
  //   {
  //     id: 10,
  //     question: "What if I experience technical problems?",
  //     answer:
  //       "You can contact our support team for immediate assistance."
  //   }
  // ];
  const [activeIndex, setActiveIndex] = useState(null);

  const toggleFaq = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <>
      <section className="bg-[#162121] py-20">
        {show && <Commonbanner title="FAQ's" />}
        <div className="container mx-auto px-4 py-16">

          {!show && (
            <div>
              <p className="text-[23px] sm:text-[30px] md:text-[35px] font-bold text-center text-white mb-8">FAQ's</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-6 py-10">
            {faqs.map((faq, index) => (
              <div
                key={faq.id}
                className="bg-[#1B2625] border border-white/5 px-7 py-8 cursor-pointer transition hover:border-white/20 rounded-xl"
                onClick={() => toggleFaq(index)}
              >
                <div className="flex justify-between gap-2 items-center ">
                  <h3 className="font-semibold text-[16px] sm:text-[18px] lg:text-[21px] text-white">
                    {faq.question}
                  </h3>
                  <div className=''>
                    <img src={arrow} className='w-[14px]' alt="" />

                  </div>
                </div>

                {activeIndex === index && (
                  <p className="mt-4 text-white/50 text-[14px] sm:text-[16px] lg:text-[17px] leading-relaxed">
                    {faq.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default Faq
