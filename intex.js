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
app.post("/api/bookings", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      service,
      date,
      time,
      address,
      area,
      suburb,
    } = req.body;

    const cleanedPhone = String(phone || "").replace(/\D/g, "");

    if (!name || !service || !address) {
      return res.status(400).json({
        success: false,
        error: "Name, service and address are required.",
      });
    }

    if (!/^\d{10}$/.test(cleanedPhone)) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid 10-digit mobile number.",
      });
    }

    const bookingId = `RC-${Math.floor(
      100000 + Math.random() * 900000
    )}-MUM`;

    const createdAt = new Date();

    const sheetPayload = {
      action: "addBooking",
      id: bookingId,

      date: createdAt.toLocaleDateString("en-IN"),
      time:
        time ||
        createdAt.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),

      customerName: String(name).trim(),
      mobileNumber: cleanedPhone,
      customerEmail: String(email || "").trim(),

      applianceType: service,
      serviceRequired: service,

      area: area || suburb || "N/A",
      address: String(address).trim(),

      preferredDate: date || "N/A",
      status: "New",
    };

    const sheetUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;

    if (!sheetUrl) {
      return res.status(500).json({
        success: false,
        error: "Google Sheet URL is not configured.",
      });
    }

    const sheetResponse = await axios.post(sheetUrl, sheetPayload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!sheetResponse.data?.success) {
      throw new Error(
        sheetResponse.data?.error || "Google Sheets rejected the booking"
      );
    }

    // Optional MongoDB backup
    try {
      const newBooking = new Booking({
        name: sheetPayload.customerName,
        email: sheetPayload.customerEmail,
        phone: sheetPayload.mobileNumber,
        service: sheetPayload.applianceType,
        date: sheetPayload.preferredDate,
        time: sheetPayload.time,
        address: sheetPayload.address,
      });

      await newBooking.save();
    } catch (databaseError) {
      console.error(
        "MongoDB backup failed:",
        databaseError instanceof Error
          ? databaseError.message
          : databaseError
      );
    }

    return res.status(201).json({
      success: true,
      message: "Booking created successfully.",
      bookingId,
      booking: sheetPayload,
    });
  } catch (error) {
    console.error("Booking creation failed:", error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create booking.",
    });
  }
});

// 📤 GET ALL BOOKINGS (Fetches data straight from Google Sheets)
app.get("/api/bookings", async (req, res) => {
  try {
    const sheetUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;

    if (!sheetUrl) {
      return res.status(500).json({
        success: false,
        error: "Google Sheet URL not configured.",
      });
    }

    const response = await axios.get(sheetUrl);

    const rows = Array.isArray(response.data?.data)
      ? response.data.data
      : [];

    const dataRows = rows.filter((row) => {
      if (!Array.isArray(row)) return false;

      const firstCell = String(row[0] || "").trim().toLowerCase();

      return (
        firstCell !== "id" &&
        firstCell !== "booking id" &&
        row.some((cell) => String(cell || "").trim() !== "")
      );
    });

    const bookings = dataRows.map((row) => ({
      id: String(row[0] || ""),
      date: String(row[1] || ""),
      time: String(row[2] || ""),
      customerName: String(row[3] || ""),
      mobileNumber: String(row[4] || "").replace(/^'/, ""),
      customerEmail: String(row[5] || ""),
      applianceType: String(row[6] || ""),
      serviceRequired: String(row[7] || ""),
      area: String(row[8] || ""),
      address: String(row[9] || ""),
      preferredDate: String(row[10] || ""),
      status: String(row[11] || "New"),
      visitingFee: 299,
      express: false,
      warranty: false,
      additionalNotes: "",
    }));

    return res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: `Sheets fetch error: ${error.message}`,
    });
  }
});

// UPDATE BOOKINGS ROUTE (Updates booking status for a given id.)
app.patch('/api/bookings/', async (req, res) => {
  try {
    const {id, status} = req.body

    if (!id || !status) {
      return res.status(400).json({
        success: false,
        error: "Booking ID and status are required.",
      });
    }
    
    const sheetUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;

    if (!sheetUrl) {
      return res.status(500).json({
        success: false,
        error: "Google Sheet URL is not configured.",
      });
    }

    const sheetPayload = {
      action : "updateBooking",
      id,
      status
    }

    const sheetResponse = await axios.post(
      sheetUrl, 
      sheetPayload, 
      {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!sheetResponse.data?.success) {
      throw new Error(
        sheetResponse.data?.error || "Google Sheets rejected update"
      );
    }

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully.",
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, error: `Failed to update booking status. Error: ${error.message }`
    }
    );
  }
}
)

// DELETE BOOKING ROUTE (Delete the booking from Google Sheets)
app.delete('/api/bookings/', async (req, res) => {
  try {
    const {id} = req.body

    if (!id || !status) {
      return res.status(400).json({
        success: false,
        error: "Booking ID is required.",
      });
    }

    const sheetUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;

    if (!sheetUrl) {
      return res.status(500).json({
        success: false,
        error: "Google Sheet URL is not configured.",
      });
    }

    const sheetPayload = {
      action : "deleteBooking",
      id
    }

    const sheetResponse = await axios.post(
      sheetUrl, 
      sheetPayload, 
      {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!sheetResponse.data?.success) {
      throw new Error(
        sheetResponse.data?.error || "Google Sheets rejected delete"
      );
    }

    return res.status(200).json({
      success: true,
      message: "Booking deleted successfully.",
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, error: `Failed to delete booking [id: ${id}]. Error: ${error.message }`
    }
    );
  }
}
)

// 📁 EXPORT BOOKINGS ROUTE (Brings data for export from Google Sheets)
app.get('/api/bookings/export', async (req, res) => {
  try {
    const sheetUrl = process.env.GOOGLE_SHEET_WEBAPP_URL;
    if (!sheetUrl) {
      return res.status(500).json({ success: false, error: "Google Sheet URL not configured." });
    }
    
    const response = await axios.get(sheetUrl);

    const rows = Array.isArray(response.data?.data)
      ? response.data.data
      : [];

    const dataRows = rows.filter((row) => {
      if (!Array.isArray(row)) return false;

      const firstCell = String(row[0] || "").trim().toLowerCase();

      return (
        firstCell !== "id" &&
        firstCell !== "booking id" &&
        row.some((cell) => String(cell || "").trim() !== "")
      );
    });

    const bookings = dataRows.map((row) => ({
      id: String(row[0] || ""),
      date: String(row[1] || ""),
      time: String(row[2] || ""),
      customerName: String(row[3] || ""),
      mobileNumber: String(row[4] || "").replace(/^'/, ""),
      customerEmail: String(row[5] || ""),
      applianceType: String(row[6] || ""),
      serviceRequired: String(row[7] || ""),
      area: String(row[8] || ""),
      address: String(row[9] || ""),
      preferredDate: String(row[10] || ""),
      status: String(row[11] || "New"),
      visitingFee: 299,
      express: false,
      warranty: false,
      additionalNotes: "",
    }));
    
    const headers = Object.keys(bookings[0]).join(',');

    const csv_rows = bookings.map(obj => 
      Object.values(obj).map(val => `"${val}"`).join(',')
    );

    const csvString = [headers, ...csv_rows].join('\n');


    res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head><title>Downloading...</title></head>
    <body>
      <script>
        // Create the CSV file download
        const csvData = \`${csvString}\`;
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'rapidcool_bookings.csv';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        // Instantly close the tab after execution
        setTimeout(() => {
          window.close();
        }, 100);
      </script>
    </body>
    </html>
    `
    );
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
