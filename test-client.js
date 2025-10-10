// test-client.js
const { io } = require("socket.io-client");

const socket = io("http://localhost:3001", {
  auth: {
    token: "your_test_jwt_token_here"  // needs to match your backend auth logic
  }
});

// when connected
socket.on("connect", () => {
  console.log("✅ Connected to server with id:", socket.id);

  // test join a conversation
  socket.emit("join", { conversationId: "123" });

  // test sending a message
  socket.emit("message:send", {
    conversationId: "123",
    body: "Hello from client!",
    attachments: []
  }, (ack) => {
    console.log("Ack from server:", ack);
  });
});

// when new message is broadcast
socket.on("message:new", (msg) => {
  console.log("📩 New message:", msg);
});

// when typing indicator is received
socket.on("typing", (data) => {
  console.log("✍️ Typing event:", data);
});

// on disconnect
socket.on("disconnect", () => {
  console.log("❌ Disconnected from server");
});
