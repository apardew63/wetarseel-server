const message = require("../models/message");
const conversation = require("../models/conversation");

const handleSocketConnection = (io) => {
  io.on("connection", (socket) => {
    const userID = socket.user.id;
    console.log("Socket connected for user", userID);

    socket.on("join", async ({ conversationID }) => {
      socket.join(conversationID);
    });

    socket.on("message:send", async (payload, ack) => {
      try {
        const msg = new message({
          conversationID: payload.conversationID,
          sender: userID,
          body: payload.body,
          attachments: payload.attachments || [],
        });
        await msg.save();

        await conversation.findByIdAndUpdate(payload.conversationID, {
          lastMessage: payload.body,
          lastActivityAt: new Date(),
        });

        io.to(payload.conversationID).emit("message:new", msg);
        if (ack) ack({ ok: true, id: msg._id });
      } catch (err) {
        if (ack) ack({ ok: false, error: err.message });
      }
    });

    socket.on("typing", ({ conversationID, isTyping }) => {
      socket
        .to(conversationID)
        .emit("typing", { userID, conversationID, isTyping });
    });

    socket.on("disconnect", () => {});
  });
};

module.exports = { handleSocketConnection };