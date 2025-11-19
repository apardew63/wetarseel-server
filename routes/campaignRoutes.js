const express = require("express");
const { createCampaign, getCampaigns, getCampaign, deleteCampaign } = require("../controllers/campaignController");

const router = express.Router();

router.post("/", createCampaign);
router.get("/", getCampaigns);
router.get("/:id", getCampaign);
router.delete("/:id", deleteCampaign);

module.exports = router;