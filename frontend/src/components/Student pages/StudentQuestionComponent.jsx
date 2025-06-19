import React, { useState, useEffect } from "react";

const StudentQuestionComponent = ({
    question,
    timeLeft,
    answered,
    onSubmit,
    formatTime,
    socket
}) => {
    const [selected, setSelected] = useState(null);
    const [btn, setBtn] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setSelected(null);
    }, [question?.questionId]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [error]);
    const handleSubmit = (e) => {
        e.preventDefault();
        if (selected !== null && !answered && timeLeft > 0) {
            onSubmit(selected);
            socket.emit("message", JSON.stringify({
                type: "QUESTION_ANSWER",
                payload: {
                    questionId: question.questionId,
                    selectedOption: selected
                }
            }));
        }
    };
    useEffect(() => {
        const handleMessage = (data) => {
            const message = typeof data === 'string' ? JSON.parse(data) : data;

            if (message.type === "ANSWER_ERROR" && message.payload) {
                // Show error to user and keep form data as is
                setError(message.payload.message || "Sumbit Again");
                // Optionally, you can trigger a toast or modal here
            }
            if (message.type === "ANSWER_SUBMITTED" && message.payload) {
                // Show error to user and keep form data as is
                setBtn(false);
                // Optionally, you can trigger a toast or modal here
            }

        };

        socket.on('message', handleMessage);

        return () => {
            socket.off('message', handleMessage);
        };
    }, [socket]);

    if (!question) return null

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[#ffffff]">
            <div className="w-[727px]">
                {/* Header */}
                <div className="flex  items-center mb-4">
                    <h2 className="text-[18px] font-semibold text-black">
                        Question {question.questionNumber}
                    </h2>
                    <div className="flex items-center gap-2 text-[16px] font-bold ml-[25px]">
                        <span>⏱</span>
                        <span className={`${timeLeft <= 10 ? "text-[#cb1206]" : "text-green-500"}`}>
                            {formatTime(timeLeft)}
                        </span>
                    </div>
                </div>

                {/* Question Box */}
                <div className="border-[1.5px] border-[#6766D5] rounded-[12px] overflow-hidden">
                    <div
                        className="h-[50px] text-[17px] text-white font-semibold flex items-center pl-[30px] text-[#ffffff]"
                        style={{ background: "linear-gradient(to left, #6E6E6E, #343434)", borderRadius: "12px 12px 0 0" }}
                    >
                        {question.questionText || "No question text"}
                    </div>

                    {/* Options */}
                    <form onSubmit={handleSubmit} className="px-[20px] py-[16px] bg-white">
                        {question.options.map((option, index) => {
                            const isSelected = selected === index;
                            return (
                                <label
                                    key={index}
                                    className={`relative w-full h-[55px] rounded-[10px] flex items-center mb-[10px] cursor-pointer transition-all duration-150 ${isSelected ? "border-[2px] border-[#7765DA]" : "bg-[#F6F6F6] border border-transparent"
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="option"
                                        value={index}
                                        checked={isSelected}
                                        onChange={() => setSelected(index)}
                                        disabled={answered || timeLeft <= 0}
                                        className="hidden"
                                    />
                                    {/* Index circle */}
                                    <div className="ml-[10px] mr-[14px] w-[28px] h-[28px] bg-white border border-[#6766D5] rounded-full flex items-center justify-center text-[14px] font-semibold text-[#6766D5]">
                                        {index + 1}
                                    </div>

                                    {/* Option text */}
                                    <span className="flex-1 text-[15px] font-medium text-black">
                                        {option.text}
                                    </span>
                                </label>
                            );
                        })}

                        {/* Submit Button */}
                    </form>
                </div>
                {
                    btn && (
                        <button
                            onClick={handleSubmit}
                            type="submit"
                            className="bg-gradient-to-r from-[#8F64E1] to-[#1D68BD] text-white text-[18px] font-bold  rounded-full w-[234px] h-[58px] disabled:opacity-50 border-0 text-[#ffffff] cursor-pointer ml-[65%] mt-[10px]"
                            style={{ background: "#7765DA", color: "#fff" }}
                        >
                            Submit
                        </button>
                    )
                }
            </div>
            {error && (
                <div
                    style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: '#EF4444', // Tailwind red-500
                        color: '#ffffff',
                        padding: '16px 24px',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        zIndex: 9999,
                        fontWeight: '500',
                        minWidth: '260px',
                        textAlign: 'center',
                        animation: 'fadeIn 0.3s ease-in-out'
                    }}
                >
                    {error}
                </div>
            )}
        </div>
    );


};

export default StudentQuestionComponent;
