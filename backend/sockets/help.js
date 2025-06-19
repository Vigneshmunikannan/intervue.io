// Student Socket Handler
const Answer = require('./models/Answer');

// Student Socket Events
socket.on("submit-answer", async (data) => {
    // data: { questionId, selectedOption, studentName }
    console.log('Student answer received:', data);
    
    if (!activeQuestion || !data.questionId) {
        socket.emit("message", JSON.stringify({
            type: "ANSWER_ERROR",
            payload: "No active question or invalid question ID"
        }));
        return;
    }
    
    // Check if question is still active
    if (activeQuestion._id.toString() !== data.questionId.toString()) {
        socket.emit("message", JSON.stringify({
            type: "ANSWER_ERROR",
            payload: "Question is no longer active"
        }));
        return;
    }
    
    // Check if student already answered
    const existingAnswer = await Answer.findOne({
        questionId: data.questionId,
        socketId: socket.id
    });
    
    if (existingAnswer) {
        socket.emit("message", JSON.stringify({
            type: "ANSWER_ERROR",
            payload: "You have already answered this question"
        }));
        return;
    }
    
    // Check if submission is within time limit
    const currentTime = new Date();
    const timeDiff = (currentTime - questionStartTime) / 1000; // in seconds
    
    if (timeDiff > activeQuestion.duration) {
        socket.emit("message", JSON.stringify({
            type: "ANSWER_ERROR",
            payload: "Time limit exceeded. Answer not accepted."
        }));
        return;
    }
    
    try {
        // Determine if answer is correct
        const selectedOptionIndex = parseInt(data.selectedOption);
        const isCorrect = activeQuestion.options[selectedOptionIndex]?.isCorrect || false;
        
        // Save answer to database
        const answer = new Answer({
            questionId: data.questionId,
            studentName: data.studentName || studentNames.get(socket.id) || 'Anonymous',
            socketId: socket.id,
            selectedOption: selectedOptionIndex,
            isCorrect: isCorrect,
            answeredAt: currentTime
        });
        
        await answer.save();
        
        // Store in memory for real-time tracking
        studentAnswers.set(socket.id, {
            selectedOption: selectedOptionIndex,
            isCorrect: isCorrect,
            studentName: answer.studentName,
            answeredAt: currentTime
        });
        
        // Acknowledge to student
        socket.emit("message", JSON.stringify({
            type: "ANSWER_SUBMITTED",
            payload: {
                questionId: data.questionId,
                selectedOption: selectedOptionIndex,
                message: "Answer submitted successfully"
            }
        }));
        
        // Update teacher with response count
        if (teacherSocket) {
            teacherSocket.emit("message", JSON.stringify({
                type: "STUDENT_ANSWERED",
                payload: {
                    questionId: data.questionId,
                    totalResponses: studentAnswers.size,
                    totalStudents: connectedStudents.size,
                    studentName: answer.studentName
                }
            }));
        }
        
        // If all students have answered, end question early
        if (studentAnswers.size >= connectedStudents.size) {
            console.log('All students answered, ending question early');
            if (questionTimer) {
                clearInterval(questionTimer);
            }
            await endCurrentQuestion();
        }
        
    } catch (err) {
        console.error('Error saving answer:', err);
        socket.emit("message", JSON.stringify({
            type: "ANSWER_ERROR",
            payload: "Failed to save answer: " + err.message
        }));
    }
});

// Handle real-time timer updates
socket.on("timer-update", (data) => {
    // Students receive this automatically from the server
    // This is just for any client-side timer sync if needed
    console.log('Timer update received:', data);
});

// Handle student joining
socket.on("join-as-student", (data) => {
    // data: { name, pollCode }
    console.log('Student joining:', data);
    
    if (!activePoll || !data.pollCode) {
        socket.emit("message", JSON.stringify({
            type: "JOIN_ERROR",
            payload: "Invalid poll code or no active poll"
        }));
        return;
    }
    
    // Add student to connected students
    connectedStudents.set(socket.id, socket);
    studentNames.set(socket.id, data.name || 'Anonymous');
    
    // Acknowledge successful join
    socket.emit("message", JSON.stringify({
        type: "JOINED_SUCCESSFULLY",
        payload: {
            message: "Successfully joined the poll",
            studentName: data.name,
            pollCode: data.pollCode,
            hasActiveQuestion: !!activeQuestion
        }
    }));
    
    // If there's an active question, send it to the new student
    if (activeQuestion && questionStartTime) {
        const currentTime = new Date();
        const elapsed = Math.floor((currentTime - questionStartTime) / 1000);
        const remainingTime = Math.max(0, activeQuestion.duration - elapsed);
        
        if (remainingTime > 0) {
            socket.emit("message", JSON.stringify({
                type: "NEW_QUESTION",
                payload: {
                    questionId: activeQuestion._id,
                    questionText: activeQuestion.questionText,
                    options: activeQuestion.options.map((opt, index) => ({
                        index: index,
                        text: opt.text
                    })),
                    duration: activeQuestion.duration,
                    remainingTime: remainingTime,
                    startTime: questionStartTime
                }
            }));
        }
    }
    
    // Notify teacher about new student
    if (teacherSocket) {
        teacherSocket.emit("message", JSON.stringify({
            type: "STUDENT_JOINED",
            payload: {
                studentName: data.name,
                totalStudents: connectedStudents.size
            }
        }));
    }
});

// Handle student disconnect
socket.on("disconnect", () => {
    if (connectedStudents.has(socket.id)) {
        const studentName = studentNames.get(socket.id) || 'Anonymous';
        console.log(`Student ${studentName} disconnected`);
        
        // Remove from connected students
        connectedStudents.delete(socket.id);
        studentNames.delete(socket.id);
        
        // Remove from current question answers if exists
        studentAnswers.delete(socket.id);
        
        // Notify teacher
        if (teacherSocket) {
            teacherSocket.emit("message", JSON.stringify({
                type: "STUDENT_LEFT",
                payload: {
                    studentName: studentName,
                    totalStudents: connectedStudents.size,
                    totalResponses: studentAnswers.size
                }
            }));
        }
    }
});

// Helper function to get student's current status
socket.on("get-status", () => {
    const response = {
        type: "STATUS_UPDATE",
        payload: {
            isConnected: connectedStudents.has(socket.id),
            studentName: studentNames.get(socket.id),
            hasActivePoll: !!activePoll,
            hasActiveQuestion: !!activeQuestion,
            hasAnswered: studentAnswers.has(socket.id)
        }
    };
    
    if (activeQuestion && questionStartTime) {
        const currentTime = new Date();
        const elapsed = Math.floor((currentTime - questionStartTime) / 1000);
        const remainingTime = Math.max(0, activeQuestion.duration - elapsed);
        
        response.payload.activeQuestion = {
            questionId: activeQuestion._id,
            questionText: activeQuestion.questionText,
            options: activeQuestion.options.map((opt, index) => ({
                index: index,
                text: opt.text
            })),
            remainingTime: remainingTime
        };
    }
    
    socket.emit("message", JSON.stringify(response));
});

// Auto-mark non-respondents as wrong when question ends
async function markNonRespondentsAsWrong(questionId) {
    if (!activeQuestion) return;
    
    try {
        // Get all students who didn't answer
        const nonRespondents = [];
        
        connectedStudents.forEach((studentSocket, socketId) => {
            if (!studentAnswers.has(socketId)) {
                nonRespondents.push({
                    socketId: socketId,
                    studentName: studentNames.get(socketId) || 'Anonymous'
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
            console.log(`Marked ${wrongAnswers.length} non-respondents as wrong`);
        }
        
    } catch (err) {
        console.error('Error marking non-respondents:', err);
    }
}

// Update the endCurrentQuestion function to include non-respondents
async function endCurrentQuestion() {
    if (!activeQuestion) return;
    
    try {
        // Mark non-respondents as wrong
        await markNonRespondentsAsWrong(activeQuestion._id);
        
        // 1. Mark question as ended in DB
        activeQuestion.status = 'ended';
        activeQuestion.endedAt = new Date();
        await activeQuestion.save();
        
        // 2. Calculate results
        const results = await calculateQuestionResults();
        
        // 3. Send results to teacher
        if (teacherSocket) {
            teacherSocket.emit("message", JSON.stringify({
                type: "QUESTION_RESULTS",
                payload: {
                    questionId: activeQuestion._id,
                    questionText: activeQuestion.questionText,
                    results: results,
                    totalStudents: connectedStudents.size,
                    totalResponses: studentAnswers.size
                }
            }));
        }
        
        // 4. Send results to students
        const studentResultsData = {
            type: "QUESTION_ENDED",
            payload: {
                questionId: activeQuestion._id,
                results: results.map(r => ({
                    optionText: r.optionText,
                    percentage: r.percentage,
                    isCorrect: r.isCorrect
                }))
            }
        };
        
        connectedStudents.forEach((studentSocket) => {
            studentSocket.emit("message", JSON.stringify(studentResultsData));
        });
        
        // 5. Clean up
        activeQuestion = null;
        questionStartTime = null;
        studentAnswers.clear();
        
    } catch (err) {
        console.error('Error ending question:', err);
    }
}