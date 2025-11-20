const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  tags: { type: [String] },
  list: { type: String },
  status: { type: String, enum: ["new", "active", "inactive"] }
}, { timestamps: true });

module.exports = mongoose.model("contact", contactSchema);
