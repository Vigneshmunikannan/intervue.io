const { v4: uuidv4 } = require('uuid');
const Answer = require('../models/Answer');
const Question = require('../models/Question');

// Helper function to check if student session exists
const isStudentSessionExists = (sessionId, state) => {
    // Check in connected students
    for (const [_, student] of state.connectedStudents) {
        if (student.studentSessionId === sessionId) {
            console.log(`Found existing session in connected students: ${sessionId}`);
            return true;
        }
    }
    // Check in waiting students
    for (const [_, student] of state.waitingStudents) {
        if (student.studentSessionId === sessionId) {
            console.log(`Found existing session in waiting students: ${sessionId}`);
            return true;
        }
    }
    return false;
};

// Helper function to find student session and return details
const findStudentSession = (sessionId, state) => {
    // Check in connected students
    for (const [socketId, student] of state.connectedStudents) {
        if (student.studentSessionId === sessionId) {
            return {
                location: 'connected',
                socketId,
                student
            };
        }
    }
    // Check in waiting students
    for (const [socketId, student] of state.waitingStudents) {
        if (student.studentSessionId === sessionId) {
            return {
                location: 'waiting',
                socketId,
                student
            };
        }
    }
    return null;
};

// Helper function to determine student's current state
const getStudentState = async (studentSessionId, state) => {
    // If no teacher, student should be in waiting
    if (!state.teacherSocket || !state.teacherSocket.connected) {
        return { type: "NO_TEACHER", payload: { studentSessionId } };
    }

    // If no active poll, student waits for first question
    if (!state.activePoll) {
        return {
            type: "WAITING_FOR_QUESTION1",
            payload: {
                originalName: studentSessionId, // Will be updated with actual name
                studentSessionId
            }
        };
    }

    // If poll is active and there's an active question
    if (state.activeQuestion && state.questionStartTime) {
        const question = await Question.findById(state.activeQuestion._id);
        if (question) {
            // Check if question is still active (within duration)
            const currentTime = Date.now();
            const questionEndTime = state.questionStartTime + (question.duration * 1000);
            
            if (currentTime < questionEndTime) {
                // Question is still active, send current question
                return {
                    type: "NEW_QUESTION",
                    payload: {
                        questionId: question._id,
                        questionNumber: state.currentQuestionNumber || 1,
                        questionText: question.questionText,
                        options: question.options.map((opt, index) => ({
                            index: index,
                            text: opt.text
                        })),
                        duration: question.duration,
                        startTime: state.questionStartTime
                    }
                };
            }
        }
    }

    // If poll exists but no active question, or question has ended
    if (state.activePoll && state.currentQuestionNumber > 0) {
        // Poll is in progress but between questions
        return {
            type: "WAITING_FOR_NEXT_QUESTION",
            payload: {
                originalName: studentSessionId, // Will be updated with actual name
                studentSessionId,
                currentQuestionNumber: state.currentQuestionNumber
            }
        };
    }

    // Default state - waiting for first question
    return {
        type: "WAITING_FOR_QUESTION1",
        payload: {
            originalName: studentSessionId, // Will be updated with actual name
            studentSessionId
        }
    };
};

module.exports = function (io, socket, state) {
    const { teacherSocket, connectedStudents, studentNames, waitingStudents } = state;
    const studentName = socket.handshake.query.name;
    let studentSessionId = socket.handshake.query.studentSessionId;

    console.log(`[STUDENT CONNECTED] ${studentName} - Socket: ${socket.id} - Session ID: ${studentSessionId}`);

    // Generate new session ID if needed
    if (!studentSessionId || studentSessionId === "null" || studentSessionId === "undefined") {
        studentSessionId = uuidv4();
        console.log(`Generated new session ID: ${studentSessionId}`);
    }

    // Main connection logic
    const handleStudentConnection = async () => {
        try {
            // Check if this is a reconnection of existing session
            const existingSession = findStudentSession(studentSessionId, state);
            
            if (existingSession) {
                // This is a reconnection - ALWAYS ALLOW reconnections
                console.log(`[RECONNECTION] ${studentName} - SessionID: ${studentSessionId} - Location: ${existingSession.location}`);
                
                // Remove old socket connection
                if (existingSession.location === 'connected') {
                    connectedStudents.delete(existingSession.socketId);
                    // Add to connected with new socket
                    connectedStudents.set(socket.id, {
                        ...existingSession.student,
                        socket,
                        socketId: socket.id,
                        originalName: studentName // Update name in case it changed
                    });
                } else {
                    waitingStudents.delete(existingSession.socketId);
                    // Add to waiting with new socket
                    waitingStudents.set(socket.id, {
                        ...existingSession.student,
                        socket,
                        socketId: socket.id,
                        originalName: studentName // Update name in case it changed
                    });
                }

                // Determine and send appropriate state
                const studentState = await getStudentState(studentSessionId, state);
                studentState.payload.originalName = studentName; // Ensure correct name
                
                socket.emit("message", JSON.stringify(studentState));
                return;
            }

            // ONLY check for poll restrictions AFTER confirming this is NOT a reconnection
            // Block NEW students if:
            // 1. Poll is currently active, OR
            // 2. Poll exists and has questions (even if inactive)
            
            if (state.activePoll && state.activePoll.questions && state.activePoll.questions.length > 0) {
                console.log(`[NEW STUDENT REJECTED] ${studentName} - SessionID: ${studentSessionId} - Poll exists with questions`);
                socket.emit("message", JSON.stringify({
                    type: "SESSION_DENIED",
                    payload: {
                        message: "Quiz session has questions. Cannot accept new students.",
                        reason: "quiz_has_questions",
                        studentName: studentName,
                        studentSessionId: studentSessionId
                    }
                }));
                return socket.disconnect(true);
            }

            // This check is now redundant since we already checked existingSession above
            // But keeping for extra safety in case of edge cases
            if (isStudentSessionExists(studentSessionId, state)) {
                console.log(`[DUPLICATE SESSION] ${studentName} - SessionID: ${studentSessionId}`);
                socket.emit("message", JSON.stringify({
                    type: "SESSION_DENIED",
                    payload: {
                        message: "You are already connected in another window/tab",
                        reason: "duplicate_session",
                        studentName: studentName,
                        studentSessionId: studentSessionId
                    }
                }));
                return socket.disconnect(true);
            }

            // New student connection
            if (!teacherSocket || !teacherSocket.connected) {
                // No teacher: add to waitingStudents
                console.log(`[STUDENT WAITING] ${studentName} - No teacher connected`);
                waitingStudents.set(socket.id, { 
                    socket, 
                    socketId: socket.id,
                    originalName: studentName, 
                    studentSessionId,
                    joinedAt: new Date()
                });
                
                socket.emit("message", JSON.stringify({
                    type: "NO_TEACHER",
                    payload: { studentSessionId }
                }));
                return;
            }

            // Teacher is active - add to connected students
            const currentCount = studentNames.get(studentName) || 0;
            studentNames.set(studentName, currentCount + 1);

            connectedStudents.set(socket.id, {
                socket,
                socketId: socket.id,
                originalName: studentName,
                joinedAt: new Date(),
                studentSessionId
            });

            console.log(`[STUDENT ADDED] ${studentName} - SessionID: ${studentSessionId} - Connected students: ${connectedStudents.size}`);

            // Send appropriate state
            const studentState = await getStudentState(studentSessionId, state);
            studentState.payload.originalName = studentName;
            
            socket.emit("message", JSON.stringify(studentState));

        } catch (error) {
            console.error("Error handling student connection:", error);
            socket.emit("message", JSON.stringify({
                type: "CONNECTION_ERROR",
                payload: { message: "Failed to establish connection" }
            }));
            socket.disconnect(true);
        }
    };

    // Execute connection logic
    handleStudentConnection();

    // Handle answer submission
    socket.on("submit-answer", async (data) => {
        try {
            // Validate if question is active
            if (!state.activeQuestion) {
                socket.emit("message", JSON.stringify({
                    type: "ANSWER_ERROR",
                    payload: { message: "No active question to answer" }
                }));
                return;
            }

            // Check if already answered
            if (state.studentAnswers.has(`${socket.id}-${state.activeQuestion._id}`)) {
                socket.emit("message", JSON.stringify({
                    type: "ANSWER_ERROR",
                    payload: { message: "You have already answered this question" }
                }));
                return;
            }

            // Get question to check correct answer
            const question = await Question.findById(state.activeQuestion._id);
            if (!question) {
                socket.emit("message", JSON.stringify({
                    type: "ANSWER_ERROR",
                    payload: { message: "Question not found" }
                }));
                return;
            }

            // Check if selected option is valid
            const selectedOption = parseInt(data.selectedOption);
            if (selectedOption < 0 || selectedOption >= question.options.length) {
                socket.emit("message", JSON.stringify({
                    type: "ANSWER_ERROR",
                    payload: { message: "Invalid option selected" }
                }));
                return;
            }

            // Check if answer is correct
            const isCorrect = question.options[selectedOption].isCorrect;

            // Create and save answer
            const answer = new Answer({
                questionId: state.activeQuestion._id,
                studentName: studentName,
                socketId: socket.id,
                selectedOption: selectedOption,
                isCorrect: isCorrect,
                answeredAt: new Date()
            });

            await answer.save();

            // Update state
            state.studentAnswers.set(`${socket.id}-${state.activeQuestion._id}`, {
                studentName,
                selectedOption,
                isCorrect,
                answeredAt: new Date()
            });

            // Notify student of successful submission
            socket.emit("message", JSON.stringify({
                type: "ANSWER_SUBMITTED",
                payload: {
                    questionId: state.activeQuestion._id,
                    selectedOption,
                    message: "Answer submitted successfully"
                }
            }));

            // Notify teacher of new submission
            if (state.teacherSocket) {
                state.teacherSocket.emit("message", JSON.stringify({
                    type: "STUDENT_ANSWERED",
                    payload: {
                        studentName,
                        questionId: state.activeQuestion._id,
                        totalAnswers: state.studentAnswers.size
                    }
                }));
            }

        } catch (error) {
            console.error("Error submitting answer:", error);
            socket.emit("message", JSON.stringify({
                type: "ANSWER_ERROR",
                payload: { message: "Failed to submit answer" }
            }));
        }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log(`[STUDENT DISCONNECTED] ${studentName} - Socket: ${socket.id}`);
        connectedStudents.delete(socket.id);
        waitingStudents.delete(socket.id);

        // Clean up student answers
        if (state.activeQuestion) {
            state.studentAnswers.delete(`${socket.id}-${state.activeQuestion._id}`);
        }
    });
};