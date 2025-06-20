// --- Enhanced socketManager.js with Teacher Activity Tracking ---
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
        TEACHER_GRACE_PERIOD: 5000,
        activePoll: null,
        activeQuestion: null,
        connectedStudents: new Map(),
        studentNames: new Map(),
        questionTimer: null,
        waitingStudents: new Map(),
        teacherSessionId: null,
        studentAnswers: new Map(),
        lastTeacherActivity: null,
        
        // New properties for tracking teacher activity state
        currentTeacherState: {
            lastActivity: '',
            lastActivityTime: null,
            pollStatus: null,
            questionStatus: null,
            studentsCount: 0,
            waitingStudentsCount: 0,
            currentQuestionData: null,
            timerData: null,
            lastResults: null
        },
        
        setTeacherSocket(s) { this.teacherSocket = s; },
        setActivePoll(p) { this.activePoll = p; },
        setActiveQuestion(q) { this.activeQuestion = q; },
        setQuestionTimer(t) { this.questionTimer = t; },
        
        // New method to update teacher activity
        updateTeacherActivity(activity, data = {}) {
            this.currentTeacherState.lastActivity = activity;
            this.currentTeacherState.lastActivityTime = new Date();
            this.currentTeacherState.studentsCount = this.connectedStudents.size;
            this.currentTeacherState.waitingStudentsCount = this.waitingStudents.size;
            
            // Store activity-specific data
            if (data.pollStatus) this.currentTeacherState.pollStatus = data.pollStatus;
            if (data.questionStatus) this.currentTeacherState.questionStatus = data.questionStatus;
            if (data.currentQuestionData) this.currentTeacherState.currentQuestionData = data.currentQuestionData;
            if (data.timerData) this.currentTeacherState.timerData = data.timerData;
            if (data.lastResults) this.currentTeacherState.lastResults = data.lastResults;
            
            console.log(`[TEACHER ACTIVITY] ${activity} at ${this.currentTeacherState.lastActivityTime}`);
        },
        
        // Method to get current teacher state for reconnection
        getCurrentTeacherState() {
            return {
                ...this.currentTeacherState,
                activePoll: this.activePoll ? {
                    id: this.activePoll._id,
                    title: this.activePoll.title,
                    status: this.activePoll.status,
                    questionsCount: this.activePoll.questions?.length || 0
                } : null,
                activeQuestion: this.activeQuestion ? {
                    id: this.activeQuestion._id,
                    questionNumber: this.activeQuestion.questionNumber,
                    questionText: this.activeQuestion.questionText,
                    options: this.activeQuestion.options,
                    duration: this.activeQuestion.duration,
                    status: this.activeQuestion.status,
                    startTime: this.questionStartTime,
                    answeredCount: this.studentAnswers.size
                } : null
            };
        },
        
        resetAll() {
            this.activePoll = null;
            this.activeQuestion = null;
            this.connectedStudents.clear();
            this.studentNames.clear();
            this.waitingStudents.clear();
            this.teacherSessionId = null;
            this.lastTeacherActivity = null;
            this.currentTeacherState = {
                lastActivity: 'SESSION_RESET',
                lastActivityTime: new Date(),
                pollStatus: null,
                questionStatus: null,
                studentsCount: 0,
                waitingStudentsCount: 0,
                currentQuestionData: null,
                timerData: null,
                lastResults: null
            };
        }
    };

    // Helper function to emit teacher state restoration
    function emitTeacherStateRestoration(socket, state) {
        const currentState = state.getCurrentTeacherState();
        // Emit specific activity-based messages based on current state
        console.log(currentState.lastActivity,"****************")

        switch (currentState.lastActivity) {
            case 'POLL_CREATED':
                socket.emit("message", JSON.stringify({
                    type: "POLL_ALREADY_ACTIVE",
                    payload: {
                        first: currentState.activePoll?.questionsCount === 0,
                        pollId: currentState.activePoll?.id,
                        studentsCount: currentState.studentsCount,
                        waitingCount: currentState.waitingStudentsCount
                    }
                }));
                break;

            case 'QUESTION_ACTIVE':
                if (currentState.activeQuestion) {
                    socket.emit("message", JSON.stringify({
                        type: "QUESTION_LIVE",
                        payload: {
                            questionId: currentState.activeQuestion.id,
                            questionNumber: currentState.activeQuestion.questionNumber,
                            questionText: currentState.activeQuestion.questionText,
                            options: currentState.activeQuestion.options,
                            duration: currentState.activeQuestion.duration,
                            startTime: currentState.activeQuestion.startTime,
                            answeredCount: currentState.activeQuestion.answeredCount,
                            totalStudents: currentState.studentsCount,
                            message: `Question ${currentState.activeQuestion.questionNumber} is currently active`
                        }
                    }));
                }
                break;

            case 'QUESTION_ENDED':
                if (currentState.lastResults) {
                    socket.emit("message", JSON.stringify({
                        type: "QUESTION_RESULTS",
                        payload: currentState.lastResults
                    }));
                }
                break;

            case 'VIEWING_HISTORY':
                // Re-trigger history view if that was the last activity
                socket.emit("message", JSON.stringify({
                    type: "HISTORY_VIEW_RESTORED",
                    payload: {
                        message: "History view restored. Click 'View History' to refresh results."
                    }
                }));
                break;
        }
    }

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

                    // Emit comprehensive state restoration
                    emitTeacherStateRestoration(socket, state);

                    // Set up teacher socket handlers
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

            // Create poll and set up socket
            const pollData = { title: `Teacher Poll ${Date.now()}` };
            createPollForTeacher(io, state, pollData);
            setupTeacherSocket(io, socket, state);

            // 3) On disconnect, start grace period cleanup
            socket.on("disconnect", () => {
                console.log(`[DISCONNECT] Teacher ${name} - Socket: ${socket.id}`);
                console.log("Starting teacher grace period timer...");
                

                state.teacherGraceTimeout = setTimeout(async () => {
                    console.log("Teacher grace period expired. Cleaning up state and disconnecting students.");

                    // End active poll in DB
                    if (state.activePoll) {
                        const Poll = require('../models/Poll');
                        await Poll.findByIdAndUpdate(
                            state.activePoll._id,
                            { status: 'ended', endedAt: new Date() },
                            { new: true }
                        );
                    }
                    
                    // Notify & kick all students
                    for (const [sid, student] of state.connectedStudents.entries()) {
                        io.to(sid).emit("message", JSON.stringify({
                            type: "SESSION_TERMINATED",
                            payload: { reason: "Teacher session ended" }
                        }));
                        io.sockets.sockets.get(sid)?.disconnect(true);
                    }
                    
                    // Reset all state
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
                    console.log("Cleared all state after grace period expiration");
                }, state.TEACHER_GRACE_PERIOD);
            });
            
        } else if (role === "student") {
            setupStudentSocket(io, socket, state);
        }

        setupChatSocket(io, socket, state);
    });
};