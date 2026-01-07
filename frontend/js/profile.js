const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
  window.location.href = "login.html";
}

// Fill common fields
document.getElementById("pname").value = user.name;
document.getElementById("pemail").value = user.email;

// Citizen-specific logic
const addressSection = document.getElementById("addressSection");
const saveBtn = document.getElementById("saveBtn");

if (user.role === "citizen") {
  addressSection.style.display = "block";

  const addressField = document.getElementById("paddress");
  addressField.value = user.address || "";

  let originalAddress = addressField.value;

  addressField.addEventListener("input", () => {
    saveBtn.disabled = addressField.value.trim() === originalAddress;
  });
} else {
  // Admin & Worker → no edit allowed
  saveBtn.style.display = "none";
}

// Save profile (citizen only)
async function saveProfile() {
  const address = document.getElementById("paddress").value.trim();

  const res = await fetch("http://localhost:3000/profile/update", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: user.id,
      address
    })
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data.error);
    return;
  }

  alert("Profile updated");

  user.address = address;
  localStorage.setItem("user", JSON.stringify(user));
  saveBtn.disabled = true;
}

function goBack() {
  if (user.role === "admin") window.location.href = "admin.html";
  else if (user.role === "worker") window.location.href = "worker.html";
  else window.location.href = "citizen.html";
}
