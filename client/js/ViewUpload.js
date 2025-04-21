import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { auth, db } from "./firebase.js";

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

  // Event delegation for edit and delete buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn')) {
      const docId = e.target.dataset.docId;
      const title = e.target.dataset.title || 'Untitled';
      const description = e.target.dataset.description || '';
      const tags = e.target.dataset.tags || '';
      const category = e.target.dataset.category || 'general';
      openEditModal(docId, title, description, tags, category);
    } else if (e.target.classList.contains('delete-btn')) {
      const docId = e.target.dataset.docId;
      const blobName = e.target.dataset.blobName;
      if (confirm('Are you sure you want to delete this file?')) {
        deleteFile(docId, blobName);
      }
    }
  });

  // Handle edit form submission
  const editForm = document.getElementById('edit-form');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const docId = editForm.dataset.docId;
      const title = document.getElementById('edit-title').value;
      const description = document.getElementById('edit-description').value;
      const tags = document.getElementById('edit-tags').value;
      const category = document.getElementById('edit-category').value;
      await updateFileMetadata(docId, { title, description, tags, category });
      closeEditModal();
      // Refresh the file list
      const user = auth.currentUser;
      if (user) {
        displayFiles(user.uid);
      }
    });
  }

  // Close modal on cancel
  const cancelBtn = document.getElementById('cancel-edit');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeEditModal);
  }
});

async function displayFiles(userId) {
  const container = document.getElementById('files-container');
  if (!container) {
    console.error("Files container element not found");
    return;
  }

  try {
    console.log(`Fetching files for user: ${userId}`);
    container.innerHTML = '<section class="file-card">Loading...</section>';
    
    let q = query(
      collection(db, "archiveItems"), 
      where("uploadedBy", "==", userId)
    );
    
    let querySnapshot = await getDocs(q);
    
    console.log(`Found ${querySnapshot.size} documents`);
    
    container.innerHTML = '';

    if (querySnapshot.empty) {
      console.log("No files found");
      container.innerHTML = '<p class="auth-message">No files found</p>';
      return;
    }

    querySnapshot.forEach((doc) => {
      const file = doc.data();
      console.log("Processing file document:", file);
      
      const fileType = getSimplifiedType(file.type);
      const fileIcon = fileIcons[fileType] || fileIcons.default;

      if (!file.url) {
        console.error("File document is missing URL:", file);
        return;
      }
      
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
              <button class="edit-btn" 
                data-doc-id="${doc.id}" 
                data-title="${file.metadata?.title || file.name || 'Untitled'}" 
                data-description="${file.metadata?.description || ''}"
                data-tags="${file.metadata?.tags?.join(', ') || ''}"
                data-category="${file.metadata?.category || 'general'}">Edit</button>
              <button class="delete-btn" data-doc-id="${doc.id}" data-blob-name="${file.path || ''}">Delete</button>
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

// Open edit modal
function openEditModal(docId, title, description, tags, category) {
  const modal = document.getElementById('edit-modal');
  const form = document.getElementById('edit-form');
  const titleInput = document.getElementById('edit-title');
  const descriptionInput = document.getElementById('edit-description');
  const tagsInput = document.getElementById('edit-tags');
  const categoryInput = document.getElementById('edit-category');

  if (modal && form && titleInput && descriptionInput && tagsInput && categoryInput) {
    form.dataset.docId = docId;
    titleInput.value = title;
    descriptionInput.value = description;
    tagsInput.value = tags;
    categoryInput.value = category;
    modal.style.display = 'block';
  }
}

// Close edit modal
function closeEditModal() {
  const modal = document.getElementById('edit-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Update file metadata in Firestore
async function updateFileMetadata(docId, metadata) {
  try {
    const docRef = doc(db, "archiveItems", docId);
    const tagsArray = metadata.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    await updateDoc(docRef, {
      metadata: {
        title: metadata.title,
        description: metadata.description,
        tags: tagsArray,
        category: metadata.category
      }
    });
    // Update searchIndex
    const searchQuery = query(
      collection(db, "searchIndex"),
      where("itemId", "==", docId)
    );
    const searchSnapshot = await getDocs(searchQuery);
    searchSnapshot.forEach(async (searchDoc) => {
      await updateDoc(doc(db, "searchIndex", searchDoc.id), {
        title: metadata.title,
        description: metadata.description,
        tags: tagsArray,
        category: metadata.category
      });
    });
    console.log("Metadata updated successfully");
  } catch (error) {
    console.error("Error updating metadata:", error);
    alert("Failed to update metadata. Please try again.");
  }
}

// Delete file from Azure Blob Storage and Firestore
async function deleteFile(docId, blobName) {
  try {
    // Delete from Azure Blob Storage
    if (blobName) {
      const response = await fetch('/api/delete-blob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blobName })
      });
      if (!response.ok) {
        throw new Error(`Failed to delete blob: ${response.statusText}`);
      }
    }

    // Delete related Firestore documents
    const docRef = doc(db, "archiveItems", docId);
    await deleteDoc(docRef);
    console.log("Document deleted from archiveItems");

    // Delete from searchIndex
    const searchQuery = query(
      collection(db, "searchIndex"),
      where("itemId", "==", docId)
    );
    const searchSnapshot = await getDocs(searchQuery);
    searchSnapshot.forEach(async (searchDoc) => {
      await deleteDoc(doc(db, "searchIndex", searchDoc.id));
    });

    // Delete from archiveCollections
    const collectionQuery = query(
      collection(db, "archiveCollections"),
      where("itemId", "==", docId)
    );
    const collectionSnapshot = await getDocs(collectionQuery);
    collectionSnapshot.forEach(async (collDoc) => {
      await deleteDoc(doc(db, "archiveCollections", collDoc.id));
    });

    // Remove from user's uploads
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const uploads = userDoc.data().uploads || [];
        const updatedUploads = uploads.filter(upload => upload.itemId !== docId);
        await updateDoc(userRef, { uploads: updatedUploads });
      }
    }

    // Refresh the file list
    if (user) {
      displayFiles(user.uid);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    alert("Failed to delete file. Please try again.");
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

function formatFileSize(size) {
  if (!size) return 'Unknown size';
  
  if (typeof size === 'string' && /^[\d.]+ [KMG]?B$/.test(size)) {
    return size;
  }
  
  const bytes = typeof size === 'string' ? parseFloat(size) : size;
  if (isNaN(bytes)) return 'Unknown size';
  
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}