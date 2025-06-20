import React, { useEffect, useState } from "react";
import axios from "axios";
import "./PollHistoryList.css";

const PollHistoryList = ({ onClose }) => {
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPoll, setSelectedPoll] = useState(null);
    const [pollResults, setPollResults] = useState(null);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [resultsError, setResultsError] = useState(null);

    useEffect(() => {
        const fetchPolls = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_SERVER_APIURL}/api/polls`);
                setPolls(res.data);
            } catch (err) {
                console.error("Error fetching past polls:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPolls();
    }, []);

    const closePopup = () => {
        setSelectedPoll(null);
        setPollResults(null);
        setResultsError(null);
    };

    // Helper for Indian time
    const formatIndianTime = (dateStr) =>
        new Date(dateStr).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    // Fetch poll results when a poll is selected
    const handlePollClick = async (poll) => {
        setSelectedPoll(poll);
        setPollResults(null);
        setResultsError(null);
        setResultsLoading(true);
        try {
            const res = await axios.get(
                `${import.meta.env.VITE_SERVER_APIURL}/api/polls/${poll._id}/results`
            );
            console.log("Poll results:", res.data);
            setPollResults(res.data);
        } catch (err) {
            setResultsError("Failed to fetch poll results.");
        } finally {
            setResultsLoading(false);
        }
    };

    return (
        <div className="poll-history-container">
            <div className="poll-header">
                <span>Poll History</span>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="poll-list">
                {loading ? (
                    <p className="bg-[#ffffff]">Loading...</p>
                ) : polls.length === 0 ? (
                    <div className="gray-text">No polls found.</div>
                ) : (
                    polls.map((poll) => (
                        <div
                            key={poll._id}
                            onClick={() => handlePollClick(poll)}
                            className="poll-item"
                        >
                            <div className="poll-title">{poll.title}</div>
                            <div className="poll-date">
                                Created: {formatIndianTime(poll.createdAt)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Results Popup */}
            {selectedPoll && (
                <div className="poll-popup-overlay">
                    <div className="poll-popup" style={{ maxHeight: "80vh", overflowY: "auto" }}>
                        <button className="popup-close" onClick={closePopup}>×</button>
                        <h2>{selectedPoll.title}</h2>
                        <p><strong>Teacher:</strong> {selectedPoll.teacherName}</p>
                        <p><strong>Status:</strong> {selectedPoll.status}</p>
                        <p><strong>Created At:</strong> {formatIndianTime(selectedPoll.createdAt)}</p>
                        {selectedPoll.endedAt && (
                            <p><strong>Ended At:</strong> {formatIndianTime(selectedPoll.endedAt)}</p>
                        )}

                        {resultsLoading && <p>Loading results...</p>}
                        {resultsError && <p className="error-message">{resultsError}</p>}

                        {pollResults && pollResults.results && pollResults.results.length > 0 && (
                            <div>
                                <h3 className="text-[22px] font-semibold mb-3 mt-6">Questions & Results</h3>
                                {pollResults.results.map((result, idx) => (
                                    <div
                                        key={result.questionId || idx}
                                        className="w-full rounded-[12px] p-0 overflow-hidden mb-8"
                                        style={{ maxWidth: 700, margin: "0 auto" }}
                                    >
                                        <h4 className="text-[18px] font-semibold mb-2 mt-4 ml-6">
                                            Question {result.questionNumber}
                                        </h4>
                                        <div
                                            className="question-bg h-[50px] text-[17px] text-[#ffffff] font-semibold flex items-center pl-[30px]"
                                            style={{ borderRadius: '12px 12px 0 0' }}
                                        >
                                            {result?.questionText || 'No question text available'}
                                        </div>
                                        {result && result.options?.length > 0 ? (
                                            <ul className="results-list px-[20px] py-[16px] bg-white">
                                                {result.options.map((option, index) => {
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
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PollHistoryList;
