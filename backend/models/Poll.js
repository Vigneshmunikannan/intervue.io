

const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    default: function() {
      return `Teacher Poll ${Date.now()}`;
    }
  },
  teacherName: {
    type: String,
    required: true
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

module.exports = mongoose.model('Poll', pollSchema);
