import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { auth } from "./firebase.js";

document.getElementById("signup-btn").addEventListener("click", (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            console.log("User signed up:", user);
            alert("Signup successful!");
            window.location.href = "home.html"; // Redirect after signup
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error("Error signing up:", errorCode, errorMessage);
            alert(errorMessage); // Show error message to the user
        });
});
