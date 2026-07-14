import React, { useState, useEffect } from 'react'
import { FiChevronDown } from "react-icons/fi";
import { arrow2 } from '../common/common-assets/assets-images';
import Commonbanner from '../components/Commonbanner';
import { getFaqs } from "../api/cms";
import Seo from "../components/Seo";



const Faqs = () => {
  // const faqs = [
  //   {
  //     id: 1,
  //     question: "Is my information kept confidential? tftftft ftf tft t",
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
  const [faqs, setFaqs] = useState([]);
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const response = await getFaqs();
        // console.log("data=------------=--=-=-=>>>>", response.body);
        setFaqs(response.body);
      } catch (error) {
        console.error('Error fetching faqs:', error);
      }
    };
    fetchFaqs();
  }, []);
  const toggleFaq = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };


  return (
    <>
      <section className="bg-[linear-gradient(180deg,#2C4736_0%,#09120F_100%)]">
        <Seo title="FAQs" path="/faqs" description="Answers to common questions about shipping barrels from the USA to Jamaica with VerShip — quotes, delivery times, customs, tracking, and pricing." />
        <Commonbanner title="FAQ's" />
        <div className="container mx-auto px-4 py-16">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-20">
            {faqs.map((faq, index) => (
              <div
                key={faq.id}
                className="bg-[#2D413F] shadow border-l-5 border-[#FCC604] px-7 py-8 transition hover:shadow-none transition-shadow duration-300 ease-in-out"
              >
                <h3 className="m-0">
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={activeIndex === index}
                    aria-controls={`faqs-panel-${faq.id}`}
                    id={`faqs-header-${faq.id}`}
                    className="w-full flex justify-between gap-2 items-center text-left cursor-pointer font-semibold text-[16px] sm:text-[18px] lg:text-[23px] text-white"
                  >
                    <span>{faq.question}</span>
                    <img
                      src={arrow2}
                      className={`w-[26px] shrink-0 transition-transform ${activeIndex === index ? 'rotate-180' : ''}`}
                      alt=""
                    />
                  </button>
                </h3>

                {activeIndex === index && (
                  <div id={`faqs-panel-${faq.id}`} role="region" aria-labelledby={`faqs-header-${faq.id}`}>
                    <p className="mt-4 text-white text-[14px] sm:text-[16px] lg:text-[17px]">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default Faqs
