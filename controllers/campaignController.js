const Campaign = require("../models/campaign");

const createCampaign = async (req, res) => {
  try {
    const { campaignName, listName, status, type, template, createdBy } = req.body;
    const newCampaign = new Campaign({
      campaignName,
      listName,
      status,
      type,
      template,
      createdBy,
    });
    await newCampaign.save();
    res.status(201).json(newCampaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find()
      .populate("template")
      .populate("createdBy")
      .sort({ createdAt: -1 });
    res.status(200).json(campaigns);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
};

const getCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate("template")
      .populate("createdBy");
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteCampaign = async (req, res) => {
  try {
    const deleted = await Campaign.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Campaign not found" });
    res.json({ message: "Campaign deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createCampaign, getCampaigns, getCampaign, deleteCampaign };