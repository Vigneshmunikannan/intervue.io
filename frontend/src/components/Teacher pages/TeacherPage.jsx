import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import AddQuestion from "./AddQuestion";

import JoinErrorToast from "./NotAllowed";

import History from "./History";
import ResultPage from "./ResultPage";
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const TEACHER_SESSION_KEY = "teacherSessionId";
import PollHistoryList from "./PollHistoryList";

const TeacherPage = ({ name, setName, role, setRole }) => {
    const [status, setStatus] = useState("initial");
    const [error, setError] = useState(null);
    const socketRef = useRef(null);
    const [typingName, setTypingName] = useState("");
    const [firstQuestion, setFirstQuestion] = useState(false);
    const [sessionrestore, SetSessionRestore] = useState(false);
    const [showPollHistory, setShowPollHistory] = useState(false);

    const [questiondata, setQuestionData] = useState(null);
    function handleChange(e) {
        setTypingName(e.target.value);
        setShowPollHistory(setShowPollHistory(false))
        if (typingName.length === 0) {
            setShowPollHistory(false)
        }
        console.log("typingName", typingName);
    }
    function handleContinue() {
        if (!typingName) {
            return
        }
        setName(typingName.trim())
    }
    const handleNameSubmit = (e) => {
        e.preventDefault();
        if (name.trim()) {
            sessionStorage.setItem("studentName", name.trim());
            // Don't reload, just trigger the useEffect
            setName(name.trim());
        }
    };
    // On mount / name change: connect socket
    useEffect(() => {
        if (!name) {
            const stored = sessionStorage.getItem("teacherName");
            if (stored) {
                setName(stored);
            }
            return;
        }

        // get or create session ID
        let teacherSessionId = sessionStorage.getItem(TEACHER_SESSION_KEY) || "";
        socketRef.current = io(SERVER_URL, {
            query: { name, role, teacherSessionId },
            transports: ["websocket", "polling"],
        });

        const socket = socketRef.current;

        socket.on("connect", () => {
            console.log(`Connected as ${name}`);
            setStatus("connected");
        });

        socket.on("disconnect", () => {
            console.log("Disconnected");
            setStatus(prev => prev === "not_allowed" ? "not_allowed" : "disconnected");
        });

        socket.on("message", (raw) => {
            const msg = typeof raw === "string" ? JSON.parse(raw) : raw;
            console.log("←", msg);

            // store incoming session ID if provided
            if (msg.type === "TEACHER_SESSION_ID" && msg.payload?.teacherSessionId) {
                sessionStorage.setItem(TEACHER_SESSION_KEY, msg.payload.teacherSessionId);
            }

            switch (msg.type) {
                case "TEACHER_SESSION_ID":
                    setStatus("ready");
                    break;

                case "POLL_CREATED":
                case "POLL_ALREADY_ACTIVE":
                    setStatus('pollcreated')
                    setFirstQuestion(msg.payload.first)
                    //   setError("A poll is already active!");
                    break;

                case "TEACHER_RESTORED":
                    SetSessionRestore(true)
                    setTimeout(() => {
                        SetSessionRestore(false)
                    }, 4000)
                    break;

                case "QUESTION_ADDED":
                case "QUESTION_LIVE":
                    setQuestionData(msg.payload);
                    setFirstQuestion(false);
                    setStatus("questions_added");
                    break;


                case "SESSION_DENIED":
                    console.log("session denied");
                    setStatus("not_allowed");
                    setError(msg.payload?.message || "Session denied");
                    break;

                case "TEST_STOPPED":
                    setStatus("not_allowed");
                    setError("Test has been stopped by the teacher");
                    break;

                case "SESSION_TERMINATED":
                    setStatus("not_allowed");
                    setError(msg.payload?.reason || "Session terminated");
                    break;

                case "HISTORY_RESULT":
                    setStatus("view_history");
                    setQuestionData(msg.payload);
                    setFirstQuestion(false);
                    break;
                case "HISTORY_ERROR":
                    setStatus("not_allowed");
                    setError(msg.payload?.message || "Failed to fetch history because of  error test got completed ");
                    break;

                case "ERROR":
                    setStatus("not_allowed");
                    setError(msg.payload);
                    break;
            }
        });

        socket.on("connect_error", (err) => {
            console.error(err);
            setError("Connection error");
            setStatus("connection_error");
        });

        return () => {
            socket.disconnect();
        };
    }, [name, role, setName]);

    // if we haven't got a name yet, show the entry form
    if (!name) {
        return (
            <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-white">
                {showPollHistory && <PollHistoryList onClose={() => setShowPollHistory(false)} />}
                <div className="absolute top-[40px] right-[300px] z-[40]">
                    <button
                        onClick={() => {
                            setShowPollHistory(prev => !prev)
                            console.log("showPollHistory", showPollHistory)
                        }}
                        className="bg-gradient-to-r from-[#8F64E1] to-[#1D68BD] text-white text-[18px] font-bold py-2 px-6 rounded-full w-[234px] h-[58px]  border-[0px] disabled:opacity-50  text-[#ffffff] cursor-pointer "
                    >
                        {"View Past Polls"}
                    </button>
                </div>
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
                        If you're a teacher, you'll be able to <span style={{ color: '#000000', fontWeight: 'bold' }}>
                            Create Questions
                        </span>, launch live polls, monitor student participation in real time, and review results to assess class understanding.
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
    console.log("status", status);

    // once we're connected but before poll creation, show a spinner
    if (status === "connected" || status === "ready") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    // render the question-creation UI
    if (status === "pollcreated") {
        return (
            <div className="p-4">
                <AddQuestion socket={socketRef.current} firstQuestion={firstQuestion} setFirstQuestion={setFirstQuestion} />
            </div>
        );
    }

    if (status === "not_allowed") {
        return (
            <JoinErrorToast setRole={setRole} setName={setName} text={error} />
        )
    }

    if (status === "questions_added") {
        return (
            <ResultPage socket={socketRef.current} questiondata={questiondata} />
        )
    }

    if (status === "view_history") {
        return (
            <History socket={socketRef.current} history={questiondata.questions} />
        )
    }





    // fallback
    return null;
};

export default TeacherPage;
