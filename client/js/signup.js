import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword,
  GoogleAuthProvider, 
  signInWithPopup,
  browserLocalPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

(async function initAuth() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.error("Error setting auth persistence:", error);
  }
})();

document.getElementById("signup-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const username = document.getElementById("username").value;

    if (!username || username.trim() === "") {
        alert("Please enter a username");
        return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          username: username.toLowerCase(),
          createdAt: new Date(),
          provider: "email/password",
          role: "admin",
          lastLogin: new Date()
      });

      console.log("User signed up and profile created:", user.uid);
      alert("Signup successful!");
      window.location.href = "./admin-page.html";
  } catch (error) {
      console.error("Error:", error.code, error.message);
      let errorMessage = "Signup failed. ";
      
      if (error.code === "auth/email-already-in-use") {
          errorMessage += "This email is already registered.";
      } else if (error.code === "auth/invalid-email") {
          errorMessage += "Please enter a valid email address.";
      } else if (error.code === "auth/weak-password") {
          errorMessage += "Password should be at least 6 characters.";
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
      
      // Generate username if not provided by Google
      const username = user.displayName || 
                       user.email.split('@')[0] || 
                       `user${Math.random().toString(36).substring(2, 8)}`;

      // Create or update user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          username: username,
          photoURL: user.photoURL || null,
          createdAt: new Date(),
          provider: "google",
          role: "admin",
          lastLogin: new Date()
      }, { merge: true });
      
      console.log("Google login successful:", user.uid);
      window.location.href = "admin-page.html";
  } catch (error) {
      console.error("Error:", error.code, error.message);
      
      let errorMessage = "Google login failed. ";
      if (error.code === "auth/popup-closed-by-user") {
          errorMessage += "You closed the sign-in window.";
      } else if (error.code === "auth/cancelled-popup-request") {
          errorMessage += "Sign-in was cancelled.";
      } else {
          errorMessage += error.message;
      }
      
      alert(errorMessage);
  }
});