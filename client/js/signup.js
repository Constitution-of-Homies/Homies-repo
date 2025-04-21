import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword,
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

