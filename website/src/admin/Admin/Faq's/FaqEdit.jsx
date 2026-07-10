import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { axiosInstance } from "../../Config";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Link } from "react-router-dom";

const FaqEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState({ question: "", answer: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questionError, setQuestionError] = useState("");
  const [answerError, setAnswerError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axiosInstance.get(`/faqdetail/${id}`);
        if (response.data.success) {
          setData(response.data.body);
        } else {
          setError("Failed to fetch FAQ data.");
        }
      } catch {
        setError("Error fetching FAQ data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const validateQuestion = (question) => {
    const trimmedQuestion = question.trim();
    const errors = [];

    if (!trimmedQuestion) {
      errors.push("Question is required.");
    } else {
      if (trimmedQuestion.length < 2 || trimmedQuestion.length > 1000)
        errors.push("Question must be between 2 and 1000 characters.");
    }

    setQuestionError(errors.join(" "));
    return errors.length === 0;
  };

  const validateAnswer = (answer) => {
    const trimmedAnswer = answer.trim();
    const errors = [];

    if (!trimmedAnswer) {
      errors.push("Answer is required.");
    } else {
      if (trimmedAnswer.length < 2 || trimmedAnswer.length > 5000)
        errors.push("Answer must be between 2 and 5000 characters.");
    }

    setAnswerError(errors.join(" "));
    return errors.length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "question") {
      setData((prev) => ({ ...prev, question: value }));
      validateQuestion(value);
    } else if (name === "answer") {
      setData((prev) => ({ ...prev, answer: value }));
      validateAnswer(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isQuestionValid = validateQuestion(data.question);
    const isAnswerValid = validateAnswer(data.answer);

    if (!isQuestionValid || !isAnswerValid) return;

    try {
      const response = await axiosInstance.post(`/FAQUpdate/${id}`, {
        question: data.question.trim(),
        answer: data.answer.trim(),
      });

      if (response.data.success) {
        toast.success("FAQ updated successfully!");
        setTimeout(() => navigate("/admin/faqlist"), 1000);
      } else {
        toast.error(response.data.message || "Failed to update FAQ.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error updating FAQ.");
    }
  };


  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <>
      <div id="layout-wrapper">
        <div className="main-content">
          <div className="page-content">
            <div className="container-fluid">
              <div className="title-box mb-3 pb-1">
                <h4 className="mb-0 page-title">Edit FAQ</h4>
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
                            name="question"
                            value={data.question}
                            onChange={handleChange}
                            rows="4"
                            maxLength={1000}
                          />
                          {questionError && (
                            <div className="text-danger">{questionError}</div>
                          )}
                        </div>

                        <div className="mb-3">
                          <label className="mb-1 fw-medium">Answer</label>
                          <textarea
                            className="form-control"
                            name="answer"
                            value={data.answer}
                            onChange={handleChange}
                            rows="6"
                            maxLength={5000}
                          />
                          {answerError && (
                            <div className="text-danger">{answerError}</div>
                          )}
                        </div>

                        <div className="d-flex justify-content-end">
                          <Link
                            type="button"
                            className="btn btn-secondary mx-2"
                            to="/admin/faqlist"
                          >
                            Back
                          </Link>

                          <button
                            type="submit"
                            className="btn btn-primary px-4"
                          >
                            Update FAQ
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

export default FaqEdit;
