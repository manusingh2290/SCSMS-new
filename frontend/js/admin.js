/* ================= AUTH CHECK ================= */
const userStr = localStorage.getItem("user");
if (!userStr) window.location.href = "login.html";

const user = JSON.parse(userStr);
if (user.role !== "admin") window.location.href = "login.html";

/* ================= NOTIFICATIONS ================= */
async function loadNotifications() {
  const res = await fetch(
    `http://localhost:3000/notifications/${user.role}/${user.name}`
  );
  const data = await res.json();

  const notify = document.getElementById("notify");
  notify.innerHTML = "";

  if (!data || data.length === 0) {
    notify.innerHTML = "<li>No notifications</li>";
    return;
  }

  data.forEach(n => {
    notify.innerHTML += `<li>${n.message}</li>`;
  });
}

/* ================= OPEN / CLOSE NOTIFICATION PANEL ================= */
function openNotifications() {
  const panel = document.getElementById("notificationPanel");
  const bell = document.getElementById("bell");
  const profile = document.getElementById("profileIcon"); // ✅ FIX

  panel.style.right = "0px";        // Slide in
  bell.style.display = "none";      // Hide bell
  profile.style.display = "none";   // Hide profile icon

  document.body.style.overflow = "hidden"; // 🔥 ADD THIS
}

function closeNotifications() {
  const panel = document.getElementById("notificationPanel");
  const bell = document.getElementById("bell");
  const profile = document.getElementById("profileIcon"); // ✅ FIX

  panel.style.right = "-350px";     // Slide out
  bell.style.display = "block";     // Show bell
  profile.style.display = "block";  // Show profile icon


}


/* ================= LOAD COMPLAINTS ================= */
async function loadComplaints() {
  const res = await fetch("http://localhost:3000/complaints");
  const data = await res.json();

  const active = document.getElementById("active");
  const history = document.getElementById("history");

  active.innerHTML = "";
  history.innerHTML = "";

  if (!data || data.length === 0) {
    active.innerHTML = "<li>No complaints found</li>";
    return;
  }

  data.forEach(c => {
    if (c.status !== "Resolved") {
      active.innerHTML += `
        <li>
          <b>ID:</b> ${c.id}<br>
          <b>Issue:</b> ${c.title}<br>
          <b>Status:</b> ${c.status}<br>
          <b>Location:</b> ${c.location || "N/A"}<br>

          ${c.latitude && c.longitude ? `
            <a href="https://www.google.com/maps?q=${c.latitude},${c.longitude}" target="_blank">
              📍 View on Map
            </a><br>
          ` : ""}

          ${c.photo ? `
            <img src="http://localhost:3000/uploads/${c.photo}" width="120"><br>
          ` : ""}
        </li>
        <hr>
      `;
    } else {
      history.innerHTML += `
  <li>
    <b>ID:</b> ${c.id}<br>
    <b>Issue:</b> ${c.title}<br>
    <b>description:</b> ${c.description}<br>
    <b>assigned Worker:</b> ${c.assigned_worker || "N/A"}<br>
    <b>location:</b> ${c.latitude && c.longitude ? `
            <a href="https://www.google.com/maps?q=${c.latitude},${c.longitude}" target="_blank">
              📍 View on Map
            </a><br>
          ` : ""}<br><br>
    <b>Completion Details:</b><br>

    <div style="
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      align-items:flex-start;
    ">
      ${c.photo ? `
        <div>
          <small><b>Complaint Image</b></small><br>
          <img src="http://localhost:3000/uploads/${c.photo}" width="140">
        </div>
      ` : ""}

      ${c.completion_photo ? `
        <div>
          <small><b>Resolved Image</b></small><br>
          <img src="http://localhost:3000/uploads/${c.completion_photo}" width="140">
        </div>
      ` : ""}
    </div>
  </li>
  <hr>
`;

    }
  });

  if (active.innerHTML === "") active.innerHTML = "<li>No active complaints</li>";
  if (history.innerHTML === "") history.innerHTML = "<li>No resolved complaints</li>";
}

/* ================= TOGGLE COMPLAINT HISTORY ================= */
function toggleHistory() {
  const history = document.getElementById("history");
  const arrow = document.getElementById("arrow");

  if (history.style.display === "none") {
    history.style.display = "block";
    arrow.innerText = "▲";
  } else {
    history.style.display = "none";
    arrow.innerText = "▼";
  }
}

/* ================= LOAD WORKERS (ACTIVE ONLY) ================= */
async function loadWorkers() {
  const res = await fetch("http://localhost:3000/workers");
  const workers = await res.json();

  const select = document.getElementById("workerSelect");
  select.innerHTML = '<option value="">Select Worker</option>';

  workers.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.name;
    opt.textContent = w.name;
    select.appendChild(opt);
  });

  loadWorkerList(workers);
}

/* ================= ASSIGN WORKER ================= */
async function assign() {
  const cid = document.getElementById("cid").value.trim();
  const worker = document.getElementById("workerSelect").value;

  if (!cid || !worker) {
    alert("Complaint ID and Worker required");
    return;
  }

  const res = await fetch("http://localhost:3000/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ complaint_id: cid, worker_name: worker })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error);

  alert("Worker Assigned");
  loadComplaints();
}

/* ================= ADD WORKER ================= */
async function addWorker() {
  const name = wname.value.trim();
  const email = wemail.value.trim();
  const password = wpass.value.trim();

  if (!name || !email || !password) {
    alert("All fields required");
    return;
  }

  const res = await fetch("http://localhost:3000/admin/add-worker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error);

  alert("Worker Added");
  wname.value = wemail.value = wpass.value = "";
  loadWorkers();
}

/* ================= REMOVE WORKER (DEACTIVATE) ================= */
function loadWorkerList(workers) {
  const list = document.getElementById("workerList");
  list.innerHTML = "";

  if (!workers || workers.length === 0) {
    list.innerHTML = "<li>No active workers</li>";
    return;
  }

  workers.forEach(w => {
    list.innerHTML += `
      <li>
        ${w.name}
        <button onclick="removeWorker(${w.id})">❌ Remove</button>
      </li>
    `;
  });
}

async function removeWorker(id) {
  if (!confirm("Remove this worker?")) return;

  const res = await fetch(
    `http://localhost:3000/admin/remove-worker/${id}`,
    { method: "PUT" }
  );

  const data = await res.json();
  if (!res.ok) return alert(data.error);

  alert("Worker Removed");
  loadWorkers();
}

/* ================= LOGOUT ================= */
function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

/* ================= INIT ================= */
loadNotifications();
loadWorkers();
loadComplaints();


function goToWorkerActivity() {
  window.location.href = "worker-activity.html";
}

function openProfile() {
  window.location.href = "profile.html";
}

function toggleProfileMenu() {
  const menu = document.getElementById("profileMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}



/* ================= ADMIN LIVE CHAT ================= */

const socket = io("http://localhost:3000");
let activeRoom = "";

/* ===== LOAD EXISTING ACTIVE CHATS ON PAGE LOAD ===== */
async function loadActiveChats() {
  try {
    const res = await fetch("http://localhost:3000/admin/active-chats");
    const rooms = await res.json();

    const list = document.getElementById("active-chats");
    list.innerHTML = "";

    if (!rooms || rooms.length === 0) {
      list.innerHTML = "<li style='color:#999'>No active chats</li>";
      return;
    }

    rooms.forEach(name => updateCitizenList(name));
  } catch (err) {
    console.error("Failed to load active chats", err);
  }
}

/* ===== REAL-TIME MESSAGE LISTENER ===== */
socket.on("receive_message", (data) => {
  updateCitizenList(data.room);

  if (activeRoom === data.room) {
    loadAdminHistory(data.room);
  }
});

/* ===== UPDATE LEFT SIDEBAR (ACTIVE CITIZENS) ===== */
function updateCitizenList(room) {
  const list = document.getElementById("active-chats");

  if (!document.getElementById(`chat-item-${room}`)) {
    const li = document.createElement("li");
    li.id = `chat-item-${room}`;

    li.innerHTML = `👤 Citizen #${room.replace("citizen_", "")}`;

    li.style = `
      padding:10px;
      cursor:pointer;
      border-bottom:1px solid #ddd;
      font-size:14px;
    `;

    li.onclick = () => selectCitizen(room);
    list.appendChild(li);
  }
}


/* ===== SELECT A CITIZEN CHAT ===== */
async function selectCitizen(room) {
  activeRoom = room;
  socket.emit("join_chat", room);

  document.getElementById("admin-input-area").style.display = "block";

  // 🔥 REMOVE PLACEHOLDER TEXT
  const placeholder = document.getElementById("chat-placeholder");
  if (placeholder) placeholder.remove();

  loadAdminHistory(room);
}

/* ===== LOAD CHAT HISTORY FROM DB ===== */
async function loadAdminHistory(room) {
  const res = await fetch(`http://localhost:3000/chat-history/${room}`);
  const history = await res.json();

  const box = document.getElementById("admin-chat-messages");
  box.innerHTML = "";

  let lastDate = "";

  history.forEach(m => {
    const isAdmin = m.sender_role === "admin";

    const msgDate = new Date(m.created_at);
    const dateLabel = getDateLabel(msgDate);
    const timeLabel = msgDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    // 📅 Date separator
    if (dateLabel !== lastDate) {
      box.innerHTML += `
              <div class="chat-date">${dateLabel}</div>
            `;
      lastDate = dateLabel;
    }

    // 💬 Message bubble
    box.innerHTML += `
          <div class="chat-bubble ${isAdmin ? "me" : "other"}">
            <div class="chat-text">${m.message}</div>
            <div class="chat-time">${timeLabel}</div>
          </div>
        `;
  });

  box.scrollTop = box.scrollHeight;
}

/* ===== HELPER: GET DATE LABEL ===== */
function getDateLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}


/* ===== SEND ADMIN MESSAGE ===== */
function sendAdminMessage() {
  const input = document.getElementById("admin-chat-input");

  if (!input.value.trim() || !activeRoom) return;

  socket.emit("send_message", {
    room: activeRoom,
    sender: "Admin",
    role: "admin",
    message: input.value
  });

  input.value = "";
}

/* ===== INITIAL LOAD ===== */
document.addEventListener("DOMContentLoaded", () => {
  loadActiveChats();
});


/* ================= POST ANNOUNCEMENT ================= */
async function postAnnouncement() {
  const title = document.getElementById("annTitle").value.trim();
  const message = document.getElementById("annMessage").value.trim();
  const type = document.getElementById("annType").value;

  if (!title || !message) {
    alert("Title & message required");
    return;
  }

  const res = await fetch("http://localhost:3000/admin/announcement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, message, type })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error);

  alert("Announcement posted");

  document.getElementById("annTitle").value = "";
  document.getElementById("annMessage").value = "";
}
