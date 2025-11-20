const contact = require("../models/contact");
const fs = require("fs");

const createContact = async (req, res) => {
  try {
    const { name, email, phone, tags, list, status } = req.body;
    console.log(req.body)

    const newContact = new contact({
      name,
      email,
      phone,
      tags: tags ? tags.split(",").map(t => t.trim()) : [],
      list,
      status
    });

    await newContact.save();
    res.status(201).json(newContact);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


const getAllContacts = async (req, res) => {
  try {
    const contacts = await contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// SEARCH CONTACT BY NAME / PHONE / EMAIL
const searchContact = async (req, res) => {
  try {
    const query = req.params.query;

    const results = await contact.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } }
      ],
    });

    if (!results.length)
      return res.status(404).json([]);

    res.json(results);
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

module.exports = { createContact, getAllContacts, searchContact, updateContact, deleteContact, uploadContactsCSV };