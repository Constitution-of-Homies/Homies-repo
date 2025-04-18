import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.getElementById("signup-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const username = document.getElementById("username").value;

    if (!username || username.trim() === "") {
        alert("Please enter a username");
        return; // Stop execution if no username
      }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            username: username.trim().toLowerCase(),
            createdAt: new Date(),
            provider: "email/password",
            role: "admin"
        });

        localStorage.setItem("user", JSON.stringify({
            uid: user.uid,
            email: user.email,
            username: user.username || userData?.name || "User",
            role: "admin",
            // Space for more XD
        }));
        
        console.log("User signed up and profile created:", user.uid);
        alert("Signup successful!");
        window.location.href = "./home.html";
      } catch (error) {
        console.error("Error:", error.code, error.message);
        let errorMessage = "Signup failed. ";
        if (error.code === "auth/email-already-in-use") {
        errorMessage += "This email is already registered.";
        } else {
        errorMessage += error.message;
        }
        alert(errorMessage);
    }
});

const provider = new GoogleAuthProvider();

document.getElementById("google-login-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const username = user.displayName || 
      user.email.split('@')[0] || 
      `user${Math.random().toString(36).substring(2, 8)}`;

      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        username: username,
        photoURL: user.photoURL || null,
        createdAt: new Date(),
        provider: "google",
        role: "admin",
      }, { merge: true });

      localStorage.setItem("user", JSON.stringify({
        uid: user.uid,
        email: user.email,
        username: username,
        role: "admin",
        // Space for more XD
    }));
      
      console.log("Google login successful:", user.uid);
      window.location.href = "home.html";
    } catch (error) {
        console.error("Error:", error.code, error.message);
        alert(`Google login failed: ${error.message}`);
    }
});