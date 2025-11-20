const express = require("express");
const multer = require("multer");
const { createContact, getAllContacts, updateContact, deleteContact, uploadContactsCSV, searchContact } = require("../controllers/contactController");

const router = express.Router();

// Setup multer for file upload
const upload = multer({ dest: "uploads/" });

router.post("/", createContact);
router.get("/", getAllContacts);
router.get("/search/:query", searchContact);
router.put("/:name", updateContact);
router.delete("/:name", deleteContact);
router.post("/upload-csv", upload.single("file"), uploadContactsCSV);

module.exports = router;