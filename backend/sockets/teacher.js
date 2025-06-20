// --- Enhanced teacher.js with Activity Tracking ---
const Poll = require('../models/Poll');
const Answer = require('../models/Answer');
const Question = require('../models/Question');

/**
 * Creates a poll for the teacher and notifies waiting students.
 */
async function createPollForTeacher(io, state, pollData) {
    console.log(state.waitingStudents.size, "students waiting for question");

    for (const [sid, studentObj] of state.waitingStudents.entries()) {
        const studentSocket = studentObj.socket;
        if (studentSocket && typeof studentSocket.emit === "function") {
            // First emit the message
            studentSocket.emit("message", JSON.stringify({
                type: "WAITING_FOR_QUESTION1",
                payload: {
                    originalName: studentObj.studentName,
                    studentSessionId: studentObj.studentSessionId
                }
            }));
            console.log(studentObj)

            // Then add to connected students with all necessary properties
            state.connectedStudents.set(sid, {
                socket: studentSocket,
                socketId: sid,
                originalName: studentObj.originalName,
                studentSessionId: studentObj.studentSessionId,
                joinedAt: new Date()
            });

            // Log the transfer
            console.log(`[STUDENT MOVED] ${studentObj.studentName} moved to connected state`);
        }
        // Remove from waiting list
        state.waitingStudents.delete(sid);
    }

    console.log(state.waitingStudents.size, "students waiting for question");
    if (state.activePoll) {
        console.log("Poll already active, cannot create a new one.");

        if (state.teacherSocket) {
            const isFirst = !state.activePoll.questions || state.activePoll.questions.length === 0;

            // Update teacher activity
            state.updateTeacherActivity('POLL_ALREADY_ACTIVE', {
                pollStatus: 'active',
                questionsCount: state.activePoll.questions?.length || 0,
                isFirstQuestion: isFirst
            });

            state.teacherSocket.emit("message", JSON.stringify({
                type: "POLL_ALREADY_ACTIVE",
                payload: {
                    first: isFirst,
                    studentsCount: state.connectedStudents.size,
                    waitingCount: state.waitingStudents.size
                }
            }));
        }

        return;
    }

    const poll = new Poll({
        ...pollData,
        teacherName: state.teacherName,
        status: 'active',
        createdAt: new Date()
    });

    await poll.save();
    state.setActivePoll(poll);
    console.log(`[POLL SAVED] ${poll._id} by ${state.teacherName}`);
    console.log(`[POLL CREATED] ${poll._id} by ${state.teacherName}`);


    if (state.teacherSocket) {
        state.teacherSocket.emit("message", JSON.stringify({
            type: "POLL_CREATED",
            payload: {
                pollId: poll._id,
                first: true,
                studentsCount: state.connectedStudents.size,
                waitingCount: state.waitingStudents.size
            }
        }));
    }
}

async function setupTeacherSocket(io, socket, state) {
    console.log(state.connectedStudents);

    socket.on("ask-new-question", () => {
        const isFirst = (state.activePoll.questions?.length ?? 0) === 0;

        if (state.teacherSocket && state.teacherSocket.connected) {
            state.teacherSocket.emit("message", JSON.stringify({
                type: "POLL_ALREADY_ACTIVE",
                payload: {
                    first: isFirst,
                    studentsCount: state.connectedStudents.size,
                    waitingCount: state.waitingStudents.size
                }
            }));
        }
    });

    socket.on("view-history", async () => {
        try {

            if (!state.activePoll || !state.activePoll._id) {
                await terminateSessionAndCleanup(state, socket, io);
                return;
            }

            // Fetch all questions for the current poll
            const questions = await Question.find({ pollId: state.activePoll._id }).lean();

            // For each question, calculate results
            const history = [];
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                // Fetch all answers for this question
                const answers = await Answer.find({ questionId: q._id }).lean();
                const totalStudents = state.connectedStudents.size + state.waitingStudents.size;
                const totalResponses = answers.length;
                const responseRate = totalStudents > 0 ? Math.round((totalResponses / totalStudents) * 100) : 0;

                // Calculate option stats
                const optionStats = q.options.map((opt, idx) => {
                    const count = answers.filter(a => a.selectedOption === idx).length;
                    return {
                        optionText: opt.text,
                        isCorrect: opt.isCorrect,
                        count,
                        percentage: totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0
                    };
                });

                history.push({
                    questionId: q._id,
                    questionNumber: i + 1,
                    questionText: q.questionText,
                    options: optionStats,
                    totalStudents,
                    totalResponses,
                    responseRate,
                    summary: `Results for Question ${i + 1}`
                });
            }

            // Store history in teacher state
            state.updateTeacherActivity('HISTORY_VIEWED', {
                questionStatus: 'history_displayed',
                historyData: history,
                totalQuestions: history.length
            });

            socket.emit("message", JSON.stringify({
                type: "HISTORY_RESULT",
                payload: {
                    questions: history
                }
            }));
        } catch (err) {
            await terminateSessionAndCleanup(state, socket, io);
        }
    });

    // Helper function to terminate all students and cleanup state
    async function terminateSessionAndCleanup(state, socket, io) {

        // Notify and disconnect all connected students
        state.connectedStudents.forEach((studentObj, sid) => {
            const studentSocket = studentObj.socket;
            if (studentSocket && typeof studentSocket.emit === "function") {
                studentSocket.emit("message", JSON.stringify({
                    type: "SESSION_TERMINATED",
                    payload: { reason: "Session terminated due to a system error." }
                }));
                studentSocket.disconnect(true);
            }
        });

        // Notify and disconnect all waiting students
        state.waitingStudents.forEach((studentObj, sid) => {
            const studentSocket = studentObj.socket;
            if (studentSocket && typeof studentSocket.emit === "function") {
                studentSocket.emit("message", JSON.stringify({
                    type: "SESSION_TERMINATED",
                    payload: { reason: "Session terminated due to a system error." }
                }));
                studentSocket.disconnect(true);
            }
        });

        // End the poll in MongoDB
        if (state.activePoll && state.activePoll._id) {
            await Poll.findByIdAndUpdate(
                state.activePoll._id,
                { status: 'ended', endedAt: new Date() },
                { new: true }
            );
        }

        // Clear all state
        state.connectedStudents.clear();
        state.waitingStudents.clear();
        state.studentNames.clear();
        state.studentAnswers.clear();
        state.activePoll = null;
        state.activeQuestion = null;
        state.questionTimer = null;

        // Notify teacher
        socket.emit("message", JSON.stringify({
            type: "SESSION_TERMINATED",
            payload: { reason: "Session terminated due to a system error." }
        }));

        console.log("[SESSION TERMINATED] All students disconnected, state cleared, poll ended due to history fetch error.");
    }

    socket.on("stop-test", async () => {

        // Notify and disconnect all connected students
        state.connectedStudents.forEach((studentObj, sid) => {
            const studentSocket = studentObj.socket;
            if (studentSocket && typeof studentSocket.emit === "function") {
                studentSocket.emit("message", JSON.stringify({
                    type: "SESSION_TERMINATED",
                    payload: { reason: "Test has been stopped by the teacher." }
                }));
                studentSocket.disconnect(true);
            }
        });

        // Notify and disconnect all waiting students
        state.waitingStudents.forEach((studentObj, sid) => {
            const studentSocket = studentObj.socket;
            if (studentSocket && typeof studentSocket.emit === "function") {
                studentSocket.emit("message", JSON.stringify({
                    type: "SESSION_TERMINATED",
                    payload: { reason: "Test has been stopped by the teacher." }
                }));
                studentSocket.disconnect(true);
            }
        });

        // End the poll in MongoDB
        if (state.activePoll && state.activePoll._id) {
            await Poll.findByIdAndUpdate(
                state.activePoll._id,
                { status: 'ended', endedAt: new Date() },
                { new: true }
            );
        }

        // Clear all state
        state.connectedStudents.clear();
        state.waitingStudents.clear();
        state.studentNames.clear();
        state.studentAnswers.clear();
        state.activePoll = null;
        state.activeQuestion = null;
        state.questionTimer = null;

        // Optionally, notify the teacher
        socket.emit("message", JSON.stringify({
            type: "TEST_STOPPED",
            payload: { message: "Test has been stopped, all students disconnected, and poll ended." }
        }));

        console.log("[STOP TEST] All student sessions terminated, state cleared, and poll ended.");
    });

    socket.on("add-question", async (data) => {
        console.log(state);
        if (state.activePoll) {
            console.log("Adding question to active poll:", state.activePoll._id);
            try {
                if (state.connectedStudents.size === 0) {

                    socket.emit("message", JSON.stringify({
                        type: "NO_STUDENTS_CONNECTED",
                        payload: {
                            message: "No students have joined yet. Please wait for students to connect before adding questions.",
                            status: "warning"
                        }
                    }));
                    return; // Exit early
                }

                // Calculate question number (1-based)
                const questionNumber = (state.activePoll.questions?.length || 0) + 1;

                // 1. Create question in DB
                const question = new Question({
                    pollId: state.activePoll._id,
                    questionText: data.text,
                    options: data.options,
                    duration: data.duration,
                    status: 'active',
                    questionNumber: questionNumber
                });

                await question.save();

                // 2. Set as active question
                state.activeQuestion = question;
                state.questionStartTime = new Date();
                state.studentAnswers.clear(); // Clear previous answers

                // Update teacher activity with detailed question data
                state.updateTeacherActivity('QUESTION_ACTIVE', {
                    questionStatus: 'active',
                    currentQuestionData: {
                        id: question._id,
                        questionNumber: questionNumber,
                        questionText: question.questionText,
                        options: question.options,
                        duration: question.duration,
                        startTime: state.questionStartTime
                    }
                });

                // 3. Add to in-memory poll state
                state.activePoll.questions = state.activePoll.questions || [];
                state.activePoll.questions.push(question);
                await state.activePoll.save();

                for (const [sid, studentObj] of state.connectedStudents.entries()) {
                    const studentSocket = studentObj.socket;
                    if (studentSocket && typeof studentSocket.emit === "function") {
                        studentSocket.emit("message", JSON.stringify({
                            type: "NEW_QUESTION",
                            payload: {
                                questionId: question._id,
                                questionNumber: questionNumber,
                                questionText: question.questionText,
                                options: question.options.map((opt, index) => ({
                                    index: index,
                                    text: opt.text
                                })),
                                duration: question.duration,
                                startTime: state.questionStartTime
                            }
                        }));
                    }
                    state.waitingStudents.delete(sid);
                }

                // 5. Start countdown timer for both teacher and students
                startQuestionTimer(question.duration, state, io);

                // 6. Acknowledge to teacher
                socket.emit("message", JSON.stringify({
                    type: "QUESTION_ADDED",
                    payload: {
                        question: data.text,
                        questionId: question._id,
                        questionNumber: questionNumber,
                        duration: question.duration,
                        studentsCount: state.connectedStudents.size,
                        status: `Question ${questionNumber} successfully added and broadcasted to students`
                    }
                }));

                // 7. Notify teacher that question is live
                socket.emit("message", JSON.stringify({
                    type: "QUESTION_LIVE",
                    payload: {
                        questionId: question._id,
                        questionNumber: questionNumber,
                        message: `Question ${questionNumber} is now live for students`,
                        startTime: state.questionStartTime,
                        duration: question.duration
                    }
                }));

            } catch (err) {
                console.error('Error adding question:', err);

                socket.emit("message", JSON.stringify({
                    type: "QUESTION_ADD_ERROR",
                    payload: "Failed to save question: " + err.message
                }));
            }
        } else {
            socket.emit("message", JSON.stringify({
                type: "ERROR",
                payload: "No active poll to add question to."
            }));
        }
    });
}

// Timer function for question duration with real-time updates to both teacher and students
function startQuestionTimer(duration, state, io) {
    let remainingTime = duration;

    if (state.questionTimer) {
        clearInterval(state.questionTimer);
    }

    const questionId = state.activeQuestion._id;
    const questionNumber = state.activeQuestion.questionNumber;

    const broadcastTimer = () => {
        const timerData = {
            questionId,
            questionNumber,
            remainingTime,
            totalTime: duration,
            totalResponses: state.studentAnswers.size,
            totalStudents: state.connectedStudents.size,
            responseRate:
                state.connectedStudents.size > 0
                    ? Math.round((state.studentAnswers.size / state.connectedStudents.size) * 100)
                    : 0,
        };

        const payload = {
            type: "QUESTION_TIMER_UPDATE",
            payload: timerData,
        };

        if (state.teacherSocket) {
            state.teacherSocket.emit("message", JSON.stringify(payload));
        }

        for (const [, studentObj] of state.connectedStudents.entries()) {
            const studentSocket = studentObj.socket;
            if (studentSocket && typeof studentSocket.emit === "function") {
                studentSocket.emit("message", JSON.stringify(payload));
            }
        }
    };

    const checkForEarlyEnd = async () => {
        const allAnswered = state.studentAnswers.size >= state.connectedStudents.size;
        if (allAnswered) {
            clearInterval(state.questionTimer);

            // // Update teacher activity for early end
            // state.updateTeacherActivity('QUESTION_ENDED_EARLY', {
            //     reason: 'All students answered',
            //     questionId: state.activeQuestion._id,
            //     questionNumber: state.activeQuestion.questionNumber
            // });

            await endCurrentQuestion(state);
        }
    };

    broadcastTimer();

    state.questionTimer = setInterval(async () => {
        remainingTime--;
        broadcastTimer();

        await checkForEarlyEnd();

        if (remainingTime <= 0) {
            clearInterval(state.questionTimer);

            await endCurrentQuestion(state);
        }
    }, 1000);
}



async function endCurrentQuestion(state) {
    if (!state.activeQuestion) return;
    try {
        // Get question number from active question or poll length
        const questionNumber = state.activeQuestion.questionNumber ||
            (state.activePoll.questions ? state.activePoll.questions.length : 1);

        await markNonRespondentsAsWrong(state.activeQuestion._id, state);
        state.activeQuestion.status = 'ended';
        state.activeQuestion.endedAt = new Date();
        await state.activeQuestion.save();

        const results = await calculateQuestionResults(state);

        const totalStudents = state.connectedStudents.size;
        const totalResponses = state.studentAnswers.size;
        const responseRate = totalStudents > 0
            ? Math.round((totalResponses / totalStudents) * 100)
            : 0;

        // Teacher payload with question number
        const teacherPayload = {
            type: "QUESTION_RESULTS",
            payload: {
                questionId: state.activeQuestion._id,
                questionNumber: questionNumber, // Add question number here
                questionText: state.activeQuestion.questionText,
                options: results.map(r => ({
                    optionText: r.optionText,
                    isCorrect: r.isCorrect,
                    count: r.count,
                    percentage: r.percentage
                })),
                totalStudents,
                totalResponses,
                responseRate,
                summary: `Results for Question ${questionNumber}` // Fix summary
            }
        };

        // Student payload with question number
        const studentPayload = {
            type: "QUESTION_ENDED",
            payload: {
                questionId: state.activeQuestion._id,
                questionNumber: questionNumber, // Add question number here
                questionText: state.activeQuestion.questionText,
                options: results.map(r => ({
                    optionText: r.optionText,
                    isCorrect: r.isCorrect,
                    count: r.count,
                    percentage: r.percentage
                })),
                totalStudents,
                totalResponses,
                summary: `Results for Question ${questionNumber}` // Fix summary
            }
        };

        if (state.teacherSocket) {
            state.teacherSocket.emit("message", JSON.stringify(teacherPayload));
        }

        state.connectedStudents.forEach(studentObj => {
            const studentSocket = studentObj.socket;
            if (studentSocket && typeof studentSocket.emit === "function") {
                studentSocket.emit("message", JSON.stringify(studentPayload));
            }
        });

        // Notify teacher question ended
        if (state.teacherSocket) {
            state.teacherSocket.emit("message", JSON.stringify({
                type: "QUESTION_ENDED_NOTIFICATION",
                payload: {
                    message: `Question ${state.activeQuestion.questionNumber} has ended and results have been sent`,
                    questionId: state.activeQuestion._id,
                    questionNumber: state.activeQuestion.questionNumber,
                    endedAt: new Date()
                }
            }));
        }

        // Cleanup
        state.activeQuestion = null;
        state.questionStartTime = null;
        state.studentAnswers.clear();

    } catch (err) {
        console.error('Error ending question:', err);
        if (state.teacherSocket) {
            state.teacherSocket.emit("message", JSON.stringify({
                type: "ERROR",
                payload: "Error ending question: " + err.message
            }));
        }
    }
}



// Calculate question results with percentages
async function calculateQuestionResults(state) {
    if (!state.activeQuestion) return [];

    const results = [];
    const totalStudents = state.connectedStudents.size;

    // Get all answers for this question from DB
    const answers = await Answer.find({ questionId: state.activeQuestion._id });

    // Count answers for each option
    const optionCounts = {};
    answers.forEach(answer => {
        optionCounts[answer.selectedOption] = (optionCounts[answer.selectedOption] || 0) + 1;
    });

    // Calculate percentages for each option
    state.activeQuestion.options.forEach((option, index) => {
        const count = optionCounts[index] || 0;
        const percentage = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;

        results.push({
            optionIndex: index,
            optionText: option.text,
            count: count,
            percentage: percentage,
            isCorrect: option.isCorrect
        });
    });

    return results;
}

// Mark non-respondents as wrong when question ends
async function markNonRespondentsAsWrong(questionId, state) {
    if (!state.activeQuestion) return;

    try {
        // Get all students who didn't answer
        const nonRespondents = [];

        state.connectedStudents.forEach((studentSocket, socketId) => {
            if (!state.studentAnswers.has(socketId)) {
                nonRespondents.push({
                    socketId: socketId,
                    studentName: state.studentNames.get(socketId) || 'Anonymous'
                });
            }
        });

        // Create wrong answers for non-respondents
        const wrongAnswers = nonRespondents.map(student => ({
            questionId: questionId,
            studentName: student.studentName,
            socketId: student.socketId,
            selectedOption: -1, // -1 indicates no answer
            isCorrect: false,
            answeredAt: new Date()
        }));

        if (wrongAnswers.length > 0) {
            await Answer.insertMany(wrongAnswers);
            console.log(`Marked ${wrongAnswers.length} non-respondents as wrong for Question ${state.activeQuestion.questionNumber}`);

            // Notify teacher about non-respondents
            if (state.teacherSocket) {
                state.teacherSocket.emit("message", JSON.stringify({
                    type: "NON_RESPONDENTS_MARKED",
                    payload: {
                        questionNumber: state.activeQuestion.questionNumber, // Include question number
                        count: wrongAnswers.length,
                        students: nonRespondents.map(s => s.studentName),
                        message: `${wrongAnswers.length} students didn't respond to Question ${state.activeQuestion.questionNumber}`
                    }
                }));
            }
        }

    } catch (err) {
        console.error('Error marking non-respondents:', err);
    }
}

module.exports = {
    createPollForTeacher,
    setupTeacherSocket
};

