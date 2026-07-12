import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { google } from 'googleapis';

// Environment variables load karne ke liye
dotenv.config();

const app = express();

// ==========================================
// 1. CORS CONFIGURATION (Fixed URL)
// ==========================================
app.use(cors({
  origin: [
    'https://rapidcoolservices.online',                // <-- Aapka asli live frontend URL (Fix)
    'http://localhost:3000'                             // Local testing ke liye
  ], 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
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

let sheets;
if (process.env.GOOGLE_CLIENT_EMAIL && privateKey) {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  sheets = google.sheets({ version: 'v4', auth });
  console.log("Google Sheets Auth initialized successfully.");
} else {
  console.warn("WARNING: Google Credentials missing in environment variables.");
}

// ==========================================
// 4. ACTUAL ROUTES
// ==========================================

// Health check / Root Route
app.get('/', (req, res) => {
  res.status(200).json({
    status: "success",
    message: "RapidCool Services Backend is live and running on Render!"
  });
});

// Admin Login Route (Frontend isi ko hit karta hai)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Environment variables se credentials fetch karna aur default backup values rakhna
    const ADMIN_USER = process.env.ADMIN_USERNAME || 'farhan';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'rapidcool2026';

    // FIX: Yahan ab dynamic variables sahi tarike se match ho rahe hain
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      
      // FIX: Frontend dashboard ke pure logic ke mutabik correct token aur success key return karna
      return res.status(200).json({
        success: true, 
        message: "Authentication successful",
        token: "rapid_cool_verified_session_token_2026" 
      });
    } else {
      // FIX: Frontend validation error handler ke liye clear custom response message
      return res.status(401).json({
        success: false,
        error: "Incorrect admin credentials."
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bookings Route (Sample handle)
app.get('/api/bookings', async (req, res) => {
  try {
    // Agar aapke paas Booking model hai toh: const bookings = await Booking.find();
    res.status(200).json({ success: true, bookings: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unhandled Route Handler (Agar koi galat URL hit kare)
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// ==========================================
// 5. DYNAMIC PORT
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is successfully running on port ${PORT}`);
});
