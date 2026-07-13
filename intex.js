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
// 2. MONGODB CONNECTION (Optional: Errors won't block the app now)
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, { bufferCommands: false }) // Buffering disable ताकि ऐप न अटके
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
  res.status(200).json({ success: true, message: "RapidCool Backend is running with Google Sheets Sync!" });
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ADMIN_USER = process.env.ADMIN_USERNAME || 'farhan';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'rapidcool2026';

    if (username === ADMIN_USER && password === ADMIN_PASS) {
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

// 📥 NEW BOOKING ROUTE (Submits to Google Sheet & Backup MongoDB)
app.post('/api/bookings', async (req, res) => {
  try {
    const { name, email, phone, service, date, time, address } = req.body;

    // 1. Google Sheet Web App URL par data bhejein (Primary Data Store)
    const sheetUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;
    if (sheetUrl) {
      await axios.post(sheetUrl, { name, email, phone, service, date, time, address }, {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      console.warn("Warning: GOOGLE_SHEET_WEBAPP_URL is not set.");
    }

    // 2. Backup के लिए MongoDB में भी सेव करने का प्रयास करें (अगर कनेक्टेड हो)
    try {
      const newBooking = new Booking({ name, email, phone, service, date, time, address });
      await newBooking.save();
    } catch (dbErr) {
      console.error("MongoDB backup failed, but sheet synced:", dbErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Booking successfully created and synced with Google Sheets!"
    });

  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create booking: " + error.message });
  }
});

// 📤 GET ALL BOOKINGS (Fetches data straight from Google Sheets)
app.get('/api/bookings', async (req, res) => {
  try {
    const sheetUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;
    if (!sheetUrl) {
      return res.status(500).json({ success: false, error: "Google Sheet URL not configured." });
    }

    // Google Apps Script Web App से पूरा डेटा लाएं
    const response = await axios.get(sheetUrl);
    
    res.status(200).json({ 
      success: true, 
      bookings: response.data || [] // Dashboard को डेटा इसी फॉर्मेट में चाहिए
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Sheets fetch error: " + error.message });
  }
});

// 📁 EXPORT BOOKINGS ROUTE (Brings data for export from Google Sheets)
app.get('/api/bookings/export', async (req, res) => {
  try {
    const sheetUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;
    if (!sheetUrl) {
      return res.status(500).json({ success: false, error: "Google Sheet URL not configured." });
    }

    const response = await axios.get(sheetUrl);
    
    res.status(200).json({ 
      success: true, 
      bookings: response.data || [] 
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
