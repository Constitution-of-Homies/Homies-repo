import { 
    auth, 
    db 
} from "./firebase.js";
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { performSearch, clearSearchResults } from "./search.js";

// Profile dropdown functionality
const profileItem = document.querySelector('.profile-item');
if (profileItem) {
    profileItem.addEventListener('mouseenter', function() {
        this.setAttribute('aria-expanded', 'true');
    });
    profileItem.addEventListener('mouseleave', function() {
        this.setAttribute('aria-expanded', 'false');
    });
}

// Filter section toggle
const filterButton = document.querySelector('.filter-button');
const filterSection = document.querySelector('.filter-section');
if (filterButton && filterSection) {
    filterButton.addEventListener('click', function() {
        filterSection.classList.toggle('active');
        
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            if (filterSection.classList.contains('active')) {
                searchContainer.style.borderRadius = '4px 4px 0 0';
            } else {
                searchContainer.style.borderRadius = '4px';
            }
        }
    });
}

// Search functionality
const searchButton = document.querySelector('.search-button');
const searchInput = document.querySelector('.search-input');
if (searchButton && searchInput) {
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

// Clear search results
const clearBtn = document.querySelector('.clear-search-btn');
if (clearBtn) {
    clearBtn.addEventListener('click', clearSearchResults);
}

// Check auth state
document.addEventListener('DOMContentLoaded', function() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Get additional user data from Firestore
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const userData = userDoc.exists() ? userDoc.data() : null;
                
                // Update profile section with user info
                updateProfileSection(user, userData);
                
                // Make dashboard clickable
                const dashboardItem = document.querySelector('li:nth-child(2)');
                if (dashboardItem) {
                    dashboardItem.addEventListener('click', () => {
                        window.location.href = "profile.html";
                    });
                    dashboardItem.style.cursor = 'pointer';
                }
            } catch (error) {
                console.error("Error loading user data:", error);
                updateProfileSection(user);
            }
        } else {
            // User is not logged in
            updateUIForAuthState(false);
            
            // Make dashboard redirect to login
            const dashboardItem = document.querySelector('li:nth-child(2)');
            if (dashboardItem) {
                dashboardItem.addEventListener('click', () => {
                    window.location.href = "login.html";
                });
                dashboardItem.style.cursor = 'pointer';
            }
        }
    });
});

function updateProfileSection(user, userData = null) {
    const profileItem = document.querySelector('.profile-item');
    if (!profileItem) return;

    const profileIcon = profileItem.querySelector('img');
    const profileText = profileItem.querySelector('.nav-text');
    
    if (!profileIcon || !profileText) {
        console.error('Profile icon or text not found');
        return;
    }

    // Update profile text with username
    profileText.textContent = userData?.username || user?.displayName || "Profile";
    
    // Update profile picture if available
    if (userData?.photoURL || user?.photoURL) {
        profileIcon.src = userData?.photoURL || user.photoURL;
        profileIcon.style.borderRadius = '50%'; // Make it circular
        profileIcon.classList.add('user-avatar'); // Add class for custom styling
        profileIcon.classList.remove('nav-icon'); // Remove the icon class that has the filter
    } else {
        // Reset to default icon if no image
        profileIcon.src = "./images/icons/user.png";
        profileIcon.style.borderRadius = '';
        profileIcon.classList.remove('user-avatar');
        profileIcon.classList.add('nav-icon');
    }
    
    // Update dropdown menu for logged in user
    updateUIForAuthState(!!user);
}

function updateUIForAuthState(isLoggedIn) {
    const profileOptions = document.querySelector('.profile-options');
    if (!profileOptions) {
        console.error('Profile options not found');
        return;
    }
    
    if (isLoggedIn) {
        // Update profile options for logged in user
        profileOptions.innerHTML = `
            <li>
                <a href="#" id="logout-btn" class="nav-link">
                    <img src="./images/icons/logout.png" alt="Logout" class="nav-icon">
                    <p class="nav-text">Logout</p>
                </a>
            </li>
        `;
        
        // Add logout functionality
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await signOut(auth);
                    window.location.reload();
                } catch (error) {
                    console.error("Logout error:", error);
                }
            });
        }
    } else {
        // Keep or restore the original login/signup options
        profileOptions.innerHTML = `
            <li>
                <a href="login.html" class="nav-link">
                    <img src="./images/icons/login.png" alt="Login" class="nav-icon">
                    <p class="nav-text">Login</p>
                </a>
            </li>
            <li>
                <a href="signup.html" class="nav-link">
                    <img src="./images/icons/signup.png" alt="Sign Up" class="nav-icon">
                    <p class="nav-text">Sign Up</p>
                </a>
            </li>
        `;
    }
}