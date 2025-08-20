import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";   // ✅ import dotenv

dotenv.config();  // ✅ load .env file

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB connection (use env var on Vercel)
const MONGO_URI = 'mongodb+srv://aaun0019:th4jOdEvesaGseUM@cluster0.gqfpkez.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Schema & Model
const ItemSchema = new mongoose.Schema({
  name: String,
  description: String,
}, { timestamps: true });

const Item = mongoose.model("Item", ItemSchema);

// Routes
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

// Export app (Vercel needs this)
export default app;
