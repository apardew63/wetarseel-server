const template = require("../models/template");

const createTemplate = async (req, res) => {
  try {
    console.log("📥 Template data received:", req.body);
    const { category, templateName, language, message } = req.body;
    const newTemplate = new template({
      category,
      templateName,
      language,
      message,
    });
    await newTemplate.save();
    res.status(201).json(newTemplate);
  } catch (err) {
    console.error("Error creating template:", err.message);
    res.status(400).json({ error: err.message });
  }
};

const getTemplates = async (req, res) => {
  try {
    console.log("📤 Fetching all templates...");
    const templates = await template.find().populate("createdBy");
    res.status(200).json(templates);
  } catch (err) {
    console.error("❌ Error fetching templates:", err.message);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
};

const getTemplate = async (req, res) => {
  try {
    const findTemplate = await template.findOne({
      templateName: { $regex: new RegExp(`^${req.params.templateName}$`, "i") },
    });
    if (!findTemplate)
      return res.status(404).json({ error: "Template not found" });
    res.json(findTemplate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const updateTemplate = await template.findOneAndUpdate(
      {
        templateName: {
          $regex: new RegExp(`^${req.params.templateName}$`, "i"),
        },
      },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updateTemplate)
      return res.status(404).json({ error: "Template not found" });
    res.json(updateTemplate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const delTemplate = await template.findOneAndDelete({
      templateName: { $regex: new RegExp(`^${req.params.templateName}$`, "i") },
    });
    if (!delTemplate)
      return res.status(404).json({ error: "Template not found" });
    res.json({
      message: `Template '${delTemplate.templateName}' deleted successfully`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createTemplate, getTemplates, getTemplate, updateTemplate, deleteTemplate };