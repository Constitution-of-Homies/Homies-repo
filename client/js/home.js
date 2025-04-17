import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";


onAuthStateChanged(auth, (user) => {
  if (!user) {
      window.location.href = "login.html";
  } else {
    const userData = JSON.parse(localStorage.getItem("user"));

    document.getElementById("user-name").textContent = "Welcome: " + (userData?.username || "User");
    document.getElementById("user-email").textContent = "Email: " + (userData?.email || "No email");
  }
});

