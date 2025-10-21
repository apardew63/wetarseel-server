require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { createClient } = require("@supabase/supabase-js");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const IORedis = require("ioredis");

const contact = require("./models/contact");
const template = require("./models/template");
const message = require("./models/message");
const conversation = require("./models/conversation");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(cors());
app.use(express.json());

// Supabase client with service_role key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.get("/", (req, res) => {
  res.send("server is running");
});

// Setup multer for file upload
const upload = multer({ dest: "uploads/" });

//==============
// AUTH CRUD
//==============

// Redis adapter for horizontal scaling
const pubClient = new IORedis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

// Signup
app.post("/signup", async (req, res) => {
  console.log("Signup request received:", req.body);
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password) {
    console.log("Missing email or password");
    return res.status(400).json({ error: "Email and password required" });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  console.log("Supabase createUser result:", { data, error });

  if (error) {
    console.log("Signup error:", error.message);
    return res.status(400).json({ error: error.message });
  }
  console.log("Signup successful for:", email);
  res.json({ user: data.user, message: "Signup successful" });
});

// Signin
app.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

app.get("/profile", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error) return res.status(403).json({ error: error.message });

  res.json({ message: "Protected route", user });
});

//==============
// CONTACT CRUD
//==============
// --- CRUD for Contact ---

//Create Contact
app.post("/contact", async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const newContact = new contact({ name, email, phone });
    await newContact.save();
    res.status(201).json(newContact);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

//Get Single Contact
app.get("/contact/:name", async (req, res) => {
  try {
    const findContact = await contact.findOne({ name: req.params.name });
    if (!findContact)
      return res.status(404).json({ error: "Contact not found" });
    res.json(findContact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Update Contact
app.put("/contact/:name", async (req, res) => {
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
});

//Delete Contact
app.delete("/contact/:name", async (req, res) => {
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
});

//Contacts.CSV file upload/processing
app.post("/upload-csv", upload.single("file"), async (req, res) => {
  try {
    const results = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          //inserting all contacts into mongodb
          await contact.insertMany(results);
          //delete file after extracting data
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
});

// --- CRUD for Template ---

app.post("/template", async (req, res) => {
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
});

// Get Single Template by Template Name
app.get("/template/:templateName", async (req, res) => {
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
});

// Update Template by Template Name
app.put("/template/:templateName", async (req, res) => {
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
});

// Delete Template by Template Name
app.delete("/template/:templateName", async (req, res) => {
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
});

// Socket authentication
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];
    if (!token) return next(new Error("No Token"));

    //validate token with Supabase
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return next(new Error("Invalid token")); //reject if invalid

    socket.user = data.user; //attach user info to socket
    return next(); //allow connection
  } catch (e) {
    return next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const userID = socket.user.id;
  console.log("Socket connected for user", userID);

  socket.on("join", async ({ conversationID }) => {
    socket.join(conversationID);
  });

  socket.on("message:send", async (payload, ack) => {
    try {
      const msg = new message({
        conversationID: payload.conversationID,
        sender: userID,
        body: payload.body,
        attachments: payload.attachments || [],
      });
      await msg.save();

      //update conversation last message
      await conversation.findByIdAndUpdate(payload.conversationID, {
        lastMessage: payload.body,
        lastActivityAt: new Date(),
      });
      //braodcast to room
      io.to(payload.conversationID).emit("message:new", msg);
      //send ack back to sender
      if (ack) ack({ ok: true, id: msg._id });
    } catch (err) {
      if (ack) ack({ ok: false, error: err.message });
    }
  });

  socket.on("typing", ({ conversationID, isTyping }) => {
    socket
      .to(conversationID)
      .emit("typing", { userID, conversationID, isTyping });
  });

  socket.on("disconnect", () => {
    //broadcast offline
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

//const PORT = process.env.PORT || 3001;
//app.listen(PORT, () => {
//    console.log(`Server running at http://localhost:${PORT}`);
