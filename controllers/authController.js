const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const signup = async (req, res) => {
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
};

const signin = async (req, res) => {
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
};

const getProfile = async (req, res) => {
  res.json({ message: "Protected route", user: req.user });
};

module.exports = { signup, signin, getProfile };