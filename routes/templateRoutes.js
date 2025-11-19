const express = require("express");
const { createTemplate, getTemplates, getTemplate, updateTemplate, deleteTemplate } = require("../controllers/templateController");

const router = express.Router();

router.post("/", createTemplate);
router.get("/", getTemplates);
router.get("/:templateName", getTemplate);
router.put("/:templateName", updateTemplate);
router.delete("/:templateName", deleteTemplate);

module.exports = router;