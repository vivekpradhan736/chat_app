const express = require('express');
const connectDB = require('./config/db');
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware.js");
const { chats } = require('./data/data');
const path = require("path");
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');

dotenv.config();
connectDB();
const app = express();
app.use(express.json()); // to accept json data
app.use(bodyParser.json());
app.use(cors());

// Daily.co credentials
const apiKey = '2ab861b26dad9a80540fb82235cf6100fe46e312436c4b33c9cbffc90656d7ac';

// Create a room
app.post('/create-room', async (req, res) => {
  try {
      const response = await axios.post('https://api.daily.co/v1/rooms', {
          properties: { enable_chat: true }
      }, {
          headers: { Authorization: `Bearer ${apiKey}` }
      });
      res.json(response.data);
  } catch (error) {
      res.status(500).send(error);
  }
});

// routes
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/message', messageRoutes);

// --------------------------deployment------------------------------

const __dirname1 = path.resolve();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}

// --------------------------deployment------------------------------

// Error Handling middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log(`Server running on PORT ${PORT}...`.yellow.bold)
);

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:3000",
  },
});

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    console.log("userData._id",userData._id)
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageRecieved) => {
    var chat = newMessageRecieved.chat;

    if (!chat?.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id == newMessageRecieved.sender._id) return;

      socket.in(user._id).emit("message recieved", newMessageRecieved);
    });
  });
});