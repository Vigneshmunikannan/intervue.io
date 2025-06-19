import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Ended = ({ setRole, setName }) => {
  const navigate = useNavigate();
  const STUDENT_SESSION_KEY = "studentSessionId";

  useEffect(() => {
    // Clear session storage

    // Redirect after 5 seconds
    const timer = setTimeout(() => {
      sessionStorage.removeItem("name");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem(STUDENT_SESSION_KEY);

      const studentSessionId = sessionStorage.getItem(STUDENT_SESSION_KEY);
      console.log("Session ended for student session ID:", studentSessionId);

      // Clear App state
      setRole("");
      setName("");

      navigate("/");
    }, 5000);

    return () => clearTimeout(timer); // Cleanup timer on unmount
  }, [navigate, setName, setRole]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-blue-500 text-xl mb-4">Session Ended</p>
        <p className="text-gray-600">The teacher has ended the session.</p>
      </div>
    </div>
  );
};

export default Ended;
