import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios'; // <-- Google Sheet Web App hit karne ke liye axios add kiya

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

// Booking Schema & Model (Database me save karne ke liye)
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
  res.status(200).json({ status: "success", message: "RapidCool Backend is running!" });
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ADMIN_USER = process.env.ADMIN_USERNAME || 'farhan';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'rapidcool2026';

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      return res.status(200).json({ status: "success", token: "dummy-admin-token-rapidcool" });
    } else {
      return res.status(401).json({ status: "error", message: "Invalid username or password" });
    }
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// 📥 NEW BOOKING ROUTE: Jo Data MongoDB aur Google Sheet dono me bhejega
app.post('/api/bookings', async (req, res) => {
  try {
    const { name, email, phone, service, date, time, address } = req.body;

    // 1. MongoDB Database me save karein
    const newBooking = new Booking({ name, email, phone, service, date, time, address });
    await newBooking.save();

    // 2. Google Sheet Web App URL par data bhejein
    const sheetUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;
    if (sheetUrl) {
      // Background me sheet par data send karein bina response ko delay kiye
      axios.post(sheetUrl, { name, email, phone, service, date, time, address }, {
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.error("Google Sheet Sync Error:", err.message));
    } else {
      console.warn("Warning: GOOGLE_SHEET_WEBAPP_URL is not set in Render environment variables.");
    }

    res.status(201).json({
      status: "success",
      message: "Booking successfully created and synced to Google Sheet!",
      booking: newBooking
    });

  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Get All Bookings (Admin Panel ke liye)
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.status(200).json({ status: "success", bookings });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
