/* ================= AUTH CHECK ================= */
const userStr = localStorage.getItem("user");
if (!userStr) window.location.href = "login.html";

const user = JSON.parse(userStr);
if (user.role !== "admin") window.location.href = "login.html";

/* ================= LOAD WORKERS ================= */
async function loadWorkers() {
  const res = await fetch("https://scsms-backend.onrender.com/workers");
  const workers = await res.json();

  const select = document.getElementById("workerSelect");
  select.innerHTML = '<option value="">Select Worker</option>';

  workers.forEach(w => {
    const option = document.createElement("option");
    option.value = w.name;
    option.textContent = w.name;
    select.appendChild(option);
  });
}

/* ================= LOAD WORKER ACTIVITY ================= */
async function loadActivity() {
  const worker = document.getElementById("workerSelect").value;

  if (!worker) {
    alert("Select a worker");
    return;
  }

  const res = await fetch(
    "https://scsms-backend.onrender.com/admin/worker-activity/" + worker
  );
  const data = await res.json();

  const assigned = document.getElementById("assigned");
  const progress = document.getElementById("progress");
  const resolved = document.getElementById("resolved");

  assigned.innerHTML = "";
  progress.innerHTML = "";
  resolved.innerHTML = "";

  if (!data || data.length === 0) {
    assigned.innerHTML = "<li>No tasks found</li>";
    return;
  }

  data.forEach(c => {
    // Assigned
    if (c.status === "Assigned") {
      assigned.innerHTML += `<li>
        <b>ID:</b> ${c.id} | ${c.title}
      </li>`;
    }

    // In Progress
    else if (c.status === "In Progress") {
      progress.innerHTML += `<li>
        <b>ID:</b> ${c.id} | ${c.title}
      </li>`;
    }

    // Resolved
    else if (c.status === "Resolved") {
      resolved.innerHTML += `<li>
        <b>ID:</b> ${c.id} | ${c.title}<br>

        ${c.completion_photo ? `
          <img 
            src="https://scsms-backend.onrender.com/uploads/${c.completion_photo}" 
            width="120"
          ><br>
        ` : ""}
      </li>`;
    }
  });
}

/* ================= NAVIGATION ================= */
function goBack() {
  window.location.href = "admin.html";
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

/* ================= INIT ================= */
loadWorkers();