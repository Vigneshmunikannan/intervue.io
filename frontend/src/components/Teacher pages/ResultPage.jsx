import React, { useState, useEffect } from 'react';

function ResultPage({ questiondata, socket }) {
  const [remainingTime, setRemainingTime] = useState(questiondata?.duration || 60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [questionText, setQuestionText] = useState(questiondata?.question || '');
  const [responses, setResponses] = useState([]);
  const [btn, Setbtn] = useState(false);


  const handleSubmit = e => {
    e.preventDefault();
    socket.emit("view-history");
  };

  const handleQuestionasgain = e => {
    e.preventDefault();
    // Emit to backend to trigger POLL_ALREADY_ACTIVE for teacher
    socket.emit("ask-new-question");
}

const handleStoptest = e => {
  e.preventDefault();
  // Emit to backend to stop the test
  socket.emit("stop-test");
}


  useEffect(() => {
    const handleMessage = (data) => {
      const message = typeof data === 'string' ? JSON.parse(data) : data;

      if (message.type === "QUESTION_ADD_ERROR" && message.payload?.startsWith("Failed to save question")) {
        setError("Failed to add question. Please try again.");
        setLoading(false);
      }

      if (message.type === "QUESTION_TIMER_UPDATE") {
        setResponses(message.payload.totalResponses)
        setRemainingTime(message.payload.remainingTime);
      }

      if (message.type === "QUESTION_RESULTS") {

        setResults(message.payload);
        setQuestionText(message.payload.questionText || questionText);
        setLoading(false);
      }
      // QUESTION_ENDED_NOTIFICATION
      if (message.type === "QUESTION_ENDED_NOTIFICATION") {
        Setbtn(true);
        setLoading(false);
      }

    };

    socket.on("message", handleMessage);
    return () => socket.off("message", handleMessage);
  }, [socket, questionText]);

  if (loading) {
    return (
      <div className="waiting-container">
        <div className="waiting-box">
          <h2>⏳ Waiting for Students' Responses...</h2>
          <div className="question-info">
            <p><strong>Question:</strong> {questiondata.questionNumber}. {questiondata?.question}</p>
            <p><strong>Total Students:</strong> {questiondata.studentsCount}</p>
            <p><strong>Current Response:</strong> {responses}</p>
            <p><strong>Time Remaining:</strong> {remainingTime} second{remainingTime !== 1 ? 's' : ''}</p>
          </div>

          <div className="loader-bar">
            <div
              className="loader-fill"
              style={{ width: `${(remainingTime / questiondata.duration) * 100}%` }}
            ></div>
          </div>

          <p className="subtext">Generating results once all students respond or time ends...</p>
        </div>

        <style>{`
        .waiting-container {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 80vh;
          background-color: #f5f9ff;
          font-family: Arial, sans-serif;
        }
        .waiting-box {
          background: #ffffff;
          padding: 30px 40px;
          border-radius: 10px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
          max-width: 500px;
          width: 100%;
          text-align: center;
        }
        .question-info p {
          margin: 8px 0;
          font-size: 1rem;
          color: #444;
        }
        .loader-bar {
          width: 100%;
          height: 12px;
          background-color: #e0e0e0;
          border-radius: 6px;
          overflow: hidden;
          margin: 20px 0;
        }
        .loader-fill {
          height: 100%;
          background-color: #007acc;
          transition: width 1s linear;
        }
        .subtext {
          font-size: 0.9rem;
          color: #777;
        }
      `}</style>
      </div>
    );
  }


  return (
    <div className="result-page bg-[#ffffff]">
      {
        btn && (
          <button
            type="button"
            onClick={handleSubmit} // You can define this function
            className="text-[13px]  transition duration-200 ml-[600px] bg-[#7765DA] text-white text-[16px] font-bold py-2 px-6 rounded-full w-[234px] h-[58px] border[0px] text-[#ffffff] flex items-center justify-center border-[0px] cursor-pointer"
          >
            <svg width="31" height="31" viewBox="0 0 31 31" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_1_502)">
                <path d="M15.5 6.125C9.25 6.125 3.9125 10.0125 1.75 15.5C3.9125 20.9875 9.25 24.875 15.5 24.875C21.7563 24.875 27.0875 20.9875 29.25 15.5C27.0875 10.0125 21.7563 6.125 15.5 6.125ZM15.5 21.75C12.05 21.75 9.25 18.95 9.25 15.5C9.25 12.05 12.05 9.25 15.5 9.25C18.95 9.25 21.75 12.05 21.75 15.5C21.75 18.95 18.95 21.75 15.5 21.75ZM15.5 11.75C13.4312 11.75 11.75 13.4313 11.75 15.5C11.75 17.5688 13.4312 19.25 15.5 19.25C17.5688 19.25 19.25 17.5688 19.25 15.5C19.25 13.4313 17.5688 11.75 15.5 11.75Z" fill="white" />
              </g>
              <defs>
                <clipPath id="clip0_1_502">
                  <rect width="30" height="30" fill="white" transform="translate(0.5 0.5)" />
                </clipPath>
              </defs>
            </svg>

            View Poll History
          </button>
        )
      }
      <h3 className="text-[22px] font-semibold mb-3">Question</h3>

      {/* Main Result Box */}
      <div className="border-[1.5px] border-[#6766D5] w-[727px] rounded-[12px] p-0 overflow-hidden">
        <div className="question-bg h-[50px] text-[17px] text-[#ffffff] font-semibold flex items-center pl-[30px]" style={{ borderRadius: '12px 12px 0 0' }}>
          {results?.questionText || 'No question text available'}
        </div>

        {results && results.options?.length > 0 ? (
          <ul className="results-list px-[20px] py-[16px] bg-white">
            {results.options.map((option, index) => {
              const filledPercentage = option.percentage || 0;

              return (
                <li
                  key={index}
                  className="relative w-full h-[55px] bg-[#F6F6F6] rounded-[10px] overflow-hidden flex items-center mb-[10px]"
                  style={option.isCorrect ? { border: '1px solid #7765DA' } : {}}
                >
                  {/* Filled progress */}
                  <div
                    className="absolute top-0 left-0 h-full"
                    style={{
                      width: `${filledPercentage}%`,
                      backgroundColor: '#6766D5',
                      borderRadius: '10px 0 0 10px',
                    }}
                  ></div>

                  {/* Index circle */}
                  <div
                    className="z-10 mr-4 w-[28px] h-[28px] bg-white border border-[#6766D5] rounded-full flex items-center justify-center text-[14px] font-semibold ml-[10px]"
                  >
                    {index + 1}
                  </div>

                  {/* Option text */}
                  <span
                    className="z-10 flex-1 text-[15px] ml-[10px]"
                    style={{
                      color: filledPercentage > 0 ? '#ffffff' : '#000000',
                    }}
                  >
                    {option.optionText}
                  </span>

                  {/* Percentage */}
                  <span
                    className="z-10 font-semibold text-[15px] mr-[10px]"
                  >
                    {filledPercentage}%
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="error-message">No results available.</p>
        )}
      </div>

      {/* Bottom Buttons - OUTSIDE the box */}
      {btn && (
        <div className="flex justify-end ml-[-3px] mt-[10px] w-[727px] mx-auto">
          <button
            type="button"
            onClick={handleStoptest}
            className="bg-[#EF4444] text-white text-[16px] font-bold py-2 px-6 rounded-full w-[234px] h-[58px] border-[0px] text-[#ffffff] mr-[300px] cursor-pointer"
          >
            Stop Test
          </button>

          <button
            type="button"
            onClick={handleQuestionasgain}
            className="bg-[#7765DA] text-white text-[16px] font-bold py-2 px-6 rounded-full w-[234px] h-[58px] border-[0px] text-[#ffffff] cursor-pointer"
          >
            + Ask a new question
          </button>
        </div>
      )}

      <style>{`
      .result-page {
        max-width: 800px;
        margin: 30px auto;
        padding: 20px;
        font-family: Arial, sans-serif;
      }

      .question-bg {
        background: linear-gradient(to left, #6E6E6E, #343434);
      }

      .error-message {
        background-color: #ffe5e5;
        color: #d8000c;
        padding: 10px;
        margin-top: 20px;
        border-radius: 5px;
        font-weight: bold;
      }
    `}</style>
    </div>
  );



}

export default ResultPage;
