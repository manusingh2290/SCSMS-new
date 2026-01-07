/* ================= VELLORE CONFIG ================= */
const VELLORE_CENTER = [12.9165, 79.1325];
const VELLORE_RADIUS_KM = 25;

/* ================= AUTH CHECK ================= */
const userStr = localStorage.getItem("user");
if (!userStr) window.location.href = "login.html";
const user = JSON.parse(userStr);



/* ================= MAP INIT ================= */
const map = L.map("map", {
  maxBounds: [
    [12.75, 78.95], // South-West
    [13.05, 79.30]  // North-East
  ],
  maxBoundsViscosity: 1.0
}).setView(VELLORE_CENTER, 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

/* ===== CITY BOUNDARY ===== */
L.circle(VELLORE_CENTER, {
  radius: VELLORE_RADIUS_KM * 1000,
  color: "blue",
  fillColor: "#1e90ff",
  fillOpacity: 0.08
}).addTo(map);


document.addEventListener("DOMContentLoaded", () => {
  const photoInput = document.getElementById("photo");
  const titleInput = document.getElementById("title");

  if (!photoInput) return;

  photoInput.addEventListener("change", async () => {
    if (!photoInput.files[0]) return;

    // Optional: Show a "Processing..." message in the title box
    titleInput.value = "🤖 AI is analyzing image...";

    const formData = new FormData();
    formData.append("photo", photoInput.files[0]);

    try {
      const res = await fetch("https://scsms-backend.onrender.com/ai/suggest-title", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (data.suggestedTitle) {
        // Auto-fills the title, but user can still click and edit it
        titleInput.value = data.suggestedTitle;
      }
    } catch (err) {
      titleInput.value = ""; // Clear if failed
      console.error("AI Request failed", err);
    }
  });
});



function isInsideVellore(lat, lng) {
  const R = 6371; // km
  const dLat = deg2rad(lat - VELLORE_CENTER[0]);
  const dLng = deg2rad(lng - VELLORE_CENTER[1]);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(VELLORE_CENTER[0])) *
    Math.cos(deg2rad(lat)) *
    Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c <= VELLORE_RADIUS_KM;
}

function deg2rad(d) {
  return d * (Math.PI / 180);
}

/* ================= MAP CLICK HANDLER ================= */

let marker;

map.on("click", e => {
  const { lat, lng } = e.latlng;

  if (!isInsideVellore(lat, lng)) {
    alert("Please select a location inside Vellore city");
    return;
  }

  if (marker) marker.setLatLng(e.latlng);
  else marker = L.marker(e.latlng).addTo(map);

  latInput().value = lat;
  lngInput().value = lng;
  locationInput().value = `Vellore (Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)})`;
});


function latInput() { return document.getElementById("lat"); }
function lngInput() { return document.getElementById("lng"); }
function locationInput() { return document.getElementById("location"); }

/* ================= LIVE LOCATION ================= */
function useLiveLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (!isInsideVellore(lat, lng)) {
        alert("Your live location is outside Vellore city");
        return;
      }

      map.setView([lat, lng], 16);

      if (marker) marker.setLatLng([lat, lng]);
      else marker = L.marker([lat, lng]).addTo(map);

      latInput().value = lat;
      lngInput().value = lng;
      locationInput().value =
        `Live Location (Vellore) - Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
    },
    () => alert("Unable to fetch live location"),
    { enableHighAccuracy: true }
  );
}



/* ================= SUBMIT COMPLAINT ================= */
async function submitComplaint() {
  const lat = document.getElementById("lat").value;
  const lng = document.getElementById("lng").value;

  if (!lat || !lng) {
    alert("Please select a location inside Vellore city");
    return;
  }

  if (!isInsideVellore(parseFloat(lat), parseFloat(lng))) {
    alert("Complaint location must be within Vellore city");
    return;
  }


  const formData = new FormData();

  formData.append("citizen_id", user.id);     // ✅ REQUIRED
  formData.append("citizen_name", user.name);
  formData.append("title", document.getElementById("title").value);
  formData.append("description", document.getElementById("desc").value);
  formData.append("location", document.getElementById("location").value);
  formData.append("latitude", document.getElementById("lat").value || null);
  formData.append("longitude", document.getElementById("lng").value || null);

  if (document.getElementById("photo").files.length > 0) {
    formData.append("photo", document.getElementById("photo").files[0]);
  }

  const res = await fetch("https://scsms-backend.onrender.com/complaint", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Failed to submit complaint");
    document.getElementById("photo").value = "";
    return;
  }


  alert("Complaint submitted successfully");


  loadCitizenStats();
  loadRecentActivity?.();

  // Clear fields
  document.getElementById("title").value = "";
  document.getElementById("desc").value = "";
  document.getElementById("location").value = "";
  document.getElementById("photo").value = "";
}

/* ================= NOTIFICATIONS ================= */
async function loadNotifications() {
  const res = await fetch(
    `https://scsms-backend.onrender.com/notifications/${user.role}/${user.name}`
  );
  const data = await res.json();
  notify.innerHTML = "";

  if (!data.length) {
    notify.innerHTML = "<li>No notifications</li>";
    return;
  }

  data.forEach(n => notify.innerHTML += `<li>${n.message}</li>`);
}

function openNotifications() {
  notificationPanel.style.right = "0";
  bell.style.display = "none";
  profileIcon.style.display = "none";
  loadNotifications();
}

function closeNotifications() {
  notificationPanel.style.right = "-350px";
  bell.style.display = "block";
  profileIcon.style.display = "block";
}

/* ================= PROFILE MENU ================= */
function toggleProfileMenu() {
  profileMenu.style.display =
    profileMenu.style.display === "block" ? "none" : "block";
}

function openProfile() {
  window.location.href = "profile.html";
}

function goToStatus() {
  window.location.href = "status.html";
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

/* ================= LIVE CHAT ================= */
const socket = io("http://localhost:3000");

socket.on("connect", () => {
  socket.emit("join_chat", `citizen_${user.id}`);
});


function toggleChat() {
  const win = document.getElementById("chat-window");
  const open = win.style.display === "none";
  win.style.display = open ? "flex" : "none";

  if (open) {
    const chatRoom = `citizen_${user.id}`;
    socket.emit("join_chat", chatRoom);

    loadChatHistory();
  }
}

async function loadChatHistory() {
  const room = `citizen_${user.id}`;

  const res = await fetch(
    `https://scsms-backend.onrender.com/chat-history/${room}`
  );

  const history = await res.json();
  renderMessages(history);
}


function renderMessages(history) {
  const box = document.getElementById("chat-messages");
  box.innerHTML = "";

  let lastDate = "";

  history.forEach(m => {
    const me = m.sender_name === user.name;

    const msgDate = new Date(m.created_at);
    const dateLabel = getDateLabel(msgDate);
    const timeLabel = msgDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    // 📅 DATE SEPARATOR
    if (dateLabel !== lastDate) {
      box.innerHTML += `
        <div class="chat-date">${dateLabel}</div>
      `;
      lastDate = dateLabel;
    }

    // 💬 MESSAGE BUBBLE
    box.innerHTML += `
      <div class="chat-bubble ${me ? "me" : "other"}">
        <div class="chat-text">${m.message}</div>
        <div class="chat-time">${timeLabel}</div>
      </div>
    `;
  });

  box.scrollTop = box.scrollHeight;
}

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


function sendMessage() {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();

  if (!msg) return;

  socket.emit("send_message", {
  room: `citizen_${user.id}`,
  sender: user.name,
  role: "citizen",
  message: msg
});


  input.value = "";
}



socket.on("receive_message", data => {
  if (data.room === `citizen_${user.id}`) {
    loadChatHistory();
  }
});



async function loadStats() {
  const res = await fetch(
    `https://scsms-backend.onrender.com/citizen/stats/${user.id}`
  );
  const s = await res.json();

  totalCount.innerText = s.total;
  resolvedCount.innerText = s.resolved;
  pendingCount.innerText = s.pending;
  impactScore.innerText = s.points;

  badge.innerText =
    s.points >= 500 ? "🏆 Community Hero"
      : s.points >= 200 ? "🛡️ Guardian"
        : "👁️ Observer";
}


async function loadCommunityIssues() {
  const res = await fetch("https://scsms-backend.onrender.com/complaints-map");
  const issues = await res.json();

  issues.forEach(issue => {
    const color = issue.status === "Resolved" ? "green" : "red";

    L.circleMarker([issue.latitude, issue.longitude], {
      radius: 8,
      color,
      fillColor: color,
      fillOpacity: 0.8
    })
      .bindPopup(`
      <b>Status:</b> ${issue.status}<br>
      <b>Issue ID:</b> ${issue.id}
    `)
      .addTo(map);
  });
}
loadCommunityIssues();

async function loadRecentActivity() {
  const res = await fetch(
    `https://scsms-backend.onrender.com/citizen/activity/${user.id}`
  );
  const data = await res.json();

  const timeline = document.getElementById("activityList");
  timeline.innerHTML = "";

  if (!data.length) {
    timeline.innerHTML = "<li>No recent activity</li>";
    return;
  }

  data.forEach(i => {
    timeline.innerHTML += `
      <li>
        <b>${i.title}</b><br>
        Status:
        <span style="color:${i.status === "Resolved" ? "green" : "orange"}">
          ${i.status}
        </span><br>
        <small>
          Updated: ${new Date(i.updated_at).toLocaleString()}
        </small>
      </li>
    `;
  });
}


loadStats();
loadRecentActivity();



function callNumber(number) {
  if (confirm(`Call emergency number ${number}?`)) {
    window.location.href = `tel:${number}`;
  }
}


/* ================= LOAD ANNOUNCEMENTS ================= */
async function loadAnnouncements() {
  const res = await fetch("https://scsms-backend.onrender.com/announcements");
  const data = await res.json();

  const list = document.getElementById("announcements");
  list.innerHTML = "";

  if (!data.length) {
    list.innerHTML = "<li>No announcements</li>";
    return;
  }

  // Group by date
  const grouped = {};

  data.forEach(a => {
    const d = new Date(a.created_at);
    const dateKey = d.toLocaleDateString("en-IN");

    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(a);
  });

  Object.keys(grouped).forEach(date => {
    list.innerHTML += `
      <li class="date-separator">📅 ${date}</li>
    `;

    grouped[date].forEach(a => {
      const time = new Date(a.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      const icon =
        a.type === "Emergency" ? "🚨" :
          a.type === "Utility" ? "🚧" : "📢";

      list.innerHTML += `
        <li class="announcement-item">
          <div>
            ${icon} <b>${a.title}</b><br>
            <small>${a.message}</small>
          </div>
          <span class="time">${time}</span>
        </li>
      `;
    });
  });
}


loadAnnouncements();

/* ================= LOAD CITIZEN STATS ================= */
async function loadCitizenStats() {
  try {
    const res = await fetch(
      `https://scsms-backend.onrender.com/citizen/stats/${user.id}`
    );

    const stats = await res.json();

    document.getElementById("totalCount").innerText = stats.total;
    document.getElementById("resolvedCount").innerText = stats.resolved;
    document.getElementById("pendingCount").innerText = stats.pending;
    document.getElementById("impactScore").innerText = stats.impactPoints;
    document.getElementById("badge").innerText = stats.badge;

  } catch (err) {
    console.error("Failed to load stats", err);
  }
}
loadCitizenStats();


/* ================= REAL-TIME WEATHER ================= */

const WEATHER_API_KEY = "d6f7481c9b6e06808c18276e36642d1c";
const CITY_LAT = 12.9165; // Vellore
const CITY_LON = 79.1325;

async function loadWeather() {
  try {
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${CITY_LAT}&lon=${CITY_LON}&units=metric&appid=${WEATHER_API_KEY}`
    );

    const weather = await weatherRes.json(); // ✅ FIRST

    if (!weather.main) {
      console.error("Weather API response:", weather);
      return;
    }

    document.getElementById("temp").innerText =
      Math.round(weather.main.temp) + "°C";

    document.getElementById("weatherDesc").innerText =
      weather.weather[0].description;

    document.getElementById("humidity").innerText =
      weather.main.humidity + "%";

    document.getElementById("wind").innerText =
      weather.wind.speed + " km/h";

    document.getElementById("sunrise").innerText =
      new Date(weather.sys.sunrise * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

    document.getElementById("sunset").innerText =
      new Date(weather.sys.sunset * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

  } catch (err) {
    console.error("Weather error:", err);
  }
}


async function loadAQI_UV() {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${CITY_LAT}&lon=${CITY_LON}&appid=${WEATHER_API_KEY}`
    );
    const data = await res.json();

    const aqiIndex = data.list[0].main.aqi;

    const aqiText =
      aqiIndex === 1 ? "Good" :
        aqiIndex === 2 ? "Fair" :
          aqiIndex === 3 ? "Moderate" :
            aqiIndex === 4 ? "Poor" : "Very Poor";

    document.getElementById("aqi").innerText = aqiText;

    /* UV Index (approx via solar radiation) */
    document.getElementById("uv").innerText =
      aqiIndex >= 4 ? "High" : "Moderate";

  } catch (err) {
    console.error("AQI error:", err);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  loadWeather();
  loadAQI_UV();

  setInterval(() => {
    loadWeather();
    loadAQI_UV();
  }, 300000); // 10 minutes
});


function toggleEmergencyMenu() {
  const menu = document.getElementById("emergencyMenu");
  if (!menu) return;

  menu.style.display =
    menu.style.display === "flex" ? "none" : "flex";
}

function callEmergency(number) {
  window.location.href = `tel:${number}`;
}
