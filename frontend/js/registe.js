async function register() {
  const nameVal = document.getElementById("name").value.trim();
  const emailVal = document.getElementById("email").value.trim();
  const passwordVal = document.getElementById("password").value.trim();

  if (!nameVal || !emailVal || !passwordVal) {
    alert("Please fill all fields");
    return;
  }

  const res = await fetch("http://localhost:3000/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: nameVal,
      email: emailVal,
      password: passwordVal
    })
  });

  const data = await res.json();

  if (data.error) {
    alert(data.error);
    return;
  }

  alert("Registration successful. Please login.");
  window.location.href = "login.html";
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  // Prevent page reload
  e.preventDefault();

  // Call register function
  register();
});


async function sendEmailOTP() {
  const email = document.getElementById("email").value;

  const res = await fetch("http://localhost:3000/auth/send-email-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "OTP send failed");
    return;
  }

  alert("📧 OTP sent to your email");

  // 🔥 SHOW OTP INPUT SECTION
  document.getElementById("otpSection").style.display = "block";

  // Auto-focus first OTP box
  document.querySelector(".otp-box").focus();
}


async function verifyEmailOTP() {
  const email = document.getElementById("email").value.trim();
  const nameVal = document.getElementById("name").value.trim();
  const passwordVal = document.getElementById("password").value.trim();

  const boxes = document.querySelectorAll(".otp-box");
  let otp = "";
  boxes.forEach(b => otp += b.value);

  if (!nameVal || !email || !passwordVal) {
    alert("Please fill all details");
    return;
  }

  if (otp.length !== 6) {
    alert("Please enter complete OTP");
    return;
  }

  // 1️⃣ Verify OTP
  const verifyRes = await fetch("http://localhost:3000/auth/verify-email-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp })
  });

  const verifyData = await verifyRes.json();
  if (!verifyRes.ok) return alert(verifyData.error);

  // 2️⃣ Register citizen
  const registerRes = await fetch("http://localhost:3000/register-citizen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: nameVal,
      email,
      password: passwordVal
    })
  });

  const registerData = await registerRes.json();
  if (!registerRes.ok) return alert(registerData.error);

  alert("🎉 Registration successful");
  window.location.href = "login.html";
}





document.addEventListener("DOMContentLoaded", () => {
  const otpBoxes = document.querySelectorAll(".otp-box");

  otpBoxes.forEach((box, index) => {
    box.addEventListener("input", () => {
      if (box.value && index < otpBoxes.length - 1) {
        otpBoxes[index + 1].focus();
      }
    });

    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && index > 0) {
        otpBoxes[index - 1].focus();
      }
    });
  });
});

