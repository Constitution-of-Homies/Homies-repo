import { auth, db } from "./firebase.js";
import { 
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  signOut
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
  doc, 
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Set auth persistence
(async function initAuth() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.error("Error setting auth persistence:", error);
  }
})();

// DOM elements
const userNameElement = document.getElementById("user-name");
const userEmailElement = document.getElementById("user-email");
const userAvatarElement = document.getElementById("user-avatar");
const signOutButton = document.getElementById("sign-out-btn");
const uploadsCard = document.getElementById("uploads-card");

// Auth state listener
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // User is not authenticated, redirect to login
    window.location.href = "login.html";
    return;
  }

  try {
    // Get additional user data from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.exists() ? userDoc.data() : null;

    // Update UI with user information
    userNameElement.textContent = `Welcome, ${userData?.username || user.displayName || "User"}`;
    userEmailElement.textContent = `${user.email}`;
    
    // Set avatar if available
    if (userData?.photoURL || user.photoURL) {
      userAvatarElement.src = userData?.photoURL || user.photoURL;
      userAvatarElement.style.display = "block";
    }

    // Load user's recent uploads
    await loadUserUploads(user.uid);
  } catch (error) {
    console.error("Error loading user data:", error);
    // Fallback to basic auth info if Firestore fails
    userNameElement.textContent = `Welcome, ${user.displayName || "User"}`;
    userEmailElement.textContent = `${user.email}`;
  }
});

// Add event listener for sign out button
if (signOutButton) {
  signOutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Error signing out. Please try again.");
    }
  });
}

// Function to fetch and display user's recent uploads
async function loadUserUploads(userId) {
  try {
    // Create a query against the uploads collection
    const uploadsQuery = query(
      collection(db, "uploads"),
      where("userId", "==", userId),
      limit(5)
    );

    // Get the query snapshot
    const querySnapshot = await getDocs(uploadsQuery);
    
    // If user has uploads, update the uploads card
    if (!querySnapshot.empty) {
      const uploadCount = querySnapshot.size;
      
      // If uploads-card exists, update its content
      if (uploadsCard) {
        const cardHeading = uploadsCard.querySelector("h2");
        const cardDescription = uploadsCard.querySelector("p");
        
        if (cardHeading && cardDescription) {
          cardHeading.textContent = "My Uploads";
          cardDescription.textContent = `View and manage your ${uploadCount} uploaded files.`;
        }
      }
    }
  } catch (error) {
    console.error("Error loading user uploads:", error);
  }
}

