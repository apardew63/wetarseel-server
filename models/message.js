const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    conversationID: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    body: { type: String },
    attachments: [{ url: String, filename: String, contentType: String}],
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
}, { timestamps:true });

module.exports = mongoose.model("message", messageSchema);