import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { auth } from "./firebase.js";

document.getElementById("login-btn").addEventListener("click", (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Signed in
            const user = userCredential.user;
            console.log("User signed in:", user);
            window.location.href = "home.html"; // Redirect to home page on successful login
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error("Error signing in:", errorCode, errorMessage);
            alert(errorMessage); // Show error message to the user
        });
});

document.getElementById("forgot-password").addEventListener("click", (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;

    sendPasswordResetEmail(auth, email)
        .then(() => {
            // reset password
            console.log("Password reset email sent!")
            alert("Password reset email sent!")
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error("Error sending password reset email: ", errorCode, errorMessage);
            alert(errorMessage); // Show error message to the user
        });
});

