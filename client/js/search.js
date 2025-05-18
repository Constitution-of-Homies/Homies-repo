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
        // Initialize UI
        const resultsContainer = document.getElementById('search-results');
        const searchContainer = document.querySelector('.search-results-container');
        if (resultsContainer && searchContainer) {
            resultsContainer.innerHTML = '<div class="loading-spinner"></div>';
            searchContainer.style.display = 'block';
        }

        // Initialize results array
        window.currentSearchResults = [];

        // Fetch documents from searchIndex
        let q = query(collection(db, "searchIndex"));
        const querySnapshot = await getDocs(q);
        
        // Process each document and append immediately
        for (const searchDoc of querySnapshot.docs) {
            const searchData = searchDoc.data();
            const archiveDoc = await getDoc(doc(db, "archiveItems", searchData.itemId));
            if (!archiveDoc.exists()) {
                console.log(`Archive item not found for searchDoc: ${searchDoc.id}`);
                continue;
            }

            const file = archiveDoc.data();
            file.id = archiveDoc.id;
            file.embeddings = searchData.embeddings || [];
            file.contentSnippet = searchData.content 
                ? searchData.content.substring(0, 100) + (searchData.content.length > 100 ? '...' : '') 
                : `File name: ${file.name || 'Untitled'}`;

            let relevanceScore = 0;
            if (useNLP) {
                const queryEmbeddings = await generateQueryEmbeddings(searchTerm);
                relevanceScore = file.embeddings.length > 0 
                    ? cosineSimilarity(queryEmbeddings, file.embeddings)
                    : calculateKeywordMatch(searchTerm, '', file); // Fallback to name-based search if no embeddings
            } else {
                relevanceScore = calculateKeywordMatch(searchTerm, searchData.content || '', file);
            }

            if (matchesFilters(file) && relevanceScore > 0) {
                const result = { ...file, similarity: relevanceScore };
                window.currentSearchResults.push(result);
                
                // Append result to DOM immediately
                appendSearchResult(result, resultsContainer, currentSort);
                
                // Remove loading spinner if at least one result is displayed
                const spinner = resultsContainer.querySelector('.loading-spinner');
                if (spinner) {
                    spinner.remove();
                }
            }
        }

        // Final sort if needed
        if (window.currentSearchResults.length > 0 && resultsContainer) {
            const sortedResults = sortResults(window.currentSearchResults, currentSort);
            window.currentSearchResults = sortedResults;
            resultsContainer.innerHTML = ''; // Clear and re-render for final sort
            sortedResults.forEach(result => appendSearchResult(result, resultsContainer, currentSort, false));
        } else if (window.currentSearchResults.length === 0 && resultsContainer) {
            resultsContainer.innerHTML = '<p>No results found with relevance above 0.</p>';
        }

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

// Append a single search result to the DOM
function appendSearchResult(file, resultsContainer, sortOption, insertSorted = true) {
    if (!resultsContainer) return;

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

    if (insertSorted) {
        // Insert in sorted position
        const existingItems = Array.from(resultsContainer.querySelectorAll('.search-result-item'));
        let inserted = false;
        for (let i = 0; i < existingItems.length; i++) {
            const existingFile = window.currentSearchResults[i];
            if (compareResults(file, existingFile, sortOption) < 0) {
                resultsContainer.insertBefore(resultItem, existingItems[i]);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            resultsContainer.appendChild(resultItem);
        }
    } else {
        // Append directly (used for final re-sort)
        resultsContainer.appendChild(resultItem);
    }
}

// Helper function to compare two results for sorting
function compareResults(a, b, sortOption) {
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
            return (b.metadata?.title || b.name || '').localeCompare(a.metadata?.title || b.name || '');
        case 'size-asc':
            return (a.size || 0) - (b.size || 0);
        case 'size-desc':
            return (b.size || 0) - (a.size || 0);
        default:
            return (b.similarity || 0) - (a.similarity || 0);
    }
}

// Calculate keyword match score
const WORD_COUNT_THRESHOLD = 10; // Documents with fewer than this many words get 1.0 if any search word appears
const STOP_WORDS = [
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'were', 'will', 'with'
];
function calculateKeywordMatch(searchTerm, content, file) {
    if (!searchTerm) return 0;
    
    // Split and filter out stop words
    const searchWords = searchTerm.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 0 && !STOP_WORDS.includes(word));
    
    // If no valid search words remain, return 0
    if (searchWords.length === 0) return 0;
    
    // Use content if available, otherwise use file name
    const contentText = content ? content.toLowerCase() : '';
    const title = (file.metadata?.title || file.name || '').toLowerCase();
    const tags = file.metadata?.tags ? file.metadata.tags.map(tag => tag.toLowerCase()).join(' ') : '';
    
    // Combine available text for search
    const allText = contentText ? `${contentText} ${title} ${tags}` : `${title} ${tags}`;
    const wordCount = allText.split(/\s+/).filter(word => word.length > 0).length;
    
    let anyMatch = false;
    let totalOccurrences = 0;
    
    // Check for matches and count occurrences
    searchWords.forEach(word => {
        const wordRegex = new RegExp(`\\b${word}\\b`, 'g');
        const contentMatches = contentText ? (contentText.match(wordRegex) || []).length : 0;
        const titleMatches = (title.match(wordRegex) || []).length;
        const tagsMatches = (tags.match(wordRegex) || []).length;
        const matches = contentMatches + titleMatches + tagsMatches;
        if (matches > 0) {
            anyMatch = true;
        }
        totalOccurrences += matches;
    });
    
    // If document has fewer than threshold words and any search word appears, return 1.0
    if (wordCount < WORD_COUNT_THRESHOLD && anyMatch) {
        return 1.0;
    }
    
    // Otherwise, use occurrence-based scoring: 0.05 per occurrence, capped at 1.0
    const matchScore = totalOccurrences * 0.05;
    return Math.min(matchScore, 1.0);
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
                return (b.metadata?.title || b.name || '').localeCompare(a.metadata?.title || b.name || '');
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
    if (type.includes('text')) return 'text';
    if (type.includes('javascript') || type.includes('python') || type.includes('java') || type.includes('html') || type.includes('css')) return 'code';
    return type.split('/')[0] || 'default';
}

function getFileIcon(type) {
    const fileIcons = {
        image: '<img src="images/icons/image.png" alt="Image Icon" class="file-icon">',
        video: '<img src="images/icons/video.png" alt="Video Icon" class="file-icon">',
        audio: '<img src="images/icons/audio.png" alt="Audio Icon" class="file-icon">',
        document: '<img src="images/icons/document.png" alt="Document Icon" class="file-icon">',
        spreadsheet: '<img src="images/icons/spreadsheet.png" alt="Spreadsheet Icon" class="file-icon">',
        presentation: '<img src="images/icons/presentation.png" alt="Presentation Icon" class="file-icon">',
        archive: '<img src="images/icons/archive.png" alt="Archive Icon" class="file-icon">',
        code: '<img src="images/icons/code.png" alt="Code Icon" class="file-icon">',
        pdf: '<img src="images/icons/pdf.png" alt="PDF Icon" class="file-icon">',
        text: '<img src="images/icons/text.png" alt="Text Icon" class="file-icon">',
        folder: '<img src="images/icons/folder.png" alt="Folder Icon" class="file-icon">',
        default: '<img src="images/icons/default.png" alt="Default Icon" class="file-icon">'
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