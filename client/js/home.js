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

let currentSearchTerm = '';
let currentFilters = {
    type: '',
    category: '',
    date: '',
    tags: ''
};
let currentPage = 1;
const resultsPerPage = 2;

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
document.querySelector('.filter-button').addEventListener('click', function() {
    // If filters are visible and we have a search term, perform search
    if (document.querySelector('.filter-section').classList.contains('active') && currentSearchTerm) {
        performSearch();
    }
});
document.querySelector('.search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

window.currentSearchResults = [];

async function performSearch() {
    currentPage = 1; // Reset to first page on new search
    const searchTerm = document.querySelector('.search-input').value.trim();
    currentSearchTerm = searchTerm;
    
    // Get current filter values
    currentFilters = {
        type: document.getElementById('filter-type').value,
        category: document.getElementById('filter-category').value,
        date: document.getElementById('filter-date').value,
        tags: document.getElementById('filter-tags').value.toLowerCase()
    };

    try {
        // Create a base query for ALL files (removed the user filter)
        let q = query(collection(db, "archiveItems"));
        
        // Execute the query
        const querySnapshot = await getDocs(q);
        
        // Filter results in memory
        const allResults = [];
        querySnapshot.forEach((doc) => {
            const file = doc.data();
            if (matchesSearchTerm(file, searchTerm) && matchesFilters(file)) {
                allResults.push({ id: doc.id, ...file });
            }
        });
        
        // Store all results and display first page
        window.currentSearchResults = allResults;
        displaySearchResults(allResults);
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

function matchesFilters(file) {
    // Type filter
    if (currentFilters.type && getSimplifiedType(file.type) !== currentFilters.type) {
        return false;
    }
    
    // Category filter
    if (currentFilters.category && file.metadata?.category !== currentFilters.category) {
        return false;
    }
    
    // Date filter
    if (currentFilters.date && file.uploadedAt) {
        const fileDate = file.uploadedAt.toDate();
        const now = new Date();
        
        switch(currentFilters.date) {
            case 'day':
                if (!isSameDay(fileDate, now)) return false;
                break;
            case 'week':
                if (!isSameWeek(fileDate, now)) return false;
                break;
            case 'month':
                if (!isSameMonth(fileDate, now)) return false;
                break;
            case 'year':
                if (fileDate.getFullYear() !== now.getFullYear()) return false;
                break;
        }
    }
    
    // Tags filter
    if (currentFilters.tags) {
        const tagTerms = currentFilters.tags.split(',').map(t => t.trim());
        if (!file.metadata?.tags || 
            !tagTerms.every(tag => 
                file.metadata.tags.some(fileTag => 
                    fileTag.toLowerCase().includes(tag)
                )
            )
        ) {
            return false;
        }
    }
    
    return true;
}

// Add these date helper functions
function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function isSameWeek(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.round(Math.abs((date1 - date2) / oneDay));
    return diffDays <= 7 && date1.getDay() <= date2.getDay();
}

function isSameMonth(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth();
}

function displaySearchResults(allResults) {
    const resultsContainer = document.getElementById('search-results');
    const searchContainer = document.querySelector('.search-results-container');
    const clearBtn = document.querySelector('.clear-search-btn');
    const paginationContainer = document.querySelector('.pagination-container');
    
    if (!allResults || allResults.length === 0) {
        resultsContainer.innerHTML = '<p>No results found</p>';
        searchContainer.style.display = 'block';
        if (paginationContainer) paginationContainer.style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(allResults.length / resultsPerPage);
    const startIndex = (currentPage - 1) * resultsPerPage;
    const endIndex = Math.min(startIndex + resultsPerPage, allResults.length);
    const pageResults = allResults.slice(startIndex, endIndex);
    
    // Display results
    resultsContainer.innerHTML = '';
    
    pageResults.forEach((file) => {
        const fileType = getSimplifiedType(file.type);
        const fileIcon = getFileIcon(fileType);
        
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.innerHTML = `
            <div class="search-result-icon">${fileIcon}</div>
            <div class="search-result-details">
                <h3>${file.metadata?.title || file.name || 'Untitled'}</h3>
                ${file.uploadedBy ? `<p class="search-result-uploader">Uploaded by: ${file.uploadedByName || 'Anonymous'}</p>` : ''}
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
    
    // Create or update pagination controls
    if (!paginationContainer) {
        const newPaginationContainer = document.createElement('div');
        newPaginationContainer.className = 'pagination-container';
        searchContainer.appendChild(newPaginationContainer);
        updatePaginationControls(newPaginationContainer, allResults.length, totalPages);
    } else {
        paginationContainer.style.display = 'flex';
        updatePaginationControls(paginationContainer, allResults.length, totalPages);
    }
    
    searchContainer.style.display = 'block';
    
    // Add event listener for clear button
    clearBtn.addEventListener('click', clearSearchResults);
}

function updatePaginationControls(container, totalResults, totalPages) {
    container.innerHTML = `
        <div class="pagination-info">
            Showing ${((currentPage - 1) * resultsPerPage) + 1}-${Math.min(currentPage * resultsPerPage, totalResults)} of ${totalResults} results
        </div>
        <div class="pagination-buttons">
            <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" id="prev-page">
                Previous
            </button>
            <div class="page-numbers">
                ${generatePageNumbers(totalPages)}
            </div>
            <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" id="next-page">
                Next
            </button>
        </div>
    `;
    
    // Add event listeners
    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displaySearchResults(window.currentSearchResults);
        }
    });
    
    document.getElementById('next-page')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            displaySearchResults(window.currentSearchResults);
        }
    });
    
    // Add event listeners for page numbers
    document.querySelectorAll('.page-number').forEach(button => {
        button.addEventListener('click', (e) => {
            currentPage = parseInt(e.target.textContent);
            displaySearchResults(window.currentSearchResults);
        });
    });
}

function generatePageNumbers(totalPages) {
    let pagesHtml = '';
    const maxVisiblePages = 5; // Show up to 5 page numbers
    
    if (totalPages <= maxVisiblePages) {
        // Show all pages
        for (let i = 1; i <= totalPages; i++) {
            pagesHtml += `<button class="page-number ${i === currentPage ? 'active' : ''}">${i}</button>`;
        }
    } else {
        // Show limited pages with ellipsis
        if (currentPage <= 3) {
            // Show first 3 pages, ellipsis, last page
            for (let i = 1; i <= 3; i++) {
                pagesHtml += `<button class="page-number ${i === currentPage ? 'active' : ''}">${i}</button>`;
            }
            pagesHtml += `<span class="ellipsis">...</span>`;
            pagesHtml += `<button class="page-number">${totalPages}</button>`;
        } else if (currentPage >= totalPages - 2) {
            // Show first page, ellipsis, last 3 pages
            pagesHtml += `<button class="page-number">1</button>`;
            pagesHtml += `<span class="ellipsis">...</span>`;
            for (let i = totalPages - 2; i <= totalPages; i++) {
                pagesHtml += `<button class="page-number ${i === currentPage ? 'active' : ''}">${i}</button>`;
            }
        } else {
            // Show first page, ellipsis, current page ±1, ellipsis, last page
            pagesHtml += `<button class="page-number">1</button>`;
            pagesHtml += `<span class="ellipsis">...</span>`;
            for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                pagesHtml += `<button class="page-number ${i === currentPage ? 'active' : ''}">${i}</button>`;
            }
            pagesHtml += `<span class="ellipsis">...</span>`;
            pagesHtml += `<button class="page-number">${totalPages}</button>`;
        }
    }
    
    return pagesHtml;
}

function clearSearchResults() {
    document.querySelector('.search-input').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-tags').value = '';
    
    document.querySelector('.search-results-container').style.display = 'none';
    document.getElementById('search-results').innerHTML = '';
    
    const paginationContainer = document.querySelector('.pagination-container');
    if (paginationContainer) paginationContainer.style.display = 'none';
    
    currentSearchTerm = '';
    currentPage = 1;
    currentFilters = {
        type: '',
        category: '',
        date: '',
        tags: ''
    };
    window.currentSearchResults = [];
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