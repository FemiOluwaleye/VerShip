import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { axiosInstance } from "../../Config";
import { Link } from "react-router-dom";

const FaqAdd = () => {
  const [data, setData] = useState({ question: "", answer: "" });
  const [questionError, setQuestionError] = useState("");
  const [answerError, setAnswerError] = useState("");
  const navigate = useNavigate();

  const validateQuestionAndAnswer = () => {
    const errors = [];

    if (!data.question.trim()) {
      errors.push("Question is required.");
    } else if (data.question.length < 2) {
      errors.push("Question must be at least 2 characters long.");
    } else if (data.question.length > 1000) {
      errors.push("Question cannot be longer than 1000 characters.");
    }

    if (!data.answer.trim()) {
      errors.push("Answer is required.");
    } else if (data.answer.length < 2) {
      errors.push("Answer must be at least 2 characters long.");
    } else if (data.answer.length > 5000) {
      errors.push("Answer cannot be longer than 5000 characters.");
    }

    setQuestionError(errors.find((error) => error.includes("Question")) || "");
    setAnswerError(errors.find((error) => error.includes("Answer")) || "");

    return errors.length === 0;
  };

  const handleChange = (e) => {
    const { id, value } = e.target;

    if (id === "question") {
      setData((prev) => ({ ...prev, question: value }));
      setQuestionError("");
      validateQuestionAndAnswer();
    } else if (id === "answer") {
      setData((prev) => ({ ...prev, answer: value }));
      setAnswerError("");
      validateQuestionAndAnswer();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isQuestionAndAnswerValid = validateQuestionAndAnswer();

    if (!isQuestionAndAnswerValid) return;

    const formData = new FormData();
    formData.append("question", data.question.trim());
    formData.append("answer", data.answer.trim());

    try {
      const response = await axiosInstance.post("/craetefaq", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.status === 200 && response.data.success) {
        toast.success("FAQ added successfully!");
        setTimeout(() => navigate("/faqlist"), 1000);
      } else {
        toast.error(response.data.message || "FAQ creation failed.");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Request failed: " + error.message
      );
    }
  };

  return (
    <>
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Add FAQ's</h4>
              </div>
              <div className="row justify-content-center">
                <div className="col-lg-12">
                  <div className="card">
                    <div className="card-body">
                      <form onSubmit={handleSubmit}>
                        <div className="mb-3">
                          <label className="mb-1 fw-medium">Question</label>
                          <textarea
                            className="form-control"
                            id="question"
                            value={data.question}
                            onChange={handleChange}
                            maxLength={1000}
                            rows={4}
                          />
                          {questionError && (
                            <div
                              style={{
                                color: "red",
                                marginTop: "0.25rem",
                                fontSize: "0.875rem",
                              }}
                            >
                              {questionError}
                            </div>
                          )}
                        </div>
                        <div className="mb-3">
                          <label className="mb-1 fw-medium">Answer</label>
                          <textarea
                            className="form-control"
                            id="answer"
                            value={data.answer}
                            onChange={handleChange}
                            maxLength={5000}
                            rows={6}
                          />
                          {answerError && (
                            <div
                              style={{
                                color: "red",
                                marginTop: "0.25rem",
                                fontSize: "0.875rem",
                              }}
                            >
                              {answerError}
                            </div>
                          )}
                        </div>

                        <div className="text-end mb-2">
                          <Link
                            className="btn btn-secondary px-4 mx-2"
                            to="/faqlist"
                          >
                            Back
                          </Link>
                          <button
                            type="submit"
                            className="btn btn-primary px-4"
                          >
                            Add FAQ
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
};

export default FaqAdd;
