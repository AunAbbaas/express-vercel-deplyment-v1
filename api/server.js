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
app.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password"); // hide password
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Get single user by ID
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});



// ---------------------- Blog Schema ----------------------
const BlogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    tags: [{ type: String }],
    description: { type: String, required: true }, // CKEditor content (HTML)
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional if you want to link with logged in user
  },
  { timestamps: true }
);

const Blog = mongoose.model("Blog", BlogSchema);

// ---------------------- Blog Routes ----------------------

// Create a blog (protected route → only logged in users can post)
app.post("/blogs", authMiddleware, async (req, res) => {
  try {
    const { title, tags, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required" });
    }

    const newBlog = new Blog({
      title,
      tags,
      description,
      author: req.user.id, // take logged in user ID from JWT
    });

    await newBlog.save();
    res.status(201).json(newBlog);
  } catch (err) {
    res.status(500).json({ error: "Failed to create blog" });
  }
});

// Get all blogs (public)
app.get("/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find()
      .populate("author", "username email -_id") // optional: show author details
      .sort({ createdAt: -1 }); // latest first

    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
});

// Get single blog by ID
app.get("/blogs/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate("author", "username email -_id");
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    res.json(blog);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blog" });
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
