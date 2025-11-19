const express = require("express");
const multer = require("multer");
const { createContact, getContact, updateContact, deleteContact, uploadContactsCSV } = require("../controllers/contactController");

const router = express.Router();

// Setup multer for file upload
const upload = multer({ dest: "uploads/" });

router.post("/", createContact);
router.get("/:name", getContact);
router.put("/:name", updateContact);
router.delete("/:name", deleteContact);
router.post("/upload-csv", upload.single("file"), uploadContactsCSV);

module.exports = router;