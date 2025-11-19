require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { pubClient, subClient, isRedisAvailable } = require("./redis");
const connectDB = require("./config/database");
const errorHandler = require("./utils/errorHandler");
const { authenticateSocket } = require("./middlewares/auth");
const { handleSocketConnection } = require("./services/socketService");

// Import routes
const authRoutes = require("./routes/authRoutes");
const contactRoutes = require("./routes/contactRoutes");
const templateRoutes = require("./routes/templateRoutes");
const campaignRoutes = require("./routes/campaignRoutes");

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Supabase client with service_role key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("server is running");
});

app.use("/auth", authRoutes);
app.use("/contact", contactRoutes);
app.use("/template", templateRoutes);
app.use("/campaign", campaignRoutes);

// Socket.IO authentication
io.use(authenticateSocket);

// Handle socket connections
handleSocketConnection(io);

// Error handling middleware
app.use(errorHandler);

module.exports = { app, server };