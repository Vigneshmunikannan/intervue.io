const express = require("express");
const router = express.Router();
const pollController = require("../Controllers/pollController");

const { getPollResultsById ,getChatsByPollId} = require('../Controllers/pollController');

// GET /api/polls
router.get("/", pollController.getAllPolls);

router.get('/:id/results', getPollResultsById);
router.get('/chats/poll/:pollId', getChatsByPollId);

module.exports = router;