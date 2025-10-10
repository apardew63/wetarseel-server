const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema({
    category: { type: String, enum: ["Marketing", "Carousel", "Utility"], required: true },
    templateName: { type: String, required: true },
    language: { type: String, required: true},
    message: { type: String, required: true},
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, {timestamps: true});

module.exports = mongoose.model("template", templateSchema);
