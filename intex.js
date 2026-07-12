import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios'; 

dotenv.config();

const app = express();

// ==========================================
// 1. CORS CONFIGURATION
// ==========================================
app.use(cors({
  origin: [
    'https://rapidcoolservices.online',
    'http://localhost:3000'
  ], 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));

app.use(express.json());

// ==========================================
// 2. MONGODB CONNECTION
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas.'))
    .catch((err) => console.error('MongoDB connection error:', err));
}

// Booking Schema & Model
const bookingSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  service: String,
  date: String,
  time: String,
  address: String,
  createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

// ==========================================
// 4. ROUTES
// ==========================================

// Health check
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: "RapidCool Backend is running!" });
});

// Admin Login (FIXED for Frontend Compatibility)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ADMIN_USER = process.env.ADMIN_USERNAME || 'farhan';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'rapidcool2026';

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      // FIX: Frontend isi token aur success key ko verify karta hai
      return res.status(200).json({ 
        success: true, 
        token: "rapid_cool_verified_session_token_2026" 
      });
    } else {
      return res.status(401).json({ 
        success: false, 
        error: "Incorrect admin credentials." 
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📥 NEW BOOKING ROUTE (Submits to MongoDB & Web App Script)
app.post('/api/bookings', async (req, res) => {
  try {
    const { name, email, phone, service, date, time, address } = req.body;

    // 1. MongoDB Database me save karein
    const newBooking = new Booking({ name, email, phone, service, date, time, address });
    await newBooking.save();

    // 2. Google Sheet Web App URL par data bhejein
    const sheetUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;
    if (sheetUrl) {
      axios.post(sheetUrl, { name, email, phone, service, date, time, address }, {
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.error("Google Sheet Sync Error:", err.message));
    } else {
      console.warn("Warning: GOOGLE_SHEET_WEBAPP_URL is not set in Render environment variables.");
    }

    res.status(201).json({
      success: true,
      message: "Booking successfully created and synced!",
      booking: newBooking
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📤 GET ALL BOOKINGS (FIXED: Dashboard par data fetch hone lagega)
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    // FIX: Front-end pure logic ke mutabik success: true bhejna mandatory hai
    res.status(200).json({ 
      success: true, 
      bookings: bookings 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📁 EXPORT BOOKINGS ROUTE (Bypass missing route error)
app.get('/api/bookings/export', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.status(200).json({ 
      success: true, 
      bookings: bookings 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// Dynamic Port Binding
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
