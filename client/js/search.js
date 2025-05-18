import { db, auth } from "./firebase.js";
import { 
    collection,
    query,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

let currentSearchTerm = '';
let currentFilters = {
    type: '',
    category: '',
    date: '',
    tags: ''
};

// Default sort: relevance (highest similarity)
let currentSort = 'relevance';
const sortOption = document.getElementById('sort-option');
if (sortOption) {
    sortOption.addEventListener('change', () => {
        currentSort = sortOption.value || 'relevance';
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

    currentSort = document.getElementById('sort-option')?.value || 'relevance';
    const useNLP = document.getElementById('nlp-toggle')?.checked || false;

    if (!searchTerm) {
        alert('Please enter a search term.');
        return;
    }

    try {
        // Show loading spinner
        const resultsContainer = document.getElementById('search-results');
        const searchContainer = document.querySelector('.search-results-container');
        if (resultsContainer && searchContainer) {
            resultsContainer.innerHTML = '<div class="loading-spinner"></div>';
            searchContainer.style.display = 'block';
        }

        // Fetch documents from searchIndex
        let q = query(collection(db, "searchIndex"));
        const querySnapshot = await getDocs(q);
        
        const allResults = [];
        for (const searchDoc of querySnapshot.docs) {
            const searchData = searchDoc.data();
            // Get corresponding archiveItem for metadata
            const archiveDoc = await getDoc(doc(db, "archiveItems", searchData.itemId));
            if (!archiveDoc.exists()) continue;

            const file = archiveDoc.data();
            file.id = archiveDoc.id;
            file.embeddings = searchData.embeddings || [];
            file.contentSnippet = searchData.content 
                ? searchData.content.substring(0, 100) + (searchData.content.length > 100 ? '...' : '') 
                : 'No content available';

            let relevanceScore = 0;
            if (useNLP) {
                // NLP-based search
                const queryEmbeddings = await generateQueryEmbeddings(searchTerm);
                relevanceScore = file.embeddings.length > 0 
                    ? cosineSimilarity(queryEmbeddings, file.embeddings)
                    : 0;
            } else {
                // Keyword-based search
                relevanceScore = calculateKeywordMatch(searchTerm, searchData.content, file);
            }

            if (matchesFilters(file) && relevanceScore > 0.1) { // Threshold for relevance
                allResults.push({ ...file, similarity: relevanceScore });
            }
        }
        
        // Sort results
        const sortedResults = sortResults(allResults, currentSort);
        window.currentSearchResults = sortedResults;
        displaySearchResults(sortedResults);
        
        // Add search-active class
        const centeredContent = document.querySelector('.centered-content');
        if (centeredContent) {
            centeredContent.classList.add('search-active');
        }
    } catch (error) {
        console.error("Search error:", error);
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<p>Error performing search</p>';
        }
        alert("Error performing search: " + error.message);
    }
}

// Calculate keyword match score
function calculateKeywordMatch(searchTerm, content, file) {
    if (!content || !searchTerm) return 0;
    
    const searchWords = searchTerm.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase();
    const title = (file.metadata?.title || file.name || '').toLowerCase();
    
    let matchScore = 0;
    
    // Check matches in content
    searchWords.forEach(word => {
        if (contentWords.includes(word)) {
            matchScore += 0.3; // Weight for content match
        }
    });
    
    // Check matches in title
    searchWords.forEach(word => {
        if (title.includes(word)) {
            matchScore += 1; // Higher weight for title match
        }
    });
    
    // Check matches in tags
    if (file.metadata?.tags) {
        searchWords.forEach(word => {
            if (file.metadata.tags.some(tag => tag.toLowerCase().includes(word))) {
                matchScore += 1; // Weight for tag match
            }
        });
    }
    
    // Normalize score to 0-1 range
    return Math.min(matchScore / (searchWords.length * 1.0), 1.0);
}

// Call the generateEmbeddings API
async function generateQueryEmbeddings(text) {
    try {
        const response = await fetch('https://scriptorium.azurewebsites.net/api/generateEmbeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate embeddings');
        }

        const data = await response.json();
        return data.embeddings || [];
    } catch (error) {
        console.error('Error generating query embeddings:', error);
        throw error;
    }
}

// Calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
    if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
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
            case 'relevance':
                return (b.similarity || 0) - (a.similarity || 0);
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
                return (b.similarity || 0) - (a.similarity || 0);
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
                <p class="search-result-snippet">${file.contentSnippet}</p>
                <p class="search-result-description">${file.metadata?.description || 'No description'}</p>
                <div class="search-result-meta">
                    <span>${formatFileSize(file.size)}</span>
                    <span>${formatDate(file.uploadedAt?.toDate())}</span>
                    <span>Relevance: ${(file.similarity * 100).toFixed(1)}%</span>
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
    const nlpToggle = document.getElementById('nlp-toggle');
    if (filterType) filterType.value = '';
    if (filterCategory) filterCategory.value = '';
    if (filterDate) filterDate.value = '';
    if (filterTags) filterTags.value = '';
    if (sortOption) sortOption.value = 'relevance';
    if (nlpToggle) nlpToggle.checked = false;
    
    const searchContainer = document.querySelector('.search-results-container');
    const searchResults = document.getElementById('search-results');
    if (searchContainer) searchContainer.style.display = 'none';
    if (searchResults) searchResults.innerHTML = '';
    
    // Remove search-active class
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
    currentSort = 'relevance';
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
    if (type.includes('javascript') || type.includes('python') || type.includes('java') || type.includes('html') || type.includes('css')) return 'code';
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