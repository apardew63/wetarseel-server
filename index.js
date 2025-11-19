require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { createClient } = require("@supabase/supabase-js");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { pubClient, subClient, isRedisAvailable } = require("./redis");

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

// Redis adapter for horizontal scaling (with graceful fallback)
if (pubClient && subClient) {
  try {
    io.adapter(createAdapter(pubClient, subClient));
    console.log("✅ Socket.IO: Redis adapter enabled (horizontal scaling active)");
    
    // Monitor Redis connection status
    pubClient.on("ready", () => {
      console.log("✅ Socket.IO: Redis adapter ready");
    });
    
    pubClient.on("error", () => {
      console.warn("⚠️  Socket.IO: Redis connection lost, adapter may not function properly");
    });
  } catch (error) {
    console.warn("⚠️  Socket.IO: Failed to enable Redis adapter, using in-memory adapter:", error.message);
    console.warn("⚠️  Note: Horizontal scaling will not work without Redis");
  }
} else {
  console.warn("⚠️  Socket.IO: Redis clients not initialized, using in-memory adapter");
  console.warn("⚠️  Note: Horizontal scaling will not work without Redis");
}

// Signup
app.post("/signup", async (req, res) => {
  try {
    console.log("Signup request received:", req.body);
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password) {
      console.log("Missing email or password");
      return res.status(400).json({ error: "Email and password required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    console.log("Supabase createUser result:", { data, error });

    if (error) {
      console.error("Signup error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    
    console.log("Signup successful for:", email);
    res.json({ user: data.user, message: "Signup successful" });
  } catch (err) {
    console.error("Unexpected signup error:", err);
    res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});

// Signin
app.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Signin error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    
    res.json({ user: data.user, session: data.session });
  } catch (err) {
    console.error("Unexpected signin error:", err);
    res.status(500).json({ error: "Internal server error. Please try again later." });
  }
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
});

//==============
// TEMPLATE CRUD
//==============
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

app.get("/template", async (req, res) => {
  try {
    console.log("📤 Fetching all templates...");
    const templates = await template.find().populate("createdBy");
    res.status(200).json(templates);
  } catch (err) {
    console.error("❌ Error fetching templates:", err.message);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

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

//==============
// CAMPAIGN CRUD
//==============
const Campaign = require("./models/campaign");

app.post("/campaign", async (req, res) => {
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
});

app.get("/campaign", async (req, res) => {
  try {
    const campaigns = await Campaign.find()
      .populate("template")
      .populate("createdBy")
      .sort({ createdAt: -1 });
    res.status(200).json(campaigns);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

app.get("/campaign/:id", async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate("template")
      .populate("createdBy");
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/campaign/:id", async (req, res) => {
  try {
    const deleted = await Campaign.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Campaign not found" });
    res.json({ message: "Campaign deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//==============
// SOCKET.IO
//==============
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];
    if (!token) return next(new Error("No Token"));

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return next(new Error("Invalid token"));

    socket.user = data.user;
    return next();
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

      await conversation.findByIdAndUpdate(payload.conversationID, {
        lastMessage: payload.body,
        lastActivityAt: new Date(),
      });

      io.to(payload.conversationID).emit("message:new", msg);
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

  socket.on("disconnect", () => {});
});

//==============
// SERVER START
//==============
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
