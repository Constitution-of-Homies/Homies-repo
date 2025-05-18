// dom elements
const backBtn = document.getElementById("back-btn");
const totalUploads = document.getElementById("total-uploads");
const totalViews = document.getElementById("total-views");
const totalDownloads = document.getElementById("total-downloads");

// back funtionality
backBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href="profile.html";
});

import { db, auth } from "./firebase.js";
import { 
    doc,
    setDoc,
    getDoc,
    updateDoc,
    increment,
    serverTimestamp,
    writeBatch,
    onSnapshot,
    collection
 } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Function to fetch and display analytics
async function setupAnalytics(userId) {
    // Reference to the user's analytics document
    const userAnalyticsRef = doc(db, "users", userId, "analytics", "stats");

    await setDoc(userAnalyticsRef, {
    uploads: 0,
    views: 0,
    downloads: 0
    }, { merge: true });

    // Set up real-time listener
    onSnapshot(userAnalyticsRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Update the UI with the latest stats
            totalUploads.textContent = typeof data.uploads === "number" ? data.uploads : 0;
            totalViews.textContent = typeof data.views === "number" ? data.views : 0;
            totalDownloads.textContent = typeof data.downloads === "number" ? data.downloads : 0;
        }
    }, (error) => {
        console.error("Error listening to analytics updates:", error);
    });
}


function getCurrentUserId() {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged((user) => {
            if (user) {
                resolve(user.uid);
            } else {
                reject("No user logged in");
                // Redirect to login if needed
                window.location.href = "login.html";
            }
        });
    });
}

// Initialize the analytics when the page loads
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const userId = await getCurrentUserId();
        setupAnalytics(userId);
    } catch (error) {
        console.error("Failed to initialize analytics:", error);
    }
});

// Function to increment views
export async function incrementViews(userId, documentId) {
    try {
        const batch = writeBatch(db);
        
        // Increment the document's view count
        const docRef = doc(db, "archiveItems", documentId, "analytics", "stats");
        batch.update(docRef, {
            views: increment(1),
            lastViewed: serverTimestamp()
        });
        
        // Increment the user's total views
        const statsRef = doc(db, "users", userId, "analytics", "stats");
        batch.update(statsRef, {
            views: increment(1)
        });
        
        await batch.commit();
    } catch (error) {
        console.error("Error incrementing views:", error);
    }
}

// Function to increment downloads
export async function incrementDownloads(userId, documentId) {
    try {
        const batch = writeBatch(db);
        
        // Increment the document's download count
        const docRef = doc(db, "archiveItems", documentId);
        batch.update(docRef, {
            downloads: increment(1),
            lastDownloaded: serverTimestamp()
        });
        
        // Increment the user's total downloads
        const statsRef = doc(db, "users", userId, "analytics", "stats");
        batch.update(statsRef, {
            downloads: increment(1)
        });
        
        await batch.commit();
    } catch (error) {
        console.error("Error incrementing downloads:", error);
    }
}

export async function incrementUploads(userId) {
    const statsRef = doc(db, "users", userId, "analytics", "stats");
    try {
        await updateDoc(statsRef, {
            uploads: increment(1)
        });
    } catch (error) {
        console.error("Error incrementing uploads:", error);
        if (error.code === 'not-found') {
            await setDoc(statsRef, {
                uploads: 1,
                views: 0,
                downloads: 0
                }, { merge: true });
        }
    }
}