const express = require("express");
const router = express.Router();
const pollController = require("../Controllers/pollController");

const { getPollResultsById } = require('../Controllers/pollController');

// GET /api/polls
router.get("/", pollController.getAllPolls);

router.get('/:id/results', getPollResultsById);

module.exports = router;