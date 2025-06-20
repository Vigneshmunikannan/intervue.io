// controllers/pollController.js
const Poll = require('../models/Poll');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Chat = require('../models/Chat');

exports.getEndedPolls = async (req, res) => {
    try {
        const endedPolls = await Poll.find({ status: 'ended' }).sort({ endedAt: -1 });
        res.json(endedPolls);
    } catch (error) {
        console.error("Error fetching ended polls:", error);
        res.status(500).json({ message: "Failed to fetch ended polls." });
    }
};


exports.getPollResultsById = async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ message: "Poll not found." });

    const questions = await Question.find({ pollId: poll._id });
    const resultPayload = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const answers = await Answer.find({ questionId: q._id });
      const totalResponses = answers.length;
      const uniqueStudents = new Set(answers.map(a => a.socketId));
      const totalStudents = uniqueStudents.size;

      // Count per option
      const counts = Array(q.options.length).fill(0);
      answers.forEach(a => {
        if (a.selectedOption >= 0 && a.selectedOption < counts.length) {
          counts[a.selectedOption]++;
        }
      });

      // Build results
      const options = q.options.map((opt, idx) => ({
        optionText: opt.text,
        isCorrect: opt.isCorrect,
        count: counts[idx],
        percentage: totalResponses > 0
          ? Math.round((counts[idx] / totalResponses) * 100)
          : 0
      }));

      resultPayload.push({
        questionId: q._id,
        questionNumber: i + 1,
        questionText: q.questionText,
        options,
        totalStudents,
        totalResponses,
        summary: `Results for Question ${i + 1}`,
      });
    }

    res.json({
      pollId: poll._id,
      title: poll.title,
      teacherName: poll.teacherName,
      status: poll.status,
      results: resultPayload,
    });
  } catch (error) {
    console.error("Error fetching poll results:", error);
    res.status(500).json({ message: "Failed to fetch poll results." });
  }
};

exports.getChatsByPollId = async (req, res) => {
  try {
    const { pollId } = req.params;
    const chats = await Chat.find({ pollId }).sort({ sentAt: 1 }); // sorted oldest first
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Failed to fetch chats.' });
  }
};
