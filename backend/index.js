const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const setupSocket = require("./sockets/socketManager");
const pollRoutes = require("./routes/pollRoutes");
require("dotenv").config();
const connectDB = require('./config/db');





const PORT = process.env.PORT || 4000;

const app = express();
connectDB()
const server = http.createServer(app);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());


app.use("/api/polls", pollRoutes);
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
