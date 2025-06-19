const mongoose = require('mongoose');

// Answer Schema
const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  socketId: {
    type: String,
    required: true
  },
  selectedOption: {
    type: Number,
    required: true
  },
  isCorrect: {
    type: Boolean,
    required: true
  },
  answeredAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Answer', answerSchema);