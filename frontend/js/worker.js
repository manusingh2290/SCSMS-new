/* ================= AUTH CHECK ================= */
const userStr = localStorage.getItem("user");
if (!userStr) window.location.href = "login.html";

const user = JSON.parse(userStr);
if (user.role !== "worker") window.location.href = "login.html";

/* ================= LOAD NOTIFICATIONS ================= */
async function loadNotifications() {
  const res = await fetch(
    `https://scsms-backend.onrender.com/notifications/${user.role}/${user.name}`
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

/* =================Open & Close NOTIFICATIONS ================= */
function openNotifications() {
  const panel = document.getElementById("notificationPanel");
  const bell = document.getElementById("bell");
  const profile = document.getElementById("profileIcon"); // ✅ FIX

  panel.style.right = "0px";        // Slide in
  bell.style.display = "none";      // Hide bell
  profile.style.display = "none";   // Hide profile icon

  loadNotifications(); // Load notifications when opened
}

function closeNotifications() {
  const panel = document.getElementById("notificationPanel");
  const bell = document.getElementById("bell");
  const profile = document.getElementById("profileIcon"); // ✅ FIX

  panel.style.right = "-350px";     // Slide out
  bell.style.display = "block";     // Show bell
  profile.style.display = "block";  // Show profile icon
}




/* ================= LOAD TASKS ================= */
async function loadTasks() {
  const res = await fetch(
    "https://scsms-backend.onrender.com/worker/" + user.name
  );
  const data = await res.json();

  const active = document.getElementById("active");
  const history = document.getElementById("history");

  active.innerHTML = "";
  history.innerHTML = "";

  if (!data || data.length === 0) {
    active.innerHTML = "<li>No tasks assigned</li>";
    return;
  }

  data.forEach(c => {
    // 🟡 ACTIVE TASKS
    if (c.status !== "Resolved") {
      active.innerHTML += `
        <li>
          <b>ID:</b> ${c.id}<br>
          <b>Issue:</b> ${c.title}<br>
          <b>Status:</b> ${c.status}<br>

          ${c.latitude && c.longitude ? `
            <a 
              href="https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}" 
              target="_blank">
              🚗 Navigate to Location
            </a><br>
          ` : ""}
        </li>
        <hr>
      `;
    }

    // 🟢 RESOLVED TASKS (HISTORY)
    else {
      history.innerHTML += `
        <li>
          <b>ID:</b> ${c.id}<br>
          <b>Issue:</b> ${c.title}<br>
          <b>Status:</b> ${c.status}<br>

          ${c.completion_photo ? `
            <b>Completion Proof:</b><br>
            <img 
              src="https://scsms-backend.onrender.com/uploads/${c.completion_photo}" 
              width="120"
              style="border:1px solid #4CAF50"
            ><br>
          ` : ""}
        </li>
        <hr>
      `;
    }
  });

  if (active.innerHTML === "") {
    active.innerHTML = "<li>No active tasks</li>";
  }

  if (history.innerHTML === "") {
    history.innerHTML = "<li>No resolved tasks yet</li>";
  }
}

/* ================= UPDATE STATUS ================= */
async function update() {
  const id = document.getElementById("cid").value.trim();
  const stat = document.getElementById("status").value;
  const photoInput = document.getElementById("completionPhoto");

  if (!id) {
    alert("Enter Complaint ID");
    return;
  }

  const formData = new FormData();
  formData.append("status", stat);
  formData.append("worker_name", user.name);

  if (stat === "Resolved" && photoInput.files.length === 0) {
    alert("Upload completion photo to resolve task");
    return;
  }

  if (photoInput.files.length > 0) {
    formData.append("completion_photo", photoInput.files[0]);
  }

  const res = await fetch(
    "https://scsms-backend.onrender.com/complaint/" + id,
    {
      method: "PUT",
      body: formData
    }
  );

  const data = await res.json();

  if (!res.ok) {
    alert(data.error);
    return;
  }

  alert("Status updated");
  photoInput.value = "";
  loadTasks();
}

/* ================= LOGOUT ================= */
function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

/* ================= INITIAL LOAD ================= */
loadNotifications();
loadTasks();


function toggleTaskHistory() {
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

function openProfile() {
  window.location.href = "profile.html";
}


function toggleProfileMenu() {
  const menu = document.getElementById("profileMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}