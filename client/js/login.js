import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { auth, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.getElementById("login-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("User signed in:", user);
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;

        console.log("User document fields:", userData);

        localStorage.setItem("user", JSON.stringify({
            uid: user.uid,
            email: user.email,
            username: user.displayName || userData?.username || userData?.name || "User",
            role: user.role,
            // Space for more XD
        }));

        // Message for if user exists or not
        if (userDoc.exists()) {
            console.log("User data:", userDoc.data());
        } else {
            console.log("No user data found!");
        }
        
        window.location.href = "./home.html";
    } catch (error) {
        console.error("Error signing in:", error.code, error.message);
        alert(error.message);
    }
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

