const express = require("express");
const { signup, signin, getProfile } = require("../controllers/authController");
const { authenticateRequest } = require("../middlewares/auth");

const router = express.Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.get("/profile", authenticateRequest, getProfile);

module.exports = router;