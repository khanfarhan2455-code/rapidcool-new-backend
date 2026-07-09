import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { google } from 'googleapis';

// Environment variables load karne ke liye
dotenv.config();

const app = express();

// ==========================================
// 1. CORS CONFIGURATION (Vercel Frontend ke liye)
// ==========================================
app.use(cors({
  // Apne asli Vercel URL se isko replace karein, ya '*' lagayein agar sab allow karna hai
  origin: ['https://your-frontend-vercel-url.vercel.app', 'http://localhost:3000'], 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Body Parser Middleware
app.use(express.json());

// ==========================================
// 2. MONGODB CONNECTION
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("CRITICAL ERROR: MONGODB_URI is not defined in env variables!");
} else {
  // Mongoose v6+ me ab useNewUrlParser aur useUnifiedTopology ki zaroorat nahi hoti
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas.'))
    .catch((err) => console.error('MongoDB connection error:', err));
}

// ==========================================
// 3. GOOGLE SHEETS API SETUP
// ==========================================
const privateKey = process.env.GOOGLE_PRIVATE_KEY 
  ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : null;

if (process.env.GOOGLE_CLIENT_EMAIL && privateKey) {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  console.log("Google Sheets Auth initialized successfully.");
} else {
  console.warn("WARNING: Google Credentials missing in environment variables.");
}

// ==========================================
// 4. ROUTES
// ==========================================

// Health check / Root Route
app.get('/', (req, res) => {
  res.status(200).json({
    status: "success",
    message: "RapidCool Services Backend is live and running on Render!"
  });
});

// Unhandled Route Handler (Agar koi galat URL hit kare)
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

// ==========================================
// 5. DYNAMIC PORT
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is successfully running on port ${PORT}`);
});
