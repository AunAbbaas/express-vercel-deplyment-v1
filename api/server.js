import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";   // ✅ for password hashing
import jwt from "jsonwebtoken";  // ✅ for JWT

dotenv.config(); // load .env file

const app = express();

app.use(cors());
app.use(express.json());

// ---------------------- MongoDB connection ----------------------
const MONGO_URI = "mongodb+srv://aaun0019:th4jOdEvesaGseUM@cluster0.gqfpkez.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const JWT_SECRET = "mySecretKey"; // put in .env in production

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ---------------------- Schemas & Models ----------------------

// Items
const ItemSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
  },
  { timestamps: true }
);
const Item = mongoose.model("Item", ItemSchema);

// Users
const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

// hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const User = mongoose.model("User", UserSchema);

// ---------------------- Middleware ----------------------
const authMiddleware = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]; // Bearer <token>
  if (!token) return res.status(401).json({ error: "Access denied, token missing" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // attach user data
    next();
  } catch (err) {
    return res.status(400).json({ error: "Invalid token" });
  }
};

// ---------------------- Routes ----------------------

// Test route
app.get("/", (req, res) => {
  res.send("Welcome To My Backend World!");
});

// Public APIs
app.get("/api", async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch {
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

app.post("/api", async (req, res) => {
  try {
    const { name, description } = req.body;
    const newItem = new Item({ name, description });
    await newItem.save();
    res.json(newItem);
  } catch {
    res.status(500).json({ error: "Failed to create item" });
  }
});

// ---------------------- Auth APIs ----------------------

// Signup
app.post("/auth/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // check if user already exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "User already exists" });

    const user = new User({ username, email, password });
    await user.save();

    res.json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Signup failed" });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    // create token
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});


// ---------------------- User APIs ----------------------

// Get all users (⚠️ normally you'd restrict this to admin only)
app.get("/users", authMiddleware, async (req, res) => {
  try {
    const users = await User.find().select("-password"); // hide password
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get single user by ID
app.get("/users/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});


// Protected route example
app.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password"); // exclude password
    res.json(user);
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ---------------------- Export app ----------------------
export default app;
