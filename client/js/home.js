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
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Profile dropdown functionality
document.querySelector('.profile-item').addEventListener('mouseenter', function() {
    this.setAttribute('aria-expanded', 'true');
});
document.querySelector('.profile-item').addEventListener('mouseleave', function() {
    this.setAttribute('aria-expanded', 'false');
});

// Filter section toggle
document.addEventListener('DOMContentLoaded', function() {
    const filterButton = document.querySelector('.filter-button');
    const filterSection = document.querySelector('.filter-section');
    
    filterButton.addEventListener('click', function() {
        filterSection.classList.toggle('active');
        
        const searchContainer = document.querySelector('.search-container');
        if (filterSection.classList.contains('active')) {
            searchContainer.style.borderRadius = '4px 4px 0 0';
        } else {
            searchContainer.style.borderRadius = '4px';
        }
    });

    // Check auth state
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
    const profileIcon = profileItem.querySelector('.nav-icon');
    const profileText = profileItem.querySelector('.nav-text');
    
    // Update profile text with username
    profileText.textContent = userData?.username || user.displayName || "Profile";
    
    // Update profile picture if available
    if (userData?.photoURL || user.photoURL) {
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
    updateUIForAuthState(true);
}

function updateUIForAuthState(isLoggedIn) {
    const profileOptions = document.querySelector('.profile-options');
    
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
        document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                window.location.reload();
            } catch (error) {
                console.error("Logout error:", error);
            }
        });
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

// Search functionality
document.querySelector('.search-button').addEventListener('click', performSearch);
document.querySelector('.search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

async function performSearch() {
    const searchTerm = document.querySelector('.search-input').value.trim();
    if (!searchTerm) return;
    
    const user = auth.currentUser;
    // if (!user) {
    //     alert('Please sign in to search');
    //     return;
    // }

    try {
        // Create a query for the user's files
        const q = query(
            collection(db, "archiveItems"),
            where("uploadedBy", "==", user.uid)
        );
        
        // Execute the query
        const querySnapshot = await getDocs(q);
        
        // Filter results in memory
        const results = [];
        querySnapshot.forEach((doc) => {
            const file = doc.data();
            if (matchesSearchTerm(file, searchTerm)) {
                results.push({ id: doc.id, ...file });
            }
        });
        
        displaySearchResults(results);
    } catch (error) {
        console.error("Search error:", error);
        alert("Error performing search");
    }
}

function matchesSearchTerm(file, searchTerm) {
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    // Check title
    if (file.metadata?.title?.toLowerCase().includes(lowerSearchTerm)) {
        return true;
    }
    
    // Check description
    if (file.metadata?.description?.toLowerCase().includes(lowerSearchTerm)) {
        return true;
    }
    
    // Check tags
    if (file.metadata?.tags?.some(tag => tag.toLowerCase().includes(lowerSearchTerm))) {
        return true;
    }
    
    // Check filename as fallback
    if (file.name?.toLowerCase().includes(lowerSearchTerm)) {
        return true;
    }
    
    return false;
}

function displaySearchResults(results) {
    const resultsContainer = document.getElementById('search-results');
    const searchContainer = document.querySelector('.search-results-container');
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<p>No results found</p>';
        searchContainer.style.display = 'block';
        return;
    }
    
    resultsContainer.innerHTML = '';
    
    results.forEach((file) => {
        const fileType = getSimplifiedType(file.type);
        const fileIcon = getFileIcon(fileType);
        
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.innerHTML = `
            <div class="search-result-icon">${fileIcon}</div>
            <div class="search-result-details">
                <h3>${file.metadata?.title || file.name || 'Untitled'}</h3>
                <p class="search-result-description">${file.metadata?.description || 'No description'}</p>
                <div class="search-result-meta">
                    <span>${formatFileSize(file.size)}</span>
                    <span>${formatDate(file.uploadedAt?.toDate())}</span>
                </div>
                <div class="search-result-actions">
                    <a href="${file.url}" target="_blank" class="view-btn">View</a>
                    <a href="${file.url}" download="${file.name}" class="download-btn">Download</a>
                </div>
            </div>
        `;
        resultsContainer.appendChild(resultItem);
    });
    
    searchContainer.style.display = 'block';
}

// Helper functions (add these if not already present)
function getSimplifiedType(fileType) {
    if (!fileType) return 'default';
    const type = fileType.toLowerCase();
    if (type.includes('image')) return 'image';
    if (type.includes('video')) return 'video';
    if (type.includes('audio')) return 'audio';
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'spreadsheet';
    if (type.includes('presentation') || type.includes('powerpoint')) return 'presentation';
    if (type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('7z')) return 'archive';
    if (type.includes('text') || type.includes('javascript') || type.includes('python') || type.includes('java') || type.includes('html') || type.includes('css')) return 'code';
    return type.split('/')[0] || 'default';
}

function getFileIcon(type) {
    const fileIcons = {
        image: '🖼️',
        video: '🎬',
        audio: '🎵',
        document: '📄',
        spreadsheet: '📊',
        presentation: '📑',
        archive: '🗄️',
        code: '💻',
        pdf: '📕',
        folder: '📁',
        default: '📄'
    };
    return fileIcons[type] || fileIcons.default;
}

function formatFileSize(bytes) {
    if (typeof bytes !== 'number') return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function formatDate(date) {
    if (!date) return 'Unknown date';
    return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}