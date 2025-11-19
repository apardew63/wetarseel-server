const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const authenticateSocket = async (socket, next) => {
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
};

const authenticateRequest = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error) return res.status(403).json({ error: error.message });

    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: "Authentication error" });
  }
};

module.exports = { authenticateSocket, authenticateRequest };