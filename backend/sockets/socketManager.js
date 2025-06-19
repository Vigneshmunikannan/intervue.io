// --- socketManager.js ---
const { v4: uuidv4 } = require('uuid');
const { createPollForTeacher, setupTeacherSocket } = require('./teacher');
const setupStudentSocket = require('./student');
const setupChatSocket = require('./chat');

module.exports = function setupSocket(io) {
    // --- SHARED STATE OBJECT ---
    const state = {
        teacherSocket: null,
        teacherName: null,
        teacherGraceTimeout: null,
        TEACHER_GRACE_PERIOD: 5000, // increased from 8 seconds to 30 seconds
        activePoll: null,
        activeQuestion: null,
        connectedStudents: new Map(),
        studentNames: new Map(),
        questionTimer: null,
        waitingStudents: new Map(),
        teacherSessionId: null,
        studentAnswers: new Map(),
        setTeacherSocket(s) { this.teacherSocket = s; },
        setActivePoll(p) { this.activePoll = p; },
        setActiveQuestion(q) { this.activeQuestion = q; },
        setQuestionTimer(t) { this.questionTimer = t; },
        resetAll() {
            this.activePoll = null;
            this.activeQuestion = null;
            this.connectedStudents.clear();
            this.studentNames.clear();
            this.waitingStudents.clear();
            this.teacherSessionId = null;
        }
    };

    io.on("connection", (socket) => {
        const { name, role, teacherSessionId: incomingSessionId } = socket.handshake.query;
        console.log(`[CONNECTED] ${name} as ${role} - Socket: ${socket.id}`);

        if (role === "teacher") {
            // 1) Reject if another teacher is active or in grace period
            if ((state.teacherSocket && state.teacherSocket.connected) || state.teacherGraceTimeout) {
                const isSame =
                    state.teacherGraceTimeout &&
                    name === state.teacherName &&
                    incomingSessionId &&
                    incomingSessionId === state.teacherSessionId;

                console.log("GraceTimeout:", state.teacherGraceTimeout, "Name:", name, "IncomingSessionId:", incomingSessionId, "CurrentSessionId:", state.teacherSessionId);

                if (isSame) {
                    // ✅ Reconnect same teacher within grace period
                    console.log("Clearing teacher grace timeout due to reconnection.");
                    clearTimeout(state.teacherGraceTimeout);
                    state.teacherGraceTimeout = null;
                    state.teacherSocket = socket;

                    console.log(`[RECONNECT] Teacher ${name} reconnected within grace period.`);
                    socket.emit("message", JSON.stringify({ type: "TEACHER_RESTORED" }));

                    // Optionally restore poll if needed
                    const pollData = { title: `Teacher Poll ${Date.now()}` };
                    createPollForTeacher(io, state, pollData);
                    setupTeacherSocket(io, socket, state);
                    return;
                }

                if (!state.teacherGraceTimeout) {
                    socket.emit("message", JSON.stringify({
                        type: "SESSION_DENIED",
                        payload: { reason: "Teacher session grace period active. Please wait and try again.", socketId: socket.id }
                    }));
                }
                return socket.disconnect(true);
            }

            // 2) First‑time teacher connection
            state.teacherSocket = socket;
            state.teacherName = name;
            state.teacherSessionId = incomingSessionId && incomingSessionId !== "null" && incomingSessionId !== "undefined"
                ? incomingSessionId
                : uuidv4();

            console.log(`[NEW TEACHER] ${name} connected - Socket: ${socket.id} - Session ID: ${state.teacherSessionId}`);
            socket.emit("message", JSON.stringify({
                type: "TEACHER_SESSION_ID",
                payload: { teacherSessionId: state.teacherSessionId }
            }));

            // restore poll if needed
            const pollData = { title: `Teacher Poll ${Date.now()}` };
            createPollForTeacher(io, state, pollData);
            setupTeacherSocket(io, socket, state);

            // 3) On disconnect, start grace period cleanup
            socket.on("disconnect", () => {
                console.log(`[DISCONNECT] Teacher ${name} - Socket: ${socket.id}`);
                console.log("Starting teacher grace period timer...");
                state.teacherGraceTimeout = setTimeout(async () => {
                    console.log("Teacher grace period expired. Cleaning up state and disconnecting students.");
                    // end active poll in DB
                    if (state.activePoll) {
                        const Poll = require('../models/Poll');
                        await Poll.findByIdAndUpdate(
                            state.activePoll._id,
                            { status: 'ended', endedAt: new Date() },
                            { new: true }
                        );
                    }
                    // notify & kick all students
                    for (const [sid, student] of state.connectedStudents.entries()) {
                        io.to(sid).emit("message", JSON.stringify({
                            type: "SESSION_TERMINATED",
                            payload: { reason: "Teacher session ended" }
                        }));
                        io.sockets.sockets.get(sid)?.disconnect(true);
                    }
                    // reset all state
                    state.teacherSocket = null;
                    state.teacherName = null;
                    state.teacherGraceTimeout = null;
                    state.activePoll = null;
                    state.activeQuestion = null;
                    state.connectedStudents.clear();
                    state.studentNames.clear();
                    state.questionTimer = null;
                    state.waitingStudents.clear();
                    state.studentAnswers.clear();
                    state.teacherSessionId = null;

                    io.emit("message", JSON.stringify({ type: "SESSION_TERMINATED" }));
                    console.log("cleared all");
                }, state.TEACHER_GRACE_PERIOD);
            });
            
        } else if (role === "student") {
            setupStudentSocket(io, socket, state);
        }

        setupChatSocket(io, socket, state);
    });
};
