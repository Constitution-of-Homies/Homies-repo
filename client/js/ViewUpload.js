import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDyLL5lej7NYTIi9udmCwe_l7HsVb7e-AQ",
  authDomain: "constitution-of-homies.firebaseapp.com",
  projectId: "constitution-of-homies",
  storageBucket: "constitution-of-homies.appspot.com",
  messagingSenderId: "534709453915",
  appId: "1:534709453915:web:855e13de6ef93393f16b7e",
  measurementId: "G-9SCYLHCB0L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

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
  default: '📁'
};

// Wait for DOM to be fully loaded before executing
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, (user) => {
    const filesContainer = document.getElementById('files-container');
    if (!filesContainer) {
      console.error("Files container element not found");
      return;
    }

    if (user) {
      displayFiles(user.uid);
    } else {
      filesContainer.innerHTML = 
        '<p class="auth-message">Please sign in to view your files</p>';
    }
  });
});

async function displayFiles(userId) {
  const container = document.getElementById('files-container');
  if (!container) {
    console.error("Files container element not found");
    return;
  }

  try {
    console.log(`Fetching files for user: ${userId}`); // Debug log
    container.innerHTML = '<section class="file-card">Loading...</section>';
    
    // Try both possible field names for uploader
    let q = query(
      collection(db, "archiveItems"), 
      where("Uploaded", "==", userId)
    );
    
    // First try with "Uploaded"
    let querySnapshot = await getDocs(q);
    
    // If no results, try with "uploadedBy"
    if (querySnapshot.empty) {
      console.log("Trying with 'uploadedBy' field instead");
      q = query(
        collection(db, "archiveItems"), 
        where("uploadedBy", "==", userId)
      );
      querySnapshot = await getDocs(q);
    }

    console.log(`Found ${querySnapshot.size} documents`); // Debug log
    
    container.innerHTML = ''; // Clear loading message

    if (querySnapshot.empty) {
      console.log("No files found after trying both field names");
      container.innerHTML = '<p class="auth-message">No files found</p>';
      return;
    }

    querySnapshot.forEach((doc) => {
      const file = doc.data();
      console.log("Processing file document:", file); // Debug log
      
      const fileType = getSimplifiedType(file.type);
      const fileIcon = fileIcons[fileType] || fileIcons.default;

      if (!file.url) {
        console.error("File document is missing URL:", file);
        return;
      }
      
      // Test the URL before creating the card
      testUrlAccessibility(file.url).then((isAccessible) => {
        if (!isAccessible) {
          console.error(`URL not accessible: ${file.url}`);
          return;
        }
        
        const card = document.createElement('section');
        card.className = 'file-card';
        card.innerHTML = `
          <section class="file-icon">${fileIcon}</section>
          <section class="file-details">
            <h3>${file.metadata?.title || file.name || 'Untitled'}</h3>
            <p class="file-description">${file.metadata?.description || ''}</p>
            <section class="file-meta">
              <p>${formatFileSize(file.size)}</p>
              <p>${formatDate(file.uploadedAt?.toDate())}</p>
            </section>
            <section class="file-actions">
              <a href="${file.url}" class="view-btn" target="_blank" rel="noopener noreferrer">View</a>
              <a href="${file.url}" class="download-btn" download="${file.name || 'download'}">Download</a>
            </section>
          </section>
        `;
        container.appendChild(card);
      }).catch(error => {
        console.error("Error testing URL:", error);
      });
    });

  } catch (error) {
    console.error("Error loading files:", error);
    container.innerHTML = 
      '<p class="error-message">Error loading files. Please check console for details.</p>';
  }
}

// Helper function to test URL accessibility
async function testUrlAccessibility(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
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

function formatDate(date) {
  if (!date) return 'Unknown date';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}