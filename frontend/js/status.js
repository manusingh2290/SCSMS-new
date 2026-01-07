/* ================= AUTH CHECK ================= */
const userStr = localStorage.getItem("user");
if (!userStr) window.location.href = "login.html";

const user = JSON.parse(userStr);
if (user.role !== "citizen") window.location.href = "login.html";

/* ================= LOAD COMPLAINTS ================= */
async function loadComplaints() {
  const res = await fetch(
    "https://scsms-backend.onrender.com/complaints-by-user/" + user.id
  );
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
    // 🔴 ACTIVE COMPLAINTS
    if (c.status !== "Resolved") {
      active.innerHTML += `
        <li>
          <b>Issue:</b> ${c.title}<br>
          <b>Description:</b> ${c.description || "N/A"}<br>
          <b>Status:</b> ${c.status}<br>
          <div style="
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      align-items:flex-start;
    ">
      ${c.photo ? `
        <div>
          <small><b>Image Proof:</b></small><br>
          <img src="https://scsms-backend.onrender.com/uploads/${c.photo}" width="140">
        </div>
      ` : ""}<br>
        </li>
        <hr>
      `;
    }

    // 🟢 RESOLVED COMPLAINTS (HISTORY)
    else {
      history.innerHTML += `
        <li>
          <b>Issue:</b> ${c.title}<br>
          <b>Description:</b> ${c.description || "N/A"}<br>
          ${c.completion_photo ? `
            <b>Completion Proof:</b><br>
            <img 
              src="https://scsms-backend.onrender.com/uploads/${c.completion_photo}" 
              width="150"
              style="border:1px solid #4CAF50"
            ><br>
          ` : ""}
        </li>
        <hr>
      `;
    }
  });

  if (active.innerHTML === "") {
    active.innerHTML = "<li>No active complaints</li>";
  }

  if (history.innerHTML === "") {
    history.innerHTML = "<li>No resolved complaints yet</li>";
  }
}

// Auto load
loadComplaints();

/* ================= NAVIGATION ================= */
function goBack() {
  window.location.href = "citizen.html";
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

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