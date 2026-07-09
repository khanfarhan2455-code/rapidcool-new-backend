import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { google } from 'googleapis';
// Note: Agar aapke paas routes ya controllers ki alag files hain, 
// toh unhe aap yahan import kar sakte hain, jaise:
// import authRoutes from './routes/auth.js';

// Environment variables load karne ke liye
dotenv.config();

const app = express();

// ==========================================
// 1. CORS CONFIGURATION (Vercel Frontend ke liye)
// ==========================================
app.use(cors({
  // Apne asli Vercel URL ko yahan daalein (localhost testing ke liye bhi option rakha hai)
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
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas.'))
    .catch((err) => console.error('MongoDB connection error:', err));
}

// ==========================================
// 3. GOOGLE SHEETS API SETUP (Optional Validation)
// ==========================================
// Render par private key newlines (\n) sahi se handle karne ke liye replace lagaya hai
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
  // Is 'auth' object ko aap apne sheets controller mein use kar sakte hain
}

// ==========================================
// 4. ROUTES
// ==========================================

// Health check / Root Route (Render ko batane ke liye ki server chal raha hai)
app.get('/', (req, res) => {
  res.status(200).json({
    status: "success",
    message: "RapidCool Services Backend is live and running on Render!"
  });
});

// Agar aapke paas dusre routes hain toh unhe yahan connect karein:
// app.use('/api/auth', authRoutes);

// ==========================================
// 5. DYNAMIC PORT (Render Deployment ke liye sabse zaroori)
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is successfully running on port ${PORT}`);
});
