// Updated to connect to local DB
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const net = require('net');
require("dotenv").config({ path: path.join(__dirname, '.env') });

const app = express();

// ==================== CONFIGURATION ====================
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mulugetaketemaw2_db_user:pMcLXsSBIUP7PlCT@ac-djrujng.v6u6gau.mongodb.net/gbiDB?retryWrites=true&w=majority";
const DEFAULT_PORT = parseInt(process.env.PORT) || 5001;
const USE_IN_MEMORY_DB = process.env.USE_IN_MEMORY_DB === 'true';

// ==================== IMPROVED CORS CONFIGURATION ====================
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:5173',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
      'http://192.168.137.66:3001'
    ];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log('⚠️ Blocked origin:', origin);
      return callback(null, false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// ==================== DATABASE CONNECTION ====================
const connectDB = async () => {
  console.log("🔌 Connecting to MongoDB Atlas...");
  
  try {
    if (USE_IN_MEMORY_DB) {
      console.log("ℹ️ Offline mode: Using local in-memory database simulation...");
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
      console.log("✅ In-memory MongoDB connected successfully");
      return true;
    }

    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log("✅ MongoDB connected successfully");
    console.log(`📊 Database: ${mongoose.connection.name}`);
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    return true;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    if (err.message.includes('querySrv ETIMEOUT')) {
      console.error("💡 TIP: This is a DNS issue. Try using a standard connection string instead of mongodb+srv://");
    }
    throw err;
  }
};

// ==================== PORT FINDER ====================
const findAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${startPort} is busy, trying ${startPort + 1}...`);
        server.close(() => {
          resolve(findAvailablePort(startPort + 1));
        });
      } else {
        reject(err);
      }
    });
    
    server.once('listening', () => {
      server.close(() => {
        resolve(startPort);
      });
    });
    
    server.listen(startPort);
  });
};

// ==================== SEED DEFAULT USERS ====================
const seedDefaultUsers = async () => {
  try {
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');

    const adminUserData = { name: 'Admin Sebsabi', email: 'mule', password: '1234', role: 'admin', department: 'አስተዳደር' };
    
    // Create admin user if it doesn't exist
    const existingAdmin = await User.findOne({ email: adminUserData.email });
    if (!existingAdmin) {
      const adminUser = new User(adminUserData);
      await adminUser.save();
      console.log(`✅ Seeded admin user: ${adminUserData.email}`);
    }

    console.log("✅ Admin user initialization completed. Executive registration is managed via API.");
  } catch (err) {
    console.error('❌ Error seeding users:', err.message);
  }
};

// ==================== TEST ROUTE - Place this BEFORE other routes ====================
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "API is working!", 
    timestamp: new Date(),
    endpoints: {
      root: "GET /",
      test: "GET /api/test",
      health: "GET /api/health",
      auth: {
        base: "GET /api/auth",
        login: "POST /api/auth/login",
        verify: "GET /api/auth/verify",
        departments: "GET /api/auth/departments"
      }
    }
  });
});

// ==================== HEALTH CHECK ====================
app.get("/api/health", (req, res) => {
  const state = mongoose.connection.readyState;
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  
  res.json({ 
    status: 'OK',
    server: 'running',
    timestamp: new Date().toISOString(),
    mongodb: {
      connected: state === 1,
      state: states[state] || 'unknown',
      database: mongoose.connection.name || 'unknown'
    }
  });
});

// ==================== ROUTES ====================
// Import routes with error handling
console.log("\n📂 Loading routes...");

let authRoutes, memberRoutes, attendanceRoutes, substituteTeacherRoutes, substituteLeaderRoutes, subgroupRoutes, reportRoutes, settingsRoutes, logsRoutes, merjaRoutes, financeRoutes, mezemranRoutes, deaconsRoutes, announcementRoutes, messageRoutes;

try {
  authRoutes = require("./routes/auth");
  console.log("✅ Auth routes loaded");
} catch (err) {
  console.error("❌ Failed to load auth routes:", err.message);
  authRoutes = express.Router();
  authRoutes.get("/", (req, res) => {
    res.json({ message: "Auth routes placeholder - check server console for errors" });
  });
}

try {
  memberRoutes = require("./routes/members");
  console.log("✅ Member routes loaded");
} catch (err) {
  console.error("❌ Failed to load member routes:", err.message);
  memberRoutes = express.Router();
  memberRoutes.get("/", (req, res) => {
    res.json({ message: "Member routes placeholder" });
  });
}

try {
  attendanceRoutes = require("./routes/attendance");
  console.log("✅ Attendance routes loaded");
} catch (err) {
  console.error("❌ Failed to load attendance routes:", err.message);
  attendanceRoutes = express.Router();
}

try {
  substituteTeacherRoutes = require("./routes/substituteTeachers");
  console.log("✅ Substitute Teacher routes loaded");
} catch (err) {
  console.error("❌ Failed to load substitute teacher routes:", err.message);
  substituteTeacherRoutes = express.Router();
}

try {
  substituteLeaderRoutes = require("./routes/substituteLeaders");
  console.log("✅ Substitute Leader routes loaded");
} catch (err) {
  console.error("❌ Failed to load substitute leader routes:", err.message);
  substituteLeaderRoutes = express.Router();
}

try {
  subgroupRoutes = require("./routes/subgroups");
  console.log("✅ Subgroup routes loaded");
} catch (err) {
  console.error("❌ Failed to load subgroup routes:", err.message);
  subgroupRoutes = express.Router();
}

try {
  reportRoutes = require('./routes/reports');
  console.log("✅ Report routes loaded");
} catch (err) {
  console.error("❌ Failed to load report routes:", err.message);
  reportRoutes = express.Router();
}

try {
  settingsRoutes = require('./routes/settings');
  console.log("✅ Settings routes loaded");
} catch (err) {
  console.error("❌ Failed to load settings routes:", err.message);
  settingsRoutes = express.Router();
}

try {
  const logsModule = require('./routes/logs');
  logsRoutes = logsModule.router || logsModule;
  console.log("✅ Logs routes loaded");
} catch (err) {
  console.error("❌ Failed to load logs routes:", err.message);
  logsRoutes = express.Router();
}

try {
  merjaRoutes = require('./routes/merjaReports');
  console.log("✅ Merja routes loaded");
} catch (err) {
  console.error("❌ Failed to load merja reports routes:", err.message);
  merjaRoutes = express.Router();
}

try {
  financeRoutes = require('./routes/finance');
  console.log("✅ Finance routes loaded");
} catch (err) {
  console.error("❌ Failed to load finance routes:", err.message);
  financeRoutes = express.Router();
}

try {
  mezemranRoutes = require('./routes/mezemran');
  console.log("✅ Mezemran routes loaded");
} catch (err) {
  console.error("❌ Failed to load mezemran routes:", err.message);
  mezemranRoutes = express.Router();
}

try {
  deaconsRoutes = require('./routes/deacons');
  console.log("✅ Deacons routes loaded");
} catch (err) {
  console.error("❌ Failed to load deacons routes:", err.message);
  deaconsRoutes = express.Router();
}

try {
  announcementRoutes = require('./routes/announcements');
  console.log("✅ Announcement routes loaded");
} catch (err) {
  console.error("❌ Failed to load announcement routes:", err.message);
  announcementRoutes = express.Router();
}

try {
  messageRoutes = require('./routes/messages');
  console.log("✅ Member Message routes loaded");
} catch (err) {
  console.error("❌ Failed to load message routes:", err.message);
  messageRoutes = express.Router();
}

// Mount routes
console.log("\n📌 Mounting routes...");
app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/substitute-teachers", substituteTeacherRoutes);
app.use("/api/substitute-leaders", substituteLeaderRoutes);
app.use("/api/subgroups", subgroupRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/merja', merjaRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/mezemran', mezemranRoutes);
app.use('/api/deacons', deaconsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/executiveMeetings', require('./routes/executiveMeetings'));
console.log("✅ Routes mounted at /api/*");

// ==================== ROOT ROUTE ====================
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Gubaie University Campus Fellowship Management System",
    version: "1.0.0",
    serverTime: new Date().toISOString(),
    availableEndpoints: {
      root: "GET /",
      test: "GET /api/test",
      health: "GET /api/health",
      auth: {
        list: "GET /api/auth",
        login: "POST /api/auth/login",
        verify: "GET /api/auth/verify",
        departments: "GET /api/auth/departments"
      },
      members: "GET /api/members",
      attendance: "GET /api/attendance",
      subgroups: "GET /api/subgroups",
      reports: "GET /api/reports"
    }
  });
});

// ==================== DEBUG ROUTE - List all registered routes ====================
app.get("/api/routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          const path = handler.route.path;
          const methods = Object.keys(handler.route.methods);
          routes.push({ path: `/api${path}`, methods });
        }
      });
    }
  });
  res.json({ routes });
});

// ==================== ERROR HANDLING ====================
app.use("*", (req, res) => {
  res.status(404).json({
    message: `Route ${req.originalUrl} not found`,
    method: req.method,
    availableEndpoints: [
      "/",
      "/api/test",
      "/api/health",
      "/api/routes",
      "/api/auth",
      "/api/auth/login",
      "/api/auth/verify",
      "/api/auth/departments",
      "/api/members",
      "/api/attendance",
      "/api/subgroups",
      "/api/reports"
    ]
  });
});

app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(500).json({
    message: err.message || "Internal server error"
  });
});

// ==================== SERVER STARTUP ====================
const startServer = async () => {
  try {
    console.log("=".repeat(80));
    console.log("🚀 GUBAIE UNIVERSITY CAMPUS FELLOWSHIP SYSTEM");
    console.log("=".repeat(80));
    
    await connectDB();
    await seedDefaultUsers();

    const availablePort = await findAvailablePort(DEFAULT_PORT);
    
    const server = app.listen(availablePort, '0.0.0.0', () => {
      console.log("=".repeat(80));
      console.log(`✅ SERVER STARTED ON PORT ${availablePort}`);
      if (availablePort !== DEFAULT_PORT) {
        console.log(`⚠️ Port ${DEFAULT_PORT} was busy, using ${availablePort}`);
      }
      console.log("=".repeat(80));
      console.log(`📍 Local: http://localhost:${availablePort}`);
      
      // Get network interfaces
      const { networkInterfaces } = require('os');
      const nets = networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            console.log(`📍 Network: http://${net.address}:${availablePort}`);
          }
        }
      }
      
      console.log("-".repeat(80));
      console.log("📚 AVAILABLE ENDPOINTS:");
      console.log(`   🔧 Test:     http://localhost:${availablePort}/api/test`);
      console.log(`   💓 Health:    http://localhost:${availablePort}/api/health`);
      console.log(`   🗺️  Routes:    http://localhost:${availablePort}/api/routes`);
      console.log(`   🔐 Auth Base: http://localhost:${availablePort}/api/auth`);
      console.log(`   🔐 Login:     http://localhost:${availablePort}/api/auth/login`);
      console.log(`   👥 Members:   http://localhost:${availablePort}/api/members`);
      console.log(`   📊 Attendance: http://localhost:${availablePort}/api/attendance`);
      console.log(`   🔰 Subgroups: http://localhost:${availablePort}/api/subgroups`);
      console.log(`   📈 Reports:   http://localhost:${availablePort}/api/reports`);
      console.log("=".repeat(80));
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${availablePort} is still in use.`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
      }
    });

    process.on('SIGTERM', () => {
      server.close(() => {
        mongoose.connection.close();
        process.exit(0);
      });
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();