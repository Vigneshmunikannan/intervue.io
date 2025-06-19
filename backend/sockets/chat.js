const Chat = require('../models/Chat');

module.exports = function(io, socket, state) {
  socket.on("chat-message", async (data) => {
    // data: { message, role, senderName }
    if (!state.activePoll) return;
    const chat = new Chat({
      pollId: state.activePoll._id,
      senderName: data.senderName,
      role: data.role,
      message: data.message
    });
    await chat.save();
    // Broadcast to all in poll
    io.emit("chat-message", {
      senderName: data.senderName,
      role: data.role,
      message: data.message,
      sentAt: chat.sentAt
    });
  });
};