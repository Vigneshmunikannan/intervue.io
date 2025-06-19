const mongoose = require('mongoose');

// Question Schema
const questionSchema = new mongoose.Schema({
  pollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poll',
    required: true
  },
  questionText: {
    type: String,
    required: true
  },
  options: [{
    text: String,
    isCorrect: Boolean
  }],
  duration: {
    type: Number,
    default: 60 // 60 seconds
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date,
    default: null
  }
});





module.exports = mongoose.model('Question', questionSchema);
