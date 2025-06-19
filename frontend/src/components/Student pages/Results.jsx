import React, { useState, useEffect } from 'react';

function ResultPage({ status,results, socket }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleMessage = (data) => {
      const message = typeof data === 'string' ? JSON.parse(data) : data;

    //   if (message.type === "QUESTION_ADD_ERROR" && message.payload?.startsWith("Failed to save question")) {
    //     setError("Failed to add question. Please try again.");
    //     setLoading(false);
    //   }

      
    };

    socket.on("message", handleMessage);
    return () => socket.off("message", handleMessage);
  }, [socket]);



  return (
    <div className="result-page bg-[#ffffff]">
      <h3 className="text-[22px] font-semibold mb-3">Question {results.questionNumber}</h3>

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
                    style={{
                      color: filledPercentage > 0 ? '#ffffff' : '#000000',
                    }}
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
      <h4 className='text-center'>Wait for the teacher to ask a new question..</h4>

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
