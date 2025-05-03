import { 
    auth, 
    db 
} from "./firebase.js";
import { 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    doc, 
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Check auth state when page loads
document.addEventListener('DOMContentLoaded', function() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Get user data from Firestore
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const userData = userDoc.exists() ? userDoc.data() : null;
                
                // Update profile section with user info
                updateProfileSection(user, userData);
                
                // Set up edit functionality
                setupEditProfile(user, userData);
                
            } catch (error) {
                console.error("Error loading user data:", error);
                // Redirect to login if there's an error
                window.location.href = "login.html";
            }
        } else {
            // User is not logged in, redirect to login
            window.location.href = "login.html";
        }
    });
});

function updateProfileSection(user, userData) {
    const profileImage = document.querySelector('.profile-image');
    const profileName = document.querySelector('.profile-info h3');
    
    if (userData?.photoURL || user.photoURL) {
        profileImage.src = userData?.photoURL || user.photoURL;
    }
    profileName.textContent = userData?.displayName || user.displayName || "User";
}

function setupEditProfile(user, userData) {
    const editBtn = document.getElementById('edit-profile-btn');
    const drawer = document.getElementById('edit-drawer');
    const cancelBtn = document.getElementById('cancel-btn');
    const saveBtn = document.getElementById('save-btn');
    const backdrop = drawer.querySelector('.drawer-backdrop');
    
    // Open drawer
    editBtn.addEventListener('click', () => {
        // Populate form with current data
        document.getElementById('name').value = userData?.displayName || user.displayName || "";
        document.getElementById('email').value = user.email || "";
        
        drawer.classList.remove('hidden');
        setTimeout(() => drawer.classList.add('open'), 10);
    });
    
    // Close drawer
    function closeDrawer() {
        drawer.classList.remove('open');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
    
    cancelBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
    
    // Save profile
    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
            const updatedData = {
                displayName: document.getElementById('name').value,
                title: document.getElementById('bio').value,
                location: document.getElementById('city-town').value,
                phoneNumber: document.getElementById('phone').value
            };
            
            // Update in Firestore
            await updateDoc(doc(db, "users", user.uid), updatedData);
            
            // Update UI
            updateProfileSection(user, {
                ...userData,
                ...updatedData
            });
            
            closeDrawer();
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Failed to update profile");
        }
    });
}

// Handle sign out
document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
    try {
        await auth.signOut();
        window.location.href = "index.html";
    } catch (error) {
        console.error("Sign out error:", error);
    }
});