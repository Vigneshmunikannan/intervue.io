import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import ChatToggle from "../Chat";
import Ended from "./Ended";
import NoTeacherNotice from "./NoTeacherNotice";
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
import StudentQuestionComponent from "./StudentQuestionComponent";
import ResultPage from "./Results";

const STUDENT_SESSION_KEY = "studentSessionId";

import WaitingScreen from "./FirstWait";
import Kickout from "./kickout";
const StudentPage = ({ name, setName, role, setRole }) => {

    const [status, setStatus] = useState("initial");
    const [question, setQuestion] = useState(null);
    const [answered, setAnswered] = useState(false);
    const [assignedName, setAssignedName] = useState("");
    const [timeLeft, setTimeLeft] = useState(0);
    const [results, setResults] = useState(null);
    const socketRef = useRef(null);
    const timerRef = useRef(null);
    const [typingName, setTypingName] = useState("");
    if (!role) return null;

    console.log("StudentPage mounted with role:", role, "and name:", name);
    function handleChange(e) {
        setTypingName(e.target.value);
    }
    function handleContinue() {
        if (!typingName) return;
        sessionStorage.setItem("studentName", typingName.trim());
        setName(typingName.trim());
    }
    useEffect(() => {
        if (!name) {
            const storedName = sessionStorage.getItem("studentName");
            if (storedName) {
                setName(storedName);
            }
        }
    }, [name, setName]);

    useEffect(() => {
        // --- Get or create studentSessionId ---
        let studentSessionId = sessionStorage.getItem(STUDENT_SESSION_KEY);
        // Don't generate here; let backend generate if missing

        socketRef.current = io(SERVER_URL, {
            query: {
                name,
                role,
                studentSessionId // may be null/undefined on first connect
            },
            transports: ['websocket', 'polling'] // Fallback transports
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('Connected to server');
            setStatus("waiting");
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        socket.on('message', (data) => {
            const message = typeof data === 'string' ? JSON.parse(data) : data;
            console.log('Received message:', message);

            // --- Store studentSessionId if received ---
            if (
                message.payload &&
                message.payload.studentSessionId
            ) {
                sessionStorage.setItem(STUDENT_SESSION_KEY, message.payload.studentSessionId);
            }

            switch (message.type) {
                case "NO_TEACHER":
                    setStatus("no_teacher");
                    break;

                case "WAITING_FOR_QUESTION1":
                    setStatus("waiting");
                    setAssignedName(message.payload.assignedName);
                    break;


                case "NEW_QUESTION":
                    setStatus("test");
                    console.log("New question received:", message.payload);
                    setQuestion(message.payload);
                    setAnswered(false);
                    setResults(null);
                    setTimeLeft(message.payload.timeLeft || message.payload.duration);
                    startTimer(message.payload.timeLeft || message.payload.duration);
                    break;

                case "QUESTION_ENDED":
                    setResults(message.payload);
                    setStatus("results");
                    clearTimer();
                    break;

                case "KICKED":
                    setStatus("kicked");
                    break;

                case "SESSION_TERMINATED":
                    setStatus("ended");
                    break;

                case "SESSION_DENIED":
                    setStatus("Participant Denied");
                    break;
                case "WAITING_FOR_QUESTION":
                    setStatus("waiting");
                    setAssignedName(message.payload.assignedName);
                    break;

                case "TEACHER_LEFT":
                    setStatus("ended");
                    break;

                case "ERROR":
                    console.error("Server error:", message.payload);
                    alert(message.payload);
                    break;

                default:
                    console.log("Unknown message type:", message.type);
            }
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            setStatus("connection_error");
        });

        // Cleanup on unmount
        return () => {
            clearTimer();
            if (socket) {
                socket.disconnect();
            }
        };
    }, [name, role]);

    const startTimer = (duration) => {
        clearTimer();
        setTimeLeft(duration);

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearTimer();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleNameSubmit = (e) => {
        e.preventDefault();
        if (typingName.trim()) {
            sessionStorage.setItem("studentName", typingName.trim());
            setName(typingName.trim());
        }
    };

    const sendAnswer = (optionIndex) => {
        if (!socketRef.current || answered) return;

        socketRef.current.emit("submit-answer", {
            selectedOption: optionIndex
        });
        setAnswered(true);
        clearTimer();
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Name input screen
    if (!name) {
        return (
            <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-white">
                {/* Badge */}
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-gradient-to-r from-[#7565D9] to-[#4D0ACD] text-white font-sora font-semibold text-sm h-[31px] w-[134px] mx-auto mb-3 text-[#ffffff]">
                    <div className="flex items-center ml-[10px]">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12.2762 8.76363C12.2775 8.96965 12.2148 9.17098 12.0969 9.33992C11.979 9.50887 11.8116 9.63711 11.6178 9.707L8.35572 10.907L7.15567 14.1671C7.08471 14.3604 6.95614 14.5272 6.78735 14.645C6.61855 14.7628 6.41766 14.826 6.21181 14.826C6.00596 14.826 5.80506 14.7628 5.63627 14.645C5.46747 14.5272 5.33891 14.3604 5.26794 14.1671L4.06537 10.9111L0.804778 9.71104C0.611716 9.63997 0.445097 9.5114 0.327404 9.34266C0.20971 9.17392 0.146606 8.97315 0.146606 8.76742C0.146606 8.56169 0.20971 8.36092 0.327404 8.19218C0.445097 8.02345 0.611716 7.89487 0.804778 7.82381L4.06688 6.62376L5.26693 3.36418C5.33799 3.17112 5.46657 3.0045 5.6353 2.88681C5.80404 2.76911 6.00482 2.70601 6.21054 2.70601C6.41627 2.70601 6.61705 2.76911 6.78578 2.88681C6.95452 3.0045 7.08309 3.17112 7.15416 3.36418L8.35421 6.62629L11.6138 7.82633C11.8074 7.8952 11.9749 8.02223 12.0935 8.19003C12.2121 8.35782 12.2759 8.55817 12.2762 8.76363ZM8.73923 2.70024H9.7498V3.71081C9.7498 3.84482 9.80303 3.97334 9.89779 4.06809C9.99255 4.16285 10.1211 4.21609 10.2551 4.21609C10.3891 4.21609 10.5176 4.16285 10.6124 4.06809C10.7071 3.97334 10.7604 3.84482 10.7604 3.71081V2.70024H11.7709C11.9049 2.70024 12.0335 2.64701 12.1282 2.55225C12.223 2.45749 12.2762 2.32897 12.2762 2.19496C12.2762 2.06095 12.223 1.93243 12.1282 1.83767C12.0335 1.74291 11.9049 1.68968 11.7709 1.68968H10.7604V0.679111C10.7604 0.545101 10.7071 0.416581 10.6124 0.321822C10.5176 0.227063 10.3891 0.173828 10.2551 0.173828C10.1211 0.173828 9.99255 0.227063 9.89779 0.321822C9.80303 0.416581 9.7498 0.545101 9.7498 0.679111V1.68968H8.73923C8.60522 1.68968 8.4767 1.74291 8.38194 1.83767C8.28718 1.93243 8.23395 2.06095 8.23395 2.19496C8.23395 2.32897 8.28718 2.45749 8.38194 2.55225C8.4767 2.64701 8.60522 2.70024 8.73923 2.70024ZM14.2973 4.72137H13.7921V4.21609C13.7921 4.08208 13.7388 3.95356 13.6441 3.8588C13.5493 3.76404 13.4208 3.71081 13.2868 3.71081C13.1528 3.71081 13.0242 3.76404 12.9295 3.8588C12.8347 3.95356 12.7815 4.08208 12.7815 4.21609V4.72137H12.2762C12.1422 4.72137 12.0137 4.77461 11.9189 4.86937C11.8242 4.96412 11.7709 5.09264 11.7709 5.22665C11.7709 5.36066 11.8242 5.48918 11.9189 5.58394C12.0137 5.6787 12.1422 5.73194 12.2762 5.73194H12.7815V6.23722C12.7815 6.37123 12.8347 6.49975 12.9295 6.59451C13.0242 6.68927 13.1528 6.7425 13.2868 6.7425C13.4208 6.7425 13.5493 6.68927 13.6441 6.59451C13.7388 6.49975 13.7921 6.37123 13.7921 6.23722V5.73194H14.2973C14.4313 5.73194 14.5599 5.6787 14.6546 5.58394C14.7494 5.48918 14.8026 5.36066 14.8026 5.22665C14.8026 5.09264 14.7494 4.96412 14.6546 4.86937C14.5599 4.77461 14.4313 4.72137 14.2973 4.72137Z" fill="white" />
                        </svg>

                        <span className=" ml-[5px] text-[14px]">Intervue Poll</span>
                    </div>
                </div>

                <div className="flex flex-col items-center">
                    <span className="text-[40px] font-light font-sora flex items-center flex-wrap justify-center text-center">
                        Let's
                        <h1 className="ml-[5px] text-[40px] font-semibold">Get Started</h1>
                    </span>
                    <p className="text-[19px] text-[#6E6E6E] text-center max-w-[737px] mt-[-20px]">
                        If you're a student, you'll be able to <span style={{ color: '#000000', fontWeight: 'bold' }}>
                            Submit your answers
                        </span>, participate in live polls, and see how your responses compare with your classmates
                    </p>
                </div>

                <form
                    onSubmit={handleNameSubmit}
                    className="flex flex-col gap-4 w-[507px] max-w-md mt-10"
                >
                    <label
                        htmlFor="name"
                        className="text-black font-semibold text-lg text-[18px] mb-[10px]"
                    >
                        Enter your Name
                    </label>

                    <input
                        id="name"
                        type="text"
                        className="border-0 p-2 bg-[#F2F2F2] h-[60px] text-[18px] pl-[25px] text-[#000000]"
                        value={typingName}
                        onChange={handleChange}
                        required
                    />

                    {/* Centered button wrapper */}
                    <div className="flex justify-center mt-[50px]">
                        <button
                            type="button"
                            onClick={handleContinue}
                            className="bg-gradient-to-r from-[#8F64E1] to-[#1D68BD] text-white text-[18px] font-bold py-2 px-6 rounded-full w-[234px] h-[58px] disabled:opacity-50 border-0 text-[#ffffff] cursor-pointer"
                        >
                            Continue
                        </button>
                    </div>
                </form>

            </div>
        );
    }

    // Status screens
    if (status === "connection_error") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 text-xl mb-4">Connection Error</p>
                    <p className="text-gray-600">Unable to connect to the server. Please check your internet connection.</p>
                </div>
            </div>
        );
    }

    if (status === "no_teacher") {
        return (
            <NoTeacherNotice />
        );
    }

    if (status === "waiting") {
        return (
            <WaitingScreen />
        );
    }

    if (status === "kicked") {
        return (
            <Kickout setRole={setRole} setName={setName} />
        );
    }

    if (status === "ended") {
        return (
            <Ended setRole={setRole} setName={setName} />
        );
    }

    if (status === "test" && question) {
        return (
            <div>
                <ChatToggle
                    name={name}
                    role={role}
                    socket={socketRef.current}
                    isVisible={true}
                />
                <StudentQuestionComponent
                    question={question}
                    timeLeft={timeLeft}
                    answered={answered}
                    onSubmit={sendAnswer}
                    formatTime={formatTime}
                    socket={socketRef.current}
                />
            </div>

        );
    }

    // Results screen
    if (status === "results" && results) {
        return <div>
            <ChatToggle
                name={name}
                role={role}
                socket={socketRef.current}
                isVisible={true}
            />
            <ResultPage status={status} results={results} socket={socketRef.current} />;
        </div>
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading...</p>
            </div>
        </div>
    );
};

export default StudentPage;