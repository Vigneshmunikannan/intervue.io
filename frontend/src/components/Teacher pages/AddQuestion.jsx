import React, { useState, useEffect } from "react";

const DEFAULT_OPTION = () => ({ text: "", isCorrect: false });

const AddQuestion = ({ firstQuestion, setFirstQuestion, socket }) => {
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState([DEFAULT_OPTION(), DEFAULT_OPTION()]);
    const [duration, setDuration] = useState(60); // seconds
    const [error, setError] = useState(null);

    const handleOptionChange = (idx, value) => {
        setOptions(options =>
            options.map((opt, i) => i === idx ? { ...opt, text: value } : opt)
        );
    };

    const handleStoptest = e => {
        e.preventDefault();
        // Emit to backend to stop the test
        socket.emit("stop-test");
    }

    const handleCorrectChange = (idx, value) => {
        setOptions(options =>
            options.map((opt, i) => i === idx ? { ...opt, isCorrect: value } : opt)
        );
    };

    const addOption = () => {
        setOptions([...options, DEFAULT_OPTION()]);
    };

    const deleteOption = (idx) => {
        if (options.length <= 2) return; // Always keep at least 2 options
        setOptions(options => options.filter((_, i) => i !== idx));
    };
    console.log(error)
    const handleSubmit = e => {
        e.preventDefault();
        setError(null);

        if (!question.trim()) {
            setError("Question cannot be empty.");
            return;
        }
        if (options.some(opt => !opt.text.trim())) {
            setError("All options must have text.");
            return;
        }
        if (!options.some(opt => opt.isCorrect)) {
            setError("Please select at least one correct answer.");
            return;
        }
        console.log(question, options, duration)

        // Emit to socket
        socket.emit("add-question", {
            text: question,
            options,
            duration
        });

        // Reset form
        setQuestion("");
        setOptions([DEFAULT_OPTION(), DEFAULT_OPTION()]);
        setError(null);

        // If this was the first question, setFirstQuestion to false
        if (firstQuestion) setFirstQuestion(false);
    };

    // Hide error message after 4 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    // Socket message handling
    useEffect(() => {
        const handleMessage = (data) => {
            const message = typeof data === 'string' ? JSON.parse(data) : data;

            if (message.type === "QUESTION_ADD_ERROR" && message.payload && message.payload.startsWith("Failed to save question")) {
                // Show error to user and keep form data as is
                setError("Failed to add question. Please try again.");
                // Optionally, you can trigger a toast or modal here
            }
            if (message.type === "NO_STUDENTS_CONNECTED") {
                setError(message.payload.message);
                // Auto clear error after 4 seconds
                setFirstQuestion(true);
                setTimeout(() => setError(null), 4000);
            }

        };

        socket.on('message', handleMessage);

        return () => {
            socket.off('message', handleMessage);
        };
    }, [socket]);
 console.log(firstQuestion)
    return (
        <div>

            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8 mt-8 text-left ml-[100px] mt-[20px]relative">
                {/* Badge */}
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-gradient-to-r from-[#7765DA] to-[#4D0ACD] text-white font-sora font-semibold text-sm h-[31px] w-[134px] "  style={{ marginTop: firstQuestion ? '0px' : '100px' }}>
                    <div className="flex items-center ml-[10px]" >
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12.2762 8.76363C12.2775 8.96965 12.2148 9.17098 12.0969 9.33992C11.979 9.50887 11.8116 9.63711 11.6178 9.707L8.35572 10.907L7.15567 14.1671C7.08471 14.3604 6.95614 14.5272 6.78735 14.645C6.61855 14.7628 6.41766 14.826 6.21181 14.826C6.00596 14.826 5.80506 14.7628 5.63627 14.645C5.46747 14.5272 5.33891 14.3604 5.26794 14.1671L4.06537 10.9111L0.804778 9.71104C0.611716 9.63997 0.445097 9.5114 0.327404 9.34266C0.20971 9.17392 0.146606 8.97315 0.146606 8.76742C0.146606 8.56169 0.20971 8.36092 0.327404 8.19218C0.445097 8.02345 0.611716 7.89487 0.804778 7.82381L4.06688 6.62376L5.26693 3.36418C5.33799 3.17112 5.46657 3.0045 5.6353 2.88681C5.80404 2.76911 6.00482 2.70601 6.21054 2.70601C6.41627 2.70601 6.61705 2.76911 6.78578 2.88681C6.95452 3.0045 7.08309 3.17112 7.15416 3.36418L8.35421 6.62629L11.6138 7.82633C11.8074 7.8952 11.9749 8.02223 12.0935 8.19003C12.2121 8.35782 12.2759 8.55817 12.2762 8.76363ZM8.73923 2.70024H9.7498V3.71081C9.7498 3.84482 9.80303 3.97334 9.89779 4.06809C9.99255 4.16285 10.1211 4.21609 10.2551 4.21609C10.3891 4.21609 10.5176 4.16285 10.6124 4.06809C10.7071 3.97334 10.7604 3.84482 10.7604 3.71081V2.70024H11.7709C11.9049 2.70024 12.0335 2.64701 12.1282 2.55225C12.223 2.45749 12.2762 2.32897 12.2762 2.19496C12.2762 2.06095 12.223 1.93243 12.1282 1.83767C12.0335 1.74291 11.9049 1.68968 11.7709 1.68968H10.7604V0.679111C10.7604 0.545101 10.7071 0.416581 10.6124 0.321822C10.5176 0.227063 10.3891 0.173828 10.2551 0.173828C10.1211 0.173828 9.99255 0.227063 9.89779 0.321822C9.80303 0.416581 9.7498 0.545101 9.7498 0.679111V1.68968H8.73923C8.60522 1.68968 8.4767 1.74291 8.38194 1.83767C8.28718 1.93243 8.23395 2.06095 8.23395 2.19496C8.23395 2.32897 8.28718 2.45749 8.38194 2.55225C8.4767 2.64701 8.60522 2.70024 8.73923 2.70024ZM14.2973 4.72137H13.7921V4.21609C13.7921 4.08208 13.7388 3.95356 13.6441 3.8588C13.5493 3.76404 13.4208 3.71081 13.2868 3.71081C13.1528 3.71081 13.0242 3.76404 12.9295 3.8588C12.8347 3.95356 12.7815 4.08208 12.7815 4.21609V4.72137H12.2762C12.1422 4.72137 12.0137 4.77461 11.9189 4.86937C11.8242 4.96412 11.7709 5.09264 11.7709 5.22665C11.7709 5.36066 11.8242 5.48918 11.9189 5.58394C12.0137 5.6787 12.1422 5.73194 12.2762 5.73194H12.7815V6.23722C12.7815 6.37123 12.8347 6.49975 12.9295 6.59451C13.0242 6.68927 13.1528 6.7425 13.2868 6.7425C13.4208 6.7425 13.5493 6.68927 13.6441 6.59451C13.7388 6.49975 13.7921 6.37123 13.7921 6.23722V5.73194H14.2973C14.4313 5.73194 14.5599 5.6787 14.6546 5.58394C14.7494 5.48918 14.8026 5.36066 14.8026 5.22665C14.8026 5.09264 14.7494 4.96412 14.6546 4.86937C14.5599 4.77461 14.4313 4.72137 14.2973 4.72137Z" fill="white" />
                        </svg>
                        <span className="text-[#ffffff] ml-[5px] text-[14px]">Intervue Poll</span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleStoptest}
                    className="bg-[#EF4444] text-white text-[16px] font-bold rounded-full w-[150px] h-[50px] border-[0px] text-[#ffffff] cursor-pointer ml-[600px]" style={{ marginBottom: firstQuestion ? '0px' : '10px' }}
                >
                    Stop Test
                </button>
                {firstQuestion && (
                    <div className="mt-[-27px]">
                        <div className="flex flex-col items-start">
                            <span className="text-[40px] font-light font-sora flex items-center flex-wrap justify-start text-left">
                                Let's
                                <h1 className="ml-[5px] text-[40px] font-semibold">Get Started</h1>
                            </span>
                            <p className="text-[19px] text-[#6E6E6E] text-left max-w-[737px] mt-[-20px]">
                                you’ll have the ability to create and manage polls, ask questions, and monitor your students' responses in real-time.
                            </p>
                        </div>
                    </div>
                )}
                <div className="relative w-[865px]">
                    {/* Error message absolutely positioned at top right */}
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

                    <form className="w-[865px]" onSubmit={handleSubmit}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1 mr-4">
                                <label className="block font-semibold mb-2 text-[20px]">
                                    Enter your question
                                </label>
                                <textarea
                                    className="w-[126%] p-3 rounded bg-[#F2F2F2] mt-[20px] h-[174px] border-0 "
                                    maxLength={100}
                                    value={question}
                                    onChange={e => setQuestion(e.target.value)}
                                    rows={3}
                                    required
                                />
                                <div className="w-full text-gray-400 text-xs text-right pl-[158px] mt-[-30px]">{question.length}/100</div>
                            </div>
                            <div className="flex flex-col items-end min-w-[180px] relative">
                                {/* Custom Triangle Arrow */}
                                <div
                                    className="pointer-events-none absolute right-3 top-1/2 transform -translate-y-1/2"
                                    style={{
                                        width: 0,
                                        height: 0,
                                        borderLeft: "10px solid transparent",
                                        borderRight: "10px solid transparent",
                                        borderTop: "10px solid #7765DA",
                                        marginRight: "25px"
                                    }}
                                />

                                <select
                                    value={duration}
                                    onChange={(e) => setDuration(Number(e.target.value))}
                                    className="appearance-none border-0 rounded text-[18px] p-[8px] pl-[25px] w-[170px] h-[43px] "
                                    style={{
                                        color: "#000000",
                                        background: "#F1F1F1",
                                    }}
                                >
                                    {[30, 45, 60, 90, 120].map((sec) => (
                                        <option key={sec} value={sec}>
                                            {sec} seconds
                                        </option>
                                    ))}
                                </select>
                            </div>

                        </div>
                        <div className="mb-4 mt-[30px]">
                            <div className="flex items-center justify-between">
                                <label className="block font-semibold mb-2 text-[18px]">Edit Options</label>
                                <label className="mr-2 text-[18px] text-left w-[290px]">Is it Correct?</label>
                            </div>
                            {options.map((opt, idx) => (
                                <div key={idx} className="flex items-center mb-[9px] mt-[5px]">
                                    <span className="w-[22px] h-[22px] flex items-center justify-center bg-[#7765DA] text-[#ffffff] rounded-full mr-2 text-[11px]">{idx + 1}</span>
                                    <div className="ml-[10px] w-[507px]">
                                        <input
                                            type="text"
                                            className="w-[507px] rounded mr-4 border-0 bg-[#F2F2F2] h-[60px]"
                                            value={opt.text}
                                            onChange={e => handleOptionChange(idx, e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="flex items-center ml-[30px]">
                                        <label className="flex items-center mr-1  text-[17px]">
                                            <input
                                                type="radio"
                                                name={`correct-${idx}`}
                                                checked={opt.isCorrect === true}
                                                onChange={() => handleCorrectChange(idx, true)}
                                                className="accent-[#7765DA] h-[50px] w-[18px]"
                                            />
                                            Yes
                                        </label>
                                        <label className="flex items-center text-[17px] ml-[20px]">
                                            <input
                                                type="radio"
                                                name={`correct-${idx}`}
                                                checked={opt.isCorrect === false}
                                                onChange={() => handleCorrectChange(idx, false)}
                                                className="accent-[#7765DA] h-[50px] w-[18px]"
                                            />
                                            No
                                        </label>
                                    </div>
                                    {options.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => deleteOption(idx)}
                                            className="ml-[50px] mt-[20px] w-[169px] h-[45px] px-4 py-1 border rounded-[10px] text-[#ffffff] border-0"
                                            style={{ background: "#7765DA" }}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                className="ml-[50px] mt-[20px] w-[169px] h-[45px] px-4 py-1 border rounded-[10px]"
                                style={{ borderColor: "#7765DA", color: "#7765DA", background: "#ffffff" }}
                                onClick={addOption}
                            >
                                + Add More option
                            </button>
                        </div>
                    </form>

                </div>
            </div>
            <hr className="w-[95%]"></hr>
            <button
                type="button"
                onClick={handleSubmit}
                className="bg-gradient-to-r from-[#8F64E1] to-[#1D68BD] text-white text-[18px] font-bold py-2 px-6 rounded-full w-[234px] h-[58px] disabled:opacity-50 border-0 text-[#ffffff] cursor-pointer ml-[80%]"
                style={{ background: "#7765DA", color: "#fff" }}
            >
                Ask Question
            </button>

        </div>
    );
};

export default AddQuestion;