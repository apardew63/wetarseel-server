const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    campaignName: { type: String, required: true },
    listName: { type: String, required: true },
    status: { type: String, enum: ["Draft", "Scheduled", "Sent"], default: "Draft" },
    type: { type: String, enum: ["Email", "SMS", "WhatsApp"], required: true },
    template: { type: String, required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("campaign", campaignSchema);