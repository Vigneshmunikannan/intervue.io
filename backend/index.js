const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const setupSocket = require("./sockets/socketManager");
require("dotenv").config();
const connectDB = require('./config/db');

const PORT = process.env.PORT || 4000;

const app = express();
connectDB()
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

setupSocket(io);

app.get("/", (req, res) => {
  res.send("Live Polling Backend is running");
});

server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
