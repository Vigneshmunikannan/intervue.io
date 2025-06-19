import React from 'react';

function History({ history, socket }) {
    console.log(history);

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
    return (
        <div className="history-page bg-[#ffffff]">
            <h2 className="text-[26px] font-bold mb-6 text-center">View Poll History</h2>
            <div className="flex justify-end ml-[45px] mt-[10px] w-[727px] mx-auto mb-[50px]">
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
            {history && history.length > 0 ? (
                history.map((results, idx) => (
                    <div
                        key={results.questionId || idx}
                        className="w-[727px] rounded-[12px] p-0 overflow-hidden mb-8 mx-auto mb-[100px]"
                    >
                        <h3 className="text-[22px] font-semibold mb-3 mt-4 ml-6">Question {results.questionNumber}</h3>
                        <div
                            className="question-bg h-[50px] text-[17px] text-[#ffffff] font-semibold flex items-center pl-[30px]"
                            style={{ borderRadius: '12px 12px 0 0' }}
                        >
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
                ))
            ) : (
                <p className="error-message text-center">No poll history available.</p>
            )}

            <style>{`
        .history-page {
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

export default History;