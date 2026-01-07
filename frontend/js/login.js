let selectedRole = "";

function selectRole(role, el) {
  const loginBox = document.getElementById("loginBox");

  // 👉 If same role clicked again → CLOSE
  if (selectedRole === role) {
    loginBox.style.display = "none";
    selectedRole = "";

    document.querySelectorAll(".role-card").forEach(card =>
      card.classList.remove("active")
    );
    return;
  }

  // 👉 New role selected
  selectedRole = role;
  loginBox.style.display = "block";

  // Highlight selected card
  document.querySelectorAll(".role-card").forEach(card =>
    card.classList.remove("active")
  );

  // Show register only for citizen
  document.getElementById("registerLink").style.display =
    role === "citizen" ? "block" : "none";

  el.classList.add("active");

  // Auto-focus email field
  setTimeout(() => {
    document.getElementById("email")?.focus();
  }, 100);
}


async function login() {
  if (!selectedRole) {
    alert("Please select a role");
    return;
  }

  const res = await fetch("https://scsms-backend.onrender.com/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.value,
      password: password.value
    })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error);
    return;
  }

  if (data.user.role !== selectedRole) {
    alert("Unauthorized role access");
    return;
  }

  localStorage.setItem("user", JSON.stringify(data.user));

  if (selectedRole === "admin") location.href = "admin.html";
  else if (selectedRole === "worker") location.href = "worker.html";
  else location.href = "citizen.html";
}


async function loadLoginAnnouncements() {
  const res = await fetch("https://scsms-backend.onrender.com/announcements");
  const data = await res.json();

  const emergencyOnly = data.filter(a => a.type === "Emergency");

  const list = document.getElementById("loginAnnouncements");
  list.innerHTML = "";

  if (!emergencyOnly.length) {
    list.innerHTML = "<li>No emergency announcements</li>";
    return;
  }

  emergencyOnly.forEach(a => {
    list.innerHTML += `
      <li>
        <b>created At:</b> ${new Date(a.created_at).toLocaleString()}<br>
        🚨 <b>${a.title}</b><br>
        <small>${a.message}</small>
      </li>
    `;
  });
}
loadLoginAnnouncements();

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (!selectedRole) return;

  e.preventDefault();
  login();
});
