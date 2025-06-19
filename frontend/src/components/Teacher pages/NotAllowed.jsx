import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const JoinErrorToast = ({ setRole, setName,text }) => {
  const [visible, setVisible] = useState(true);
  const navigate = useNavigate();
  const STUDENT_SESSION_KEY = "studentSessionId";

  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.removeItem("name");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem(STUDENT_SESSION_KEY);

      const studentSessionId = sessionStorage.getItem(STUDENT_SESSION_KEY);
      console.log("Join denied. Cleared session for ID:", studentSessionId);

      setRole("");
      setName("");

      navigate("/");
      setVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate, setRole, setName]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        width: "100vw",
        backgroundColor: "#FF4C4C",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "24px",
        fontWeight: "bold",
        zIndex: 9999,
        animation: "fadeSlideDown 0.5s ease-out",
      }}
    >
      {text}

      {/* Keyframe styles (inline for now) */}
      <style>{`
        @keyframes fadeSlideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default JoinErrorToast;
