import { db } from "./firebase.js";
import { 
    collection,
    query,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

let currentSearchTerm = '';
let currentFilters = {
    type: '',
    category: '',
    date: '',
    tags: ''
};

// Sorting of the sorting hehe
let currentSort = 'title-asc'; // Default sort: title A-Z
const sortOption = document.getElementById('sort-option');
if (sortOption) {
    sortOption.addEventListener('change', () => {
        currentSort = sortOption.value || 'title-asc';
        if (window.currentSearchResults.length > 0) {
            const sortedResults = sortResults(window.currentSearchResults, currentSort);
            window.currentSearchResults = sortedResults;
            displaySearchResults(sortedResults);
        }
    });
}

window.currentSearchResults = [];

async function performSearch() {
    const searchInput = document.querySelector('.search-input');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim();
    currentSearchTerm = searchTerm;
    
    currentFilters = {
        type: document.getElementById('filter-type')?.value || '',
        category: document.getElementById('filter-category')?.value || '',
        date: document.getElementById('filter-date')?.value || '',
        tags: document.getElementById('filter-tags')?.value.toLowerCase() || ''
    };

    currentSort = document.getElementById('sort-option')?.value || 'title-asc';

    try {
        let q = query(collection(db, "archiveItems"));
        const querySnapshot = await getDocs(q);
        
        const allResults = [];
        querySnapshot.forEach((doc) => {
            const file = doc.data();
            if (matchesSearchTerm(file, searchTerm) && matchesFilters(file)) {
                allResults.push({ id: doc.id, ...file });
            }
        });
        
        // Sort results based on currentSort
        const sortedResults = sortResults(allResults, currentSort);
        window.currentSearchResults = sortedResults;
        displaySearchResults(sortedResults);
        
        // Add search-active class to centered-content
        const centeredContent = document.querySelector('.centered-content');
        if (centeredContent) {
            centeredContent.classList.add('search-active');
        }
    } catch (error) {
        console.error("Search error:", error);
        alert("Error performing search");
    }
}

function matchesSearchTerm(file, searchTerm) {
    if (!searchTerm) return true;
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    if (file.metadata?.title?.toLowerCase().includes(lowerSearchTerm)) {
        return true;
    }
    
    if (file.metadata?.description?.toLowerCase().includes(lowerSearchTerm)) {
        return true;
    }
    
    if (file.metadata?.tags?.some(tag => tag.toLowerCase().includes(lowerSearchTerm))) {
        return true;
    }
    
    if (file.name?.toLowerCase().includes(lowerSearchTerm)) {
        return true;
    }
    
    return false;
}

function matchesFilters(file) {
    if (currentFilters.type && getSimplifiedType(file.type) !== currentFilters.type) {
        return false;
    }
    
    if (currentFilters.category && file.metadata?.category !== currentFilters.category) {
        return false;
    }
    
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

function sortResults(results, sortOption) {
    return [...results].sort((a, b) => {
        switch (sortOption) {
            case 'date-desc':
                return (b.uploadedAt?.toDate() || new Date()) - (a.uploadedAt?.toDate() || new Date());
            case 'date-asc':
                return (a.uploadedAt?.toDate() || new Date()) - (b.uploadedAt?.toDate() || new Date());
            case 'title-asc':
                return (a.metadata?.title || a.name || '').localeCompare(b.metadata?.title || b.name || '');
            case 'title-desc':
                return (b.metadata?.title || b.name || '').localeCompare(a.metadata?.title || a.name || '');
            case 'size-asc':
                return (a.size || 0) - (b.size || 0);
            case 'size-desc':
                return (b.size || 0) - (a.size || 0);
            default:
                return 0;
        }
    });
}

function displaySearchResults(allResults) {
    const resultsContainer = document.getElementById('search-results');
    const searchContainer = document.querySelector('.search-results-container');
    
    if (!resultsContainer || !searchContainer) {
        console.error('Search results container not found');
        return;
    }
    
    if (!allResults || allResults.length === 0) {
        resultsContainer.innerHTML = '<p>No results found</p>';
        searchContainer.style.display = 'block';
        return;
    }
    
    resultsContainer.innerHTML = '';
    
    allResults.forEach((file) => {
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
            </div>
            <div class="search-result-actions">
                <a href="${file.url}" target="_blank" class="view-btn">
                    <img src="images/icons/view.png" alt="View">
                </a>
                <a href="${file.url}" download="${file.name}" class="download-btn">
                    <img src="images/icons/download.png" alt="Download">
                </a>
            </div>
        `;
        resultsContainer.appendChild(resultItem);
    });
    
    searchContainer.style.display = 'block';
}

function clearSearchResults() {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = '';
    const filterType = document.getElementById('filter-type');
    const filterCategory = document.getElementById('filter-category');
    const filterDate = document.getElementById('filter-date');
    const filterTags = document.getElementById('filter-tags');
    const sortOption = document.getElementById('sort-option');
    if (filterType) filterType.value = '';
    if (filterCategory) filterCategory.value = '';
    if (filterDate) filterDate.value = '';
    if (filterTags) filterTags.value = '';
    if (sortOption) sortOption.value = 'title-asc';
    
    const searchContainer = document.querySelector('.search-results-container');
    const searchResults = document.getElementById('search-results');
    if (searchContainer) searchContainer.style.display = 'none';
    if (searchResults) searchResults.innerHTML = '';
    
    // Remove search-active class from centered-content
    const centeredContent = document.querySelector('.centered-content');
    if (centeredContent) {
        centeredContent.classList.remove('search-active');
    }
    
    currentSearchTerm = '';
    currentFilters = {
        type: '',
        category: '',
        date: '',
        tags: ''
    };
    currentSort = 'title-asc';
    window.currentSearchResults = [];
}

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
    if (typeof bytes !== 'number') return bytes;
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

export { performSearch, clearSearchResults, formatFileSize, formatDate, getSimplifiedType, getFileIcon };