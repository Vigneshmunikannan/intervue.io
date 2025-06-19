import React, { useEffect, useState } from "react";

const ResultPage = ({ status, results, socket }) => {
    const [load, setLoad] = useState(true);

    useEffect(() => {
        // Listen for backend message to stop loading
        if (!socket) return;
        const handler = (raw) => {
            const msg = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (msg.type === "RESULTS_READY") {
                setLoad(false);
            }
        };
        socket.on("message", handler);
        return () => socket.off("message", handler);
    }, [socket]);

    useEffect(() => {
        // Start loading when status is questions_added
        if (status === "questions_added") setLoad(true);
    }, [status]);

    if (status !== "questions_added") return null;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center">
            {load ? (
                <div className="flex flex-col items-center">
                    <svg className="animate-spin h-12 w-12 text-[#7765DA] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#7765DA" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="#7765DA" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    <p className="text-[#7765DA] text-xl font-semibold">Calculating results...</p>
                </div>
            ) : (
                <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-8">
                    <h2 className="text-2xl font-bold mb-6 text-[#7765DA]">Results</h2>
                    {/* Render your results here */}
                    {results && results.length > 0 ? (
                        <ul>
                            {results.map((res, idx) => (
                                <li key={idx} className="mb-2">
                                    <span className="font-semibold">{res.name}:</span> {res.score}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500">No results available.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResultPage;