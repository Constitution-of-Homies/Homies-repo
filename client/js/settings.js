document.getElementById("email-notify-toggle").addEventListener("change", (e) => {
    if (e.target.checked) {
        console.log("Notifications Enabled");
        // functions needed to enable notifications
    } else {
        console.log("Notifications Disabled");
        // functions needed to disable notifications
    }
});

// DOM element
const backBtn = document.getElementById("back-btn");

backBtn.addEventListener("click", () => {
    window.location.href = "profile.html"; 
});
import{ auth } from "./firebase.js";

// sign out
document.getElementById('signout-btn')?.addEventListener('click', async () => {
    try {
        await auth.signOut();
        window.location.href = "index.html";
    } catch (error) {
        console.error("Sign out error:", error);
    }
});