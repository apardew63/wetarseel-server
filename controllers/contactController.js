const contact = require("../models/contact");
const fs = require("fs");

const createContact = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const newContact = new contact({ name, email, phone });
    await newContact.save();
    res.status(201).json(newContact);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getContact = async (req, res) => {
  try {
    const findContact = await contact.findOne({ name: req.params.name });
    if (!findContact)
      return res.status(404).json({ error: "Contact not found" });
    res.json(findContact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateContact = async (req, res) => {
  try {
    const updateContact = await contact.findOneAndUpdate(
      { name: req.params.name },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updateContact)
      return res.status(404).json({ error: "Contact not found" });
    res.json(updateContact);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteContact = async (req, res) => {
  try {
    const delContact = await contact.findOneAndDelete({
      name: req.params.name,
    });
    if (!delContact)
      return res.status(404).json({ error: "Contact not found" });
    res.json({ message: `Contact '${req.params.name}' deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const uploadContactsCSV = async (req, res) => {
  const csv = require("csv-parser");
  try {
    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          await contact.insertMany(results);
          fs.unlinkSync(req.file.path);
          res.json({
            message: "Contacts uploaded successfully!",
            count: results.length,
          });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createContact, getContact, updateContact, deleteContact, uploadContactsCSV };