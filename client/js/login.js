import { 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail,
    onAuthStateChanged,
    browserLocalPersistence,
    setPersistence,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { auth, db } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Set auth persistence
(async function initAuth() {
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (error) {
      console.error("Error setting auth persistence:", error);
    }
  })();

document.getElementById("login-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("User signed in:", user);
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            console.log("User data:", userDoc.data());
        } else {
            console.log("No user data found!");
        }

        // localStorage.setItem("user", JSON.stringify({
        //     uid: user.uid,
        //     email: user.email,
        //     username: user.displayName || userData?.username || userData?.name || "User",
        //     role: user.role,
        //     // Space for more XD
        // }));

        // // Message for if user exists or not
        // if (userDoc.exists()) {
        //     console.log("User data:", userDoc.data());
        // } else {
        //     console.log("No user data found!");
        // }
        
        window.location.href = "./index.html";
    } catch (error) {
        console.error("Error signing in:", error.code, error.message);
        let errorMessage = "Login failed. ";
        
        if (error.code === "auth/user-not-found") {
            errorMessage += "No account found with this email.";
        } else if (error.code === "auth/wrong-password") {
            errorMessage += "Incorrect password.";
        } else {
            errorMessage += error.message;
        }
        
        alert(errorMessage);
    }
});

document.getElementById("forgot-password").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;

    if (!email) {
        alert("Please enter your email address");
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        console.log("Password reset email sent!");
        alert("Password reset email sent! Please check your inbox.");
    } catch (error) {
        console.error("Error sending password reset email:", error.code, error.message);
        let errorMessage = "Failed to send reset email. ";
        
        if (error.code === "auth/user-not-found") {
            errorMessage += "No account found with this email.";
        } else {
            errorMessage += error.message;
        }
        
        alert(errorMessage);
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User is logged in:", user.uid);
        // You can update UI based on auth state here
    } else {
        console.log("User is logged out");
        // You can update UI based on auth state here
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
      window.location.href = "index.html";
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