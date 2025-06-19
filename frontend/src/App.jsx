import { useEffect, useState } from "react";
import RoleSelection from "./components/RoleSelection";
import StudentPage from "./components/Student pages/StudentPage";
import TeacherPage from "./components/Teacher pages/TeacherPage";

function App() {
  const [name, setName] = useState(sessionStorage.getItem("name") || "");
  const [role, setRole] = useState(sessionStorage.getItem("role") || "");

  useEffect(() => {
    if (name) sessionStorage.setItem("name", name);
    if (role) sessionStorage.setItem("role", role);
  }, [name, role]);

  if (!role) {
    return <RoleSelection setRole={setRole} />;
  }

  return role === "student" ? <StudentPage setName={setName} name={name} role={role} setRole={setRole} /> : <TeacherPage setName={setName} name={name} role={role} setRole={setRole}/>;
}

export default App;
