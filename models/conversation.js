const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    title: String, // optional
    lastMessage: { type: String },
    lastActivityAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('conversation', conversationSchema);