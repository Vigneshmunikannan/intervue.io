const Chat = require('../models/Chat');

module.exports = function setupChatSocket(io, socket, state) {
  // Helper to get all participants (teacher + students, with socketId)
  function getAllParticipants() {
    const participants = [];
    if (state.teacherSocket && state.teacherSocket.connected) {
      participants.push({
        name: state.teacherName,
        role: 'teacher',
        socketId: state.teacherSocket.id,
        status: 'online'
      });
    }
    state.connectedStudents.forEach((studentObj, sid) => {
      participants.push({
        name: studentObj.originalName,
        role: 'student',
        socketId: sid,
        status: 'connected'
      });
    });
    state.waitingStudents.forEach((studentObj, sid) => {
      participants.push({
        name: studentObj.originalName,
        role: 'student',
        socketId: sid,
        status: 'waiting'
      });
    });
    return participants;
  }

  // Only allow chat if poll is active
  function isChatAllowed() {
    return !!state.activePoll;
  }

  // Send updated participants list to all
  function broadcastParticipants() {
    const participants = getAllParticipants();
    io.emit("participants-update", participants);
  }

  // Send chat message to all students (connected + waiting) and teacher
  function broadcastChatMessage(chatMsg) {
    // To teacher
    if (state.teacherSocket && state.teacherSocket.connected) {
      state.teacherSocket.emit("chat-message", chatMsg);
    }
    // To connected students
    state.connectedStudents.forEach((studentObj) => {
      if (studentObj.socket && typeof studentObj.socket.emit === "function") {
        studentObj.socket.emit("chat-message", chatMsg);
      }
    });
    // To waiting students
    state.waitingStudents.forEach((studentObj) => {
      if (studentObj.socket && typeof studentObj.socket.emit === "function") {
        studentObj.socket.emit("chat-message", chatMsg);
      }
    });
  }

  // Send chat history to the current socket
  async function sendChatHistory() {
    if (!state.activePoll) return;
    try {
      const chatHistory = await Chat.find({ pollId: state.activePoll._id })
        .sort({ sentAt: 1 })
        .lean();

      socket.emit("chat-history", chatHistory.map(msg => ({
        sender: msg.senderName,
        text: msg.message,
        role: msg.role,
        sentAt: msg.sentAt,
        socketId: msg.socketId
      })));
    } catch (err) {
      console.error("Failed to fetch chat history:", err);
      socket.emit("chat-error", { message: "Failed to load chat history" });
    }
  }

  // On join, send participants and chat history if poll is active
  socket.on("chat-join", async () => {
    if (!isChatAllowed()) {
      socket.emit("chat-error", { message: "Chat is not available. No active poll." });
      return;
    }
    broadcastParticipants();
    await sendChatHistory();
  });

  // Handle chat message
  socket.on("chat-message", async (msg) => {
    if (!isChatAllowed()) {
      socket.emit("chat-error", { message: "Chat is not available. No active poll." });
      return;
    }

    // Input validation
    if (!msg?.text || typeof msg.text !== 'string' || msg.text.trim().length === 0) {
      socket.emit("chat-error", { message: "Invalid message format" });
      return;
    }

    // Prevent overly long messages
    if (msg.text.length > 1000) {
      socket.emit("chat-error", { message: "Message too long. Maximum 1000 characters." });
      return;
    }

    const senderInfo =
      (state.teacherSocket && socket.id === state.teacherSocket.id)
        ? { name: state.teacherName, role: "teacher" }
        : (
          state.connectedStudents.get(socket.id) ||
          state.waitingStudents.get(socket.id)
        );

    if (!senderInfo) {
      socket.emit("chat-error", { message: "Unauthorized to send messages" });
      return;
    }

    const senderName = senderInfo.originalName || senderInfo.name || "Unknown";
    const role = senderInfo.role || "student";

    // Save to DB
    try {
      await Chat.create({
        pollId: state.activePoll._id,
        senderName,
        role,
        message: msg.text.trim(),
        sentAt: new Date(),
        socketId: socket.id
      });
    } catch (err) {
      console.error("Failed to save chat message:", err);
      socket.emit("chat-error", { message: "Failed to send message" });
      return;
    }

    const chatMsg = {
      sender: senderName,
      text: msg.text.trim(),
      role,
      sentAt: new Date(),
      socketId: socket.id
    };

    broadcastChatMessage(chatMsg);
  });

  // Handle kick (teacher only)
  socket.on("kick-student", ({ socketId }) => {
    if (!isChatAllowed()) return;

    // Verify teacher authorization
    if (!state.teacherSocket || socket.id !== state.teacherSocket.id) {
      socket.emit("chat-error", { message: "Only teachers can kick students" });
      return;
    }

    if (!socketId) {
      socket.emit("chat-error", { message: "Invalid socket ID" });
      return;
    }

    // Try to find and disconnect student in connected or waiting
    let kicked = false;
    let kickedName = null;

    if (state.connectedStudents.has(socketId)) {
      const studentObj = state.connectedStudents.get(socketId);
      kickedName = studentObj.originalName;
      if (studentObj.socket && typeof studentObj.socket.emit === "function") {
        studentObj.socket.emit("message", {
          type: "KICKED",
          payload: {
            reason: "You have been kicked out of the test by the teacher."
          }
        });
        setTimeout(() => {
          studentObj.socket.disconnect(true);
        }, 1000);
      }
      state.connectedStudents.delete(socketId);
      kicked = true;
    } else if (state.waitingStudents.has(socketId)) {
      const studentObj = state.waitingStudents.get(socketId);
      kickedName = studentObj.originalName;
      if (studentObj.socket && typeof studentObj.socket.emit === "function") {
        studentObj.socket.emit("message", {
          type: "KICKED",
          payload: {
            reason: "You have been kicked out of the test by the teacher."
          }
        });
        setTimeout(() => {
          studentObj.socket.disconnect(true);
        }, 1000);
      }
      state.waitingStudents.delete(socketId);
      kicked = true;
    }

    if (kicked && kickedName) {
      broadcastParticipants();
      // Send system message to chat
      broadcastChatMessage({
        sender: "System",
        text: `${kickedName} was removed from the session.`,
        role: "system",
        sentAt: new Date()
      });

      // Confirm to teacher
      socket.emit("kick-success", {
        message: `${kickedName} has been kicked out successfully.`
      });
    } else {
      socket.emit("chat-error", { message: "Student not found or already disconnected" });
    }
  });

  // On disconnect, update participants
  socket.on("disconnect", () => {
    // Small delay to ensure clean disconnection
    setTimeout(() => {
      broadcastParticipants();
    }, 100);
  });

  // Handle typing indicators (optional enhancement)
  socket.on("typing", ({ isTyping }) => {
    if (!isChatAllowed()) return;

    const senderInfo =
      (state.teacherSocket && socket.id === state.teacherSocket.id)
        ? { name: state.teacherName, role: "teacher" }
        : (
          state.connectedStudents.get(socket.id) ||
          state.waitingStudents.get(socket.id)
        );

    if (senderInfo) {
      const typingData = {
        name: senderInfo.originalName || senderInfo.name,
        role: senderInfo.role,
        isTyping,
        socketId: socket.id
      };

      // Broadcast to all except sender
      socket.broadcast.emit("user-typing", typingData);
    }
  });
};