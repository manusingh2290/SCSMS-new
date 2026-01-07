const express = require("express");
const cors = require("cors");
const db = require("./db");
const multer = require("multer");
const path = require("path");

const fs = require("fs");

const { Resend } = require("resend");


const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}


const http = require("http"); // Added
const { Server } = require("socket.io"); // Added

const app = express();
const server = http.createServer(app); // Added
const io = new Server(server, {
  cors: { origin: "*" }
})

const { execFile } = require("child_process");


const verifiedEmails = new Set();

require("dotenv").config();

const rateLimit = require("express-rate-limit");

const resend = new Resend(process.env.RESEND_API_KEY);


/* ================= RATE LIMIT HELPERS ================= */

// Standard handler (429)
const rateLimitHandler = (req, res) => {
  res.status(429).json({
    error: "Too many requests",
    message: "Please try again later"
  });
};

// Add standard headers
const standardHeaders = true;
const legacyHeaders = false;

/* ================= IP BASED LIMIT ================= */
const ipLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  max: Number(process.env.RATE_LIMIT_MAX || 100),

  // ✅ FIX FOR IPv6
  keyGenerator: (req) => rateLimit.ipKeyGenerator(req),

  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});



/* ================= AUTH LIMIT (LOGIN / OTP) ================= */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),

  keyGenerator: (req) => rateLimit.ipKeyGenerator(req),

  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});


/* ================= AI LIMIT (EXPENSIVE) ================= */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 20),

  keyGenerator: (req) => rateLimit.ipKeyGenerator(req),

  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});




app.use(cors());
app.use(express.json());


app.use(ipLimiter);



/* ================= FILE UPLOAD ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });
app.use("/uploads", express.static("uploads"));


/* ================= NOTIFICATION HELPER ================= */
function createNotification(role, name, message) {
  db.query(
    "INSERT INTO notifications (user_role, user_name, message) VALUES (?, ?, ?)",
    [role, name, message]
  );
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


/* ================= USER BASED RATE LIMITER ================= */
const userRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.USER_RATE_LIMIT_MAX || 60),

  // ✅ IPV6-SAFE KEY
  keyGenerator: (req) => {
    const ipKey = rateLimit.ipKeyGenerator(req);
    const userId =
      req.body?.citizen_id ||
      req.body?.user_id ||
      req.params?.id ||
      "anonymous";

    return `${ipKey}:${userId}`;
  },

  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});



/* ================= TEST ================= */
app.get("/", (req, res) => res.send("SCSMS Backend Running"));

/* ================= LOGIN ================= */
app.post("/login", authLimiter, (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT id, name, email, role, address FROM users WHERE email=? AND password=?",
    [email, password],
    (err, r) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (r.length === 0)
        return res.status(401).json({ error: "Invalid credentials" });

      res.json({ user: r[0] });
    }
  );
});


/* ================= REGISTER ================= */
app.post("/register-citizen", authLimiter, (req, res) => {
  const { name, email, password } = req.body;

  db.query(
    "SELECT id FROM users WHERE email=?",
    [email],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (rows.length) {
        return res.status(400).json({ error: "User already exists" });
      }

      db.query(
        "INSERT INTO users (name,email,password,role) VALUES (?,?,?,'citizen')",
        [name, email, password],
        (err2) => {
          if (err2) {
            console.error(err2);
            return res.status(500).json({ error: "Registration failed" });
          }

          res.json({ message: "Citizen registered successfully" });
        }
      );
    }
  );
});



app.post("/auth/send-email-otp", authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Save OTP
  db.query(
    "INSERT INTO otp_verifications (email, otp, expires_at) VALUES (?,?,?)",
    [email, otp, expiresAt]
  );

  try {
    await resend.emails.send({
      from: "SCSMS <onboarding@resend.dev>",
      to: email,
      subject: "SCSMS Email Verification OTP",
      html: `
        <h2>SCSMS Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>Valid for 5 minutes</p>
      `
    });

    res.json({ message: "OTP sent to email" });

  } catch (err) {
    console.error("RESEND ERROR:", err);
    res.status(500).json({ error: "OTP send failed" });
  }
});




app.post("/auth/verify-email-otp", authLimiter, (req, res) => {
  const { email, otp } = req.body;

  db.query(
    `
    SELECT otp, expires_at
    FROM otp_verifications
    WHERE email=?
    ORDER BY id DESC
    LIMIT 1
    `,
    [email],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "DB error" });
      }

      if (!rows.length) {
        return res.status(400).json({ error: "OTP not found" });
      }

      const record = rows[0];

      if (new Date(record.expires_at) < new Date()) {
        return res.status(400).json({ error: "OTP expired" });
      }

      if (record.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      // ✅ OTP VERIFIED → DELETE OTP
      db.query("DELETE FROM otp_verifications WHERE email=?", [email]);

      res.json({ message: "Email verified successfully" });
    }
  );
});





/* ================= UPDATED AI ROUTE ================= */
app.post("/ai/suggest-title", aiLimiter, upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  // 1. Get the absolute path of the uploaded image
  const imagePath = path.join(__dirname, "uploads", req.file.filename);

  // 2. Get the absolute path of the python script
  // __dirname is '.../SCSMS/backend'
  // We go UP one level (..), then into 'civic-ai'
  const scriptPath = path.join(__dirname, "..", "civic-ai", "predict.py");

  console.log("📸 Analyzing Image:", imagePath);
  console.log("🤖 Running Script:", scriptPath);

  execFile(
    "python", // Or "python3" depending on your system
    [scriptPath, imagePath],
    (err, stdout, stderr) => {
      if (err) {
        console.error("❌ Python Error:", err);
        console.error("❌ Python Stderr:", stderr); // Log detailed python errors
        return res.status(500).json({ error: "AI prediction failed" });
      }

      try {
        const clean = stdout.toString().trim();
        const result = JSON.parse(clean);

        const titleMap = {
          pothole: "Pothole on road",
          garbage: "Garbage not collected",
          street_light: "Street light not working",
          drainage: "Drainage overflow issue",
          water_leak: "Water leakage issue",
          fallen_tree: "Fallen tree blocking road",
          illegal_dumping: "Illegal garbage dumping",
          road_damage: "Road damage issue"
        };

        res.json({
          label: result.label,
          confidence: result.confidence,
          suggestedTitle: titleMap[result.label] || "General civic issue"
        });
      } catch (parseError) {
        console.error("❌ JSON Parse Error:", parseError, "Output was:", stdout);
        res.status(500).json({ error: "Invalid response from AI" });
      }
    }
  );
});



/* ================= CITIZEN SUBMIT COMPLAINT ================= */
app.post("/complaint", userRateLimiter, upload.single("photo"), async (req, res) => {
  const {
    citizen_id,
    citizen_name,
    title,
    description,
    location,
    latitude,
    longitude
  } = req.body;

  const photo = req.file?.filename || null;

  if (!citizen_id || !citizen_name || !title) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // ✅ ONLY IF AI PASSES, WE INSERT INTO DB
  const sql = `
    INSERT INTO complaints
    (citizen_id, citizen_name, title, description, location, latitude, longitude, photo, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Submitted')
  `;

  db.query(
    sql,
    [
      citizen_id,
      citizen_name,
      title,
      description,
      location,
      latitude || null,
      longitude || null,
      photo
    ],
    err => {
      if (err) {
        console.error("Complaint insert error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      createNotification(
        "admin",
        "Admin",
        `New complaint from ${citizen_name}: ${title}`
      );

      res.json({ message: "Complaint submitted successfully" });
    }
  );
});




/* ================= ADMIN VIEW ================= */
app.get("/complaints", (req, res) => {
  db.query("SELECT * FROM complaints", (err, r) => res.json(r));
});

/* ================= CITIZEN VIEW ================= */
app.get("/complaints-by-user/:id", (req, res) => {
  const citizenId = req.params.id;

  db.query(
    "SELECT * FROM complaints WHERE citizen_id=? ORDER BY created_at DESC",
    [citizenId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});


/* ================= GET WORKERS ================= */
app.get("/workers", (req, res) => {
  db.query(
    "SELECT id,name FROM users WHERE role='worker' AND is_active=1",
    (err, r) => res.json(r)
  );
});


/* ================== ADMIN ASSIGN WORKER ================== */
app.post("/assign", userRateLimiter, (req, res) => {
  const { complaint_id, worker_name } = req.body;

  if (!complaint_id || !worker_name) {
    return res.status(400).json({ error: "Complaint ID and worker required" });
  }

  // 1️⃣ Get complaint & citizen
  db.query(
    "SELECT status, citizen_name FROM complaints WHERE id=?",
    [complaint_id],
    (err, c) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (c.length === 0)
        return res.status(404).json({ error: "Complaint not found" });

      if (c[0].status !== "Submitted") {
        return res
          .status(400)
          .json({ error: "Only Submitted complaints can be assigned" });
      }

      // 2️⃣ Get worker ID
      db.query(
        "SELECT id FROM users WHERE name=? AND role='worker'",
        [worker_name.trim()],
        (err2, w) => {
          if (err2) return res.status(500).json({ error: "Database error" });
          if (w.length === 0)
            return res.status(400).json({ error: "Invalid worker" });

          const worker_id = w[0].id;

          // 3️⃣ INSERT INTO assignments (CORRECT)
          const assignSql = `
            INSERT INTO assignments (complaint_id, worker_name, worker_id)
            VALUES (?, ?, ?)
          `;

          db.query(
            assignSql,
            [complaint_id, worker_name.trim(), worker_id],
            (err3) => {
              if (err3) {
                console.error("Assignment Insert Error:", err3);
                return res
                  .status(500)
                  .json({ error: "Assignment failed" });
              }

              // 4️⃣ Update complaint status
              db.query(
                "UPDATE complaints SET status='Assigned' WHERE id=?",
                [complaint_id]
              );

              // 5️⃣ Notifications (CORRECT USERS)
              createNotification(
                "worker",
                worker_name.trim(),
                `New task assigned (Complaint ID: ${complaint_id})`
              );

              createNotification(
                "citizen",
                c[0].citizen_name,
                `Worker ${worker_name} has been assigned to your complaint`
              );

              res.json({ message: "Worker assigned successfully" });
            }
          );
        }
      );
    }
  );
});


/* ================= WORKER VIEW ================= */
app.get("/worker/:name", (req, res) => {
  const workerName = req.params.name.trim();

  db.query(
    "SELECT id FROM users WHERE name=? AND role='worker'",
    [workerName],
    (err, w) => {
      if (err || w.length === 0) {
        return res.json([]);
      }

      const worker_id = w[0].id;

      const sql = `
        SELECT c.*
        FROM complaints c
        JOIN assignments a ON c.id = a.complaint_id
        WHERE a.worker_id = ?
      `;

      db.query(sql, [worker_id], (err2, results) => {
        if (err2) {
          console.error(err2);
          return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
      });
    }
  );
});


/* ================= WORKER UPDATE STATUS ================= */
app.put(
  "/complaint/:id", userRateLimiter,
  upload.single("completion_photo"),
  (req, res) => {
    const { status, worker_name } = req.body;
    const photo = req.file?.filename || null;
    const id = req.params.id;

    if (status === "Resolved" && !photo)
      return res
        .status(400)
        .json({ error: "Completion photo required" });

    db.query(
      `
      UPDATE complaints c
      JOIN assignments a ON c.id=a.complaint_id
      SET c.status=?, c.completion_photo=IFNULL(?,c.completion_photo)
      WHERE c.id=? AND a.worker_name=?
      AND (
        (c.status='Assigned' AND ?='In Progress')
        OR
        (c.status='In Progress' AND ?='Resolved')
      )
      `,
      [status, photo, id, worker_name, status, status],
      (err, r) => {
        if (!r) {
  return res.status(500).json({ error: "Database operation failed" });
}

if (r.affectedRows === 0) {
  return res.status(403).json({ error: "Invalid transition" });
}


        // 🔔 Only when RESOLVED
        if (status === "Resolved") {
          db.query(
            "SELECT citizen_name FROM complaints WHERE id=?",
            [id],
            (err2, c) => {
              createNotification(
                "citizen",
                c[0].citizen_name,
                `Your complaint (ID ${id}) has been resolved`
              );
              createNotification(
                "admin",
                "Admin",
                `Complaint ${id} resolved by ${worker_name}`
              );
            }
          );
        }

        res.json({ message: "Status updated" });
      }
    );
  }
);

/* ================= NOTIFICATIONS ================= */
app.get("/notifications/:role/:name", (req, res) => {
  db.query(
    `
    SELECT * FROM notifications
    WHERE user_role=? AND user_name=?
    ORDER BY created_at DESC
    `,
    [req.params.role, req.params.name],
    (err, r) => res.json(r)
  );
});


/* ================== ADMIN VIEW SINGLE WORKER ACTIVITY ================== */
app.get("/admin/worker-activity/:workerName", (req, res) => {
  const workerName = req.params.workerName.trim();

  const sql = `
    SELECT 
      c.id,
      c.title,
      c.status,
      c.location,
      c.latitude,
      c.longitude,
      c.completion_photo
    FROM complaints c
    JOIN assignments a ON c.id = a.complaint_id
    WHERE a.worker_name = ?
    ORDER BY c.status
  `;

  db.query(sql, [workerName], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});


/* ================== ADMIN ADD WORKER ================== */
app.post("/admin/add-worker", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Check email uniqueness
  db.query(
    "SELECT id FROM users WHERE email=?",
    [email],
    (err, r) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (r.length > 0) {
        return res.status(400).json({ error: "Email already exists" });
      }

      // Insert worker
      db.query(
        "INSERT INTO users (name,email,password,role) VALUES (?,?,?,'worker')",
        [name, email, password],
        err2 => {
          if (err2) return res.status(500).json({ error: "Database error" });

          res.json({ message: "Worker added successfully" });
        }
      );
    }
  );
});


/* ================== ADMIN REMOVE WORKER ================== */
app.put("/admin/remove-worker/:id", (req, res) => {
  const workerId = req.params.id;

  db.query(
    "UPDATE users SET is_active=0 WHERE id=? AND role='worker'",
    [workerId],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Worker not found" });
      }

      res.json({ message: "Worker removed successfully" });
    }
  );
});


/* ================= PROFILE ================= */
app.put("/profile/update", (req, res) => {
  const { user_id, address } = req.body;

  db.query(
    "UPDATE users SET address=? WHERE id=?",
    [address, user_id],
    err => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Profile updated" });
    }
  );
});


/* ================= LIVE CHAT ================= */

// Chat history per citizen
app.get("/chat-history/:room", (req, res) => {
  db.query(
    "SELECT * FROM support_chats WHERE room_name=? ORDER BY created_at ASC",
    [req.params.room],
    (err, r) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(r);
    }
  );
});

const chatRateMap = new Map();

io.on("connection", socket => {
  console.log("🟢 Chat connected");

  socket.on("join_chat", room => {
    socket.join(room);
  });

  socket.on("send_message", data => {
    const room = data.room;

    if (!room || !room.startsWith("citizen_")) {
      console.error("❌ Invalid room:", room);
      return;
    }

    /* ===== CHAT RATE LIMIT (PER USER + ROOM) ===== */
    const key = `${data.sender}_${room}`;
    const now = Date.now();
    const WINDOW_MS = 60 * 1000;
    const MAX_MSG =
      Number(process.env.CHAT_RATE_LIMIT_MAX) || 60;

    if (!chatRateMap.has(key)) chatRateMap.set(key, []);

    const timestamps = chatRateMap
      .get(key)
      .filter(t => now - t < WINDOW_MS);

    if (timestamps.length >= MAX_MSG) {
      return; // 🚫 silently drop spam
    }

    timestamps.push(now);
    chatRateMap.set(key, timestamps);

    /* ===== SAVE + EMIT ===== */
    db.query(
      "INSERT INTO support_chats (room_name, sender_name, sender_role, message) VALUES (?,?,?,?)",
      [room, data.sender, data.role, data.message],
      err => {
        if (err) {
          console.error("Chat save error:", err);
          return;
        }

        io.to(room).emit("receive_message", data);
      }
    );
  });



  socket.on("disconnect", () => {
    console.log("🔴 Chat disconnected");
  });
});


/* ================= ADMIN GET ACTIVE CHAT ROOMS ================= */
app.get("/admin/active-chats", (req, res) => {
  const sql = `
    SELECT room_name
    FROM support_chats
    GROUP BY room_name
    ORDER BY MAX(created_at) DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Active chats error:", err);
      return res.status(500).json({ error: "DB error" });
    }

    res.json(rows.map(r => r.room_name));
  });
});


/* ================= CITIZEN STATS ================= */
app.get("/citizen/stats/:citizenId", (req, res) => {
  const citizenId = req.params.citizenId;

  const sql = `
    SELECT
      COUNT(*) AS total,
      SUM(status = 'Resolved') AS resolved,
      SUM(status != 'Resolved') AS pending
    FROM complaints
    WHERE citizen_id = ?
  `;

  db.query(sql, [citizenId], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });

    const total = rows[0].total || 0;
    const resolved = rows[0].resolved || 0;
    const pending = rows[0].pending || 0;

    const impactPoints = resolved * 50;

    let badge = "Observer";
    if (resolved >= 5) badge = "Guardian";
    if (resolved >= 10) badge = "Community Hero";

    res.json({
      total,
      resolved,
      pending,
      impactPoints,
      badge
    });
  });
});



/* ================= ADMIN POST ANNOUNCEMENT ================= */
app.post("/admin/announcement", (req, res) => {
  const { title, message, type } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: "Title and message required" });
  }

  db.query(
    "INSERT INTO announcements (title, message, type) VALUES (?,?,?)",
    [title, message, type || "General"],
    err => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ message: "Announcement posted" });
    }
  );
});



/* ================= GET ANNOUNCEMENTS ================= */
app.get("/announcements", (req, res) => {
  db.query(
    "SELECT * FROM announcements ORDER BY created_at DESC",
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});



/* ================= GET COMPLAINTS WITH LOCATION ================= */
app.get("/complaints-map", (req, res) => {
  const sql = `
    SELECT id, status, latitude, longitude
    FROM complaints
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
  `;

  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(rows);
  });
});


/* ================= CITIZEN ACTIVITY TIMELINE ================= */
app.get("/citizen/activity/:id", (req, res) => {
  const citizenId = req.params.id;

  const sql = `
    SELECT 
      title,
      status,
      created_at,
      updated_at
    FROM complaints
    WHERE citizen_id = ?
    ORDER BY updated_at DESC
    LIMIT 10
  `;

  db.query(sql, [citizenId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows);
  });
});






/* ================= SERVER ================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO running on port ${PORT}`);
});