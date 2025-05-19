import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  addDoc,
  serverTimestamp,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { auth, db } from "./firebase.js";
import { setUploadPath } from './upload.js';

// File type icons
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

// Current directory path state
let currentPath = '';
let currentPathArray = [];

// Create hidden file input
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.id = 'fileInput';
fileInput.className = 'drop-zone__input';
fileInput.multiple = true;
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

// Utility functions
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number') return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

export function detectFileType(file) {
  const type = file.type ? file.type.toLowerCase() : '';
  if (type.includes('image')) return 'image';
  if (type.includes('video')) return 'video';
  if (type.includes('audio')) return 'audio';
  if (type.includes('pdf')) return 'pdf';
  if (type.includes('spreadsheet') || type.includes('excel')) return 'spreadsheet';
  if (type.includes('presentation') || type.includes('powerpoint')) return 'presentation';
  if (type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('7z')) return 'archive';
  if (type.includes('javascript') || type.includes('python') || type.includes('java') || type.includes('html') || type.includes('css')) return 'code';
  if (file.name) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
    if (['ppt', 'pptx'].includes(ext)) return 'presentation';
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return 'archive';
    if (['js', 'py', 'java', 'html', 'css', 'json'].includes(ext)) return 'code';
  }
  return type.split('/')[0] || 'default';
}

function getFileIcon(type) {
  return fileIcons[type] || fileIcons.default;
}

export function formatDate(date) {
  if (!date) return 'Unknown date';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function getSimplifiedType(fileType) {
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
      setupEventListeners(user.uid);
    } else {
      filesContainer.innerHTML = 
        '<p class="auth-message">Please sign in to view your files</p>';
    }
  });
});

window.addEventListener('filesUploaded', () => {
  const user = auth.currentUser;
  if (user) {
    displayFiles(user.uid);
  }
});

function setupEventListeners(userId) {
  // Event delegation for edit, delete, and folder navigation
  document.addEventListener('click', async (e) => {
    // Close all menus if click is outside
  if (!e.target.closest('.file-actions')) {
    document.querySelectorAll('.file-menu').forEach(menu => menu.classList.add('hidden'));
  }

  // Toggle specific menu
  if (e.target.classList.contains('ellipsis-btn')) {
    e.stopPropagation(); // prevent auto-close
    const docId = e.target.dataset.docId;
    const menu = document.getElementById(`menu-${docId}`);
    if (menu) {
      menu.classList.toggle('hidden');
    }
  }

  if (e.target.classList.contains('ellipsis-btn')) {
    e.stopPropagation();
    const isFolder = e.target.dataset.menuType === 'folder';
    const id = isFolder ? e.target.dataset.folderId : e.target.dataset.docId;
    const menuId = isFolder ? `folder-menu-${id}` : `menu-${id}`;
    const menu = document.getElementById(menuId);
  
    if (menu) {
      // Close all others first
      document.querySelectorAll('.file-menu').forEach(m => m.classList.add('hidden'));
      menu.classList.remove('hidden');
  
      // Lock state to prevent premature hide
      let inside = true;
  
      // When mouse enters, set inside = true
      menu.addEventListener('pointerenter', () => {
        inside = true;
      });
  
      // When mouse leaves, set inside = false
      menu.addEventListener('pointerleave', () => {
        inside = false;
        setTimeout(() => {
          if (!inside) menu.classList.add('hidden');
        }, 150); // short delay to allow moving between button and menu
      });
  
      // Also check button
      e.target.addEventListener('pointerleave', () => {
        setTimeout(() => {
          if (!inside) menu.classList.add('hidden');
        }, 150);
      });
    }
  
    return;
  }
  
    if (e.target.classList.contains('edit-btn')) {
        const docId = e.target.dataset.docId;
        const title = e.target.dataset.title || 'Untitled';
        const description = e.target.dataset.description || '';
        const tags = e.target.dataset.tags || '';
        const category = e.target.dataset.category || 'general';
        openEditModal(docId, title, description, tags, category);
    } else if (e.target.classList.contains('rename-folder-btn')) {
        const folderId = e.target.dataset.folderId;
        const currentName = e.target.dataset.currentName || '';
        openRenameFolderModal(folderId, currentName);
    } else if (e.target.classList.contains('delete-btn')) {
        const docId = e.target.dataset.docId;
        const blobUrl = e.target.dataset.blobName;
        if (confirm('Are you sure you want to permanently delete this file?')) {
            try {
                await deleteFile(docId, blobUrl);
            } catch (error) {
                alert('Error deleting file: ' + error.message);
            }
        }
    } else if (e.target.classList.contains('delete-folder-btn')) {
        e.stopPropagation(); // Prevent event from bubbling to folder-card
        const folderId = e.target.dataset.folderId;
        if (confirm('Are you sure you want to delete this folder and all its contents?')) {
            try {
                await deleteFolder(folderId, auth.currentUser.uid);
            } catch (error) {
                alert('Error deleting folder: ' + error.message);
            }
        }
    } else if (e.target.classList.contains('breadcrumb')) {
        const path = e.target.dataset.path || '';
        navigateToDirectory(path);
    } else if (e.target.classList.contains('move-btn')) {
        const docId = e.target.dataset.docId;
        const currentPath = e.target.dataset.currentPath || '';
        openMoveModal(docId, currentPath);
    } else if (e.target.closest('.folder-card')) {
        const folderCard = e.target.closest('.folder-card');
        // Only navigate if the click wasn't on a button inside the folder card
        if (!e.target.closest('.folder-actions')) {
            const path = folderCard.dataset.path;
            navigateToDirectory(path);
        }
    }
});

  // Create folder button
  const createFolderBtn = document.getElementById('create-folder-btn');
  if (createFolderBtn) {
    createFolderBtn.addEventListener('click', () => {
      document.getElementById('folder-modal').style.display = 'block';
    });
  }

  // Upload file button
  const uploadFileBtn = document.getElementById('upload-file-btn');
  if (uploadFileBtn) {
    uploadFileBtn.addEventListener('click', () => {
      setUploadPath(currentPath); // <-- pass in the current folder path
      document.getElementById('upload-modal').style.display = 'flex';
    });
  }

  // Move form submission
  const moveForm = document.getElementById('move-form');
  if (moveForm) {
    moveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const docId = moveForm.dataset.docId;
      const targetPath = document.getElementById('target-folder').value;
      await moveFile(docId, targetPath);
    });
  }

  // Cancel move button
  const cancelMoveBtn = document.getElementById('cancel-move');
  if (cancelMoveBtn) {
    cancelMoveBtn.addEventListener('click', closeMoveModal);
  }

  // Handle file selection
  fileInput.addEventListener('change', async () => {
    if (fileInput.files.length > 0) {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        alert('Please sign in to upload files.');
        return;
      }
      await handleFileUpload(fileInput.files, userId);
    }
  });

  // Folder form submission
  const folderForm = document.getElementById('folder-form');
  if (folderForm) {
    folderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const folderName = document.getElementById('folder-name').value.trim();
      if (folderName) {
        await createFolder(folderName, auth.currentUser.uid);
        document.getElementById('folder-name').value = '';
        document.getElementById('folder-modal').style.display = 'none';
      }
    });
  }

  // Cancel folder creation
  const cancelFolderBtn = document.getElementById('cancel-folder');
  if (cancelFolderBtn) {
    cancelFolderBtn.addEventListener('click', () => {
      document.getElementById('folder-name').value = '';
      document.getElementById('folder-modal').style.display = 'none';
    });
  }

  // Rename folder form submission
  const renameFolderForm = document.getElementById('rename-folder-form');
  if (renameFolderForm) {
    renameFolderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const folderId = renameFolderForm.dataset.folderId;
      const newName = document.getElementById('new-folder-name').value.trim();
      if (newName) {
        await renameFolder(folderId, newName);
      }
    });
  }

  // Cancel rename folder button
  const cancelRenameBtn = document.getElementById('cancel-rename-folder');
  if (cancelRenameBtn) {
    cancelRenameBtn.addEventListener('click', closeRenameFolderModal);
  }

  // Edit form submission
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

  // Close edit modal on cancel
  const cancelBtn = document.getElementById('cancel-edit');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeEditModal);
  }
}

function initializeFileDisplay() {
  const container = document.getElementById('files-container');
  // Instead of replacing everything, just make sure the files-list section exists
  // Only create the files-list if it doesn't exist already
  let filesList = document.getElementById('files-list');
  if (!filesList) {
    filesList = document.createElement('section');
    filesList.id = 'files-list';
    container.appendChild(filesList);
  }
  return filesList;
}

async function displayFiles(userId) {
  const filesList = initializeFileDisplay();
  const breadcrumbs = document.getElementById('directory-breadcrumbs');
  if (!filesList || !breadcrumbs) {
    console.error("Required elements not found");
    return;
  }

  try {
    filesList.innerHTML = '<section class="file-card">Loading...</section>';
    
    // Update breadcrumbs
    updateBreadcrumbs();
    
    // Query for folders in current path
    const foldersQuery = query(
      collection(db, "folders"),
      where("ownerId", "==", userId),
      where("path", "==", currentPath)
    );
    
    const foldersSnapshot = await getDocs(foldersQuery);
    
    // Query for files in current path
    const filesQuery = query(
      collection(db, "archiveItems"), 
      where("uploadedBy", "==", userId),
      where("path", "==", currentPath || "")
    );
    
    const filesSnapshot = await getDocs(filesQuery);
    
    filesList.innerHTML = '';

    if (foldersSnapshot.empty && filesSnapshot.empty) {
      filesList.innerHTML = '<p class="empty-message">This folder is empty</p>';
      return;
    }

    const groupCard = document.createElement('section');
    groupCard.className = 'file-group-card';
    groupCard.style.background = 'white';
    groupCard.style.borderRadius = '8px';
    groupCard.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    groupCard.style.padding = '1rem';
    groupCard.style.marginBottom = '1.5rem';
    groupCard.style.display = 'flex';
    groupCard.style.flexDirection = 'column';
    groupCard.style.gap = '0';

    // Display folders first
    foldersSnapshot.forEach((doc) => {
      const folder = doc.data();
      const folderCard = document.createElement('section');
      folderCard.className = 'folder-card';
      folderCard.dataset.path = folder.fullPath;
      folderCard.innerHTML = `
        <section class="file-folder-row">
          <P class="icon">${fileIcons.folder}</P>
          <P class="name">${folder.name}</P>
          <p class="created">${formatDate(folder.createdAt?.toDate())}</p>
          <p class="size">${formatFileSize(folder.size)}</p>
          <button class="ellipsis-btn" data-folder-id="${doc.id}" data-menu-type="folder">⋯</button>

          <section class="folder-actions">
            <section class="file-menu hidden" id="folder-menu-${doc.id}">
              <button class="rename-folder-btn" data-folder-id="${doc.id}" data-current-name="${folder.name}">Rename</button>
              <button class="delete-folder-btn" data-folder-id="${doc.id}">Delete</button>
    </section>
          </section>
        </section>
      `;
    
      groupCard.appendChild(folderCard);
    });

    // Then display files
    filesSnapshot.forEach((doc) => {
      const file = doc.data();
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
            <section class="file-folder-row">
              <p class="icon">${fileIcon}</p>
              <p class="name">${file.metadata?.title || file.name || 'Untitled'}</p>
              <p class="created">${formatDate(file.uploadedAt?.toDate())}</p>
              <p class="size">${formatFileSize(file.size)}</p>
              <button class="ellipsis-btn" data-doc-id="${doc.id}">⋯</button>
          
              <section class="file-actions">
              <section class="file-menu hidden" id="menu-${doc.id}">
                <a href="${file.url}" target="_blank">View</a>
                <a href="${file.url}" download="${file.name || 'download'}">Download</a>
                <button class="edit-btn" 
                  data-doc-id="${doc.id}" 
                  data-title="${file.metadata?.title || file.name || 'Untitled'}"
                  data-description="${file.metadata?.description || ''}"
                  data-tags="${file.metadata?.tags?.join(', ') || ''}"
                  data-category="${file.metadata?.category || 'general'}">Edit</button>
                <button class="move-btn" 
                  data-doc-id="${doc.id}"
                  data-current-path="${file.path || ''}">Move</button>
                <button class="delete-btn" data-doc-id="${doc.id}" data-blob-name="${file.url}">Delete</button>
              </section>
            </section>
          </section>
        `;
        groupCard.appendChild(card);
      }).catch(error => {
        console.error("Error testing URL:", error);
      });
    });

    filesList.appendChild(groupCard);

  } catch (error) {
    console.error("Error loading files:", error);
    filesList.innerHTML = 
      '<p class="error-message">Error loading files. Please check console for details.</p>';
  }
}

function updateBreadcrumbs() {
  const breadcrumbs = document.getElementById('directory-breadcrumbs');
  if (!breadcrumbs) return;

  // Clear existing breadcrumbs except Home
  while (breadcrumbs.children.length > 1) {
    breadcrumbs.removeChild(breadcrumbs.lastChild);
  }

  // Parse current path and build breadcrumbs
  currentPathArray = currentPath ? currentPath.split('/').filter(Boolean) : [];
  
  let accumulatedPath = '';
  currentPathArray.forEach((folder, index) => {
    accumulatedPath += `${folder}/`;
    const breadcrumb = document.createElement('button');
    breadcrumb.className = 'breadcrumb';
    breadcrumb.dataset.path = accumulatedPath;
    breadcrumb.textContent = folder;
    breadcrumbs.appendChild(breadcrumb);
  });
}

function navigateToDirectory(path) {
  currentPath = path;
  const user = auth.currentUser;
  if (user) {
    displayFiles(user.uid);
  }
}

async function createFolder(folderName, userId) {
  try {
    const fullPath = currentPath ? `${currentPath}${folderName}/` : `${folderName}/`;
    
    await addDoc(collection(db, "folders"), {
      name: folderName,
      path: currentPath || "",
      fullPath: fullPath,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Refresh the view
    displayFiles(userId);
  } catch (error) {
    console.error("Error creating folder:", error);
    alert("Failed to create folder. Please try again.");
  }
}

async function handleFileUpload(files, userId) {
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = detectFileType(file);
      const fileSize = formatFileSize(file.size);
      const lastModified = new Date(file.lastModified).toLocaleString();
      
      // Generate unique filename with current path
      const pathPrefix = currentPath ? `${userId}/${currentPath}` : `${userId}/`;
      const uniqueFileName = `${pathPrefix}${new Date().getTime()}-${file.name}`;
      
      // Get SAS URL
      const sasUrl = await getSasUrl(uniqueFileName);
      
      // Upload to Azure
      await uploadToAzure(file, sasUrl, {
        title: file.name,
        description: '',
        tags: '',
        category: 'general'
      });
      
      const fileUrl = sasUrl.split('?')[0];
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, "archiveItems"), {
        name: file.name,
        type: fileType,
        size: file.size,
        url: fileUrl,
        lastModified: lastModified,
        uploadedBy: userId,
        uploadedAt: serverTimestamp(),
        path: currentPath,
        metadata: {
          title: file.name,
          description: '',
          tags: [],
          category: 'general'
        },
        status: 'active',
        views: 0,
        downloads: 0
      });

      // Update the user's document
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        uploads: arrayUnion({
          itemId: docRef.id,
          name: file.name,
          type: fileType,
          uploadedAt: new Date().toISOString(),
          url: fileUrl
        }),
        lastUpload: serverTimestamp()
      });
    }
    
    // Refresh the file list
    displayFiles(userId);
    alert('Files uploaded successfully!');
    fileInput.value = ''; // Clear the file input
  } catch (error) {
    console.error('Error uploading files:', error);
    alert('Error uploading files: ' + error.message);
  }
}

async function uploadToAzure(file, sasUrl, metadata) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        console.log(`Upload progress: ${percent}%`);
      }
    };

    xhr.onload = () => {
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));

    xhr.open('PUT', sasUrl, true);
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    
    // Add metadata headers
    xhr.setRequestHeader('x-ms-meta-title', metadata.title);
    xhr.setRequestHeader('x-ms-meta-description', metadata.description);
    xhr.setRequestHeader('x-ms-meta-tags', metadata.tags);
    xhr.setRequestHeader('x-ms-meta-category', metadata.category);
    
    xhr.send(file);
  });
}

async function getSasUrl(blobName) {
  try {
    console.log('Requesting SAS URL for blob:', blobName);
    
    const response = await fetch('https://scriptorium.azurewebsites.net/api/get-sas-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ blobName }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Server returned an error');
    }

    const data = await response.json();
    
    if (!data.sasUrl) {
      throw new Error('Server did not return a valid SAS URL');
    }

    console.log('Received SAS URL:', data.sasUrl);
    return data.sasUrl;
  } catch (error) {
    console.error('Error in getSasUrl:', error);
    throw new Error(`Failed to get SAS URL: ${error.message}`);
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

// Open move modal
function openMoveModal(docId, currentPath) {
  const modal = document.getElementById('move-modal');
  const form = document.getElementById('move-form');
  const currentFolderDisplay = document.getElementById('current-folder');
  const folderSelect = document.getElementById('target-folder');

  if (modal && form && currentFolderDisplay && folderSelect) {
    form.dataset.docId = docId;
    currentFolderDisplay.textContent = currentPath || 'Root';
    
    // Clear existing options
    folderSelect.innerHTML = '<option value="" selected> Home (Root Folder)</option>';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '';
    folderSelect.appendChild(defaultOption);
    
    // Load available folders
    loadAvailableFolders(auth.currentUser.uid, folderSelect);
    
    modal.style.display = 'block';
  }
}

async function loadAvailableFolders(userId, selectElement) {
  try {
    selectElement.innerHTML = '<option value="">Home (Root Folder)</option>';

    // Then add other folders
    const foldersQuery = query(
      collection(db, "folders"),
      where("ownerId", "==", userId)
    );
    
    const foldersSnapshot = await getDocs(foldersQuery);
    
    foldersSnapshot.forEach((doc) => {
      const folder = doc.data();
      const option = document.createElement('option');
      option.value = folder.fullPath;
      option.textContent = folder.name;
      selectElement.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading folders:", error);
  }
}

function closeMoveModal() {
  const modal = document.getElementById('move-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function moveFile(docId, targetPath) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const docRef = doc(db, "archiveItems", docId);

    // Explicitly handle root folder case (empty string or null)
    const newPath = targetPath === "" ? "" : targetPath || "";
    await updateDoc(docRef, {
      path: newPath || ''
    });
    
    // Refresh the file list
    displayFiles(user.uid);
    closeMoveModal();
    alert('File moved successfully!');
  } catch (error) {
    console.error("Error moving file:", error);
    alert("Failed to move file. Please try again.");
  }
}

// Open rename folder modal
function openRenameFolderModal(folderId, currentName) {
  const modal = document.getElementById('rename-folder-modal');
  const form = document.getElementById('rename-folder-form');
  const nameInput = document.getElementById('new-folder-name');

  if (modal && form && nameInput) {
    form.dataset.folderId = folderId;
    nameInput.value = currentName;
    modal.style.display = 'block';
  }
}

// Close rename folder modal
function closeRenameFolderModal() {
  const modal = document.getElementById('rename-folder-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Rename folder function
async function renameFolder(folderId, newName) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const folderRef = doc(db, "folders", folderId);
    const folderDoc = await getDoc(folderRef);
    
    if (!folderDoc.exists()) {
      throw new Error("Folder not found");
    }

    const folderData = folderDoc.data();
    const oldName = folderData.name;
    const oldPath = folderData.fullPath;
    
    // Calculate new full path
    const newFullPath = folderData.path + newName + '/';
    
    // First update the folder itself
    await updateDoc(folderRef, {
      name: newName,
      fullPath: newFullPath,
      updatedAt: serverTimestamp()
    });

    // Then update all files in this folder
    const filesQuery = query(
      collection(db, "archiveItems"),
      where("uploadedBy", "==", user.uid),
      where("path", "==", oldPath)
    );
    
    const filesSnapshot = await getDocs(filesQuery);
    const fileUpdates = [];
    filesSnapshot.forEach((doc) => {
      fileUpdates.push(updateDoc(doc.ref, {
        path: newFullPath
      }));
    });
    await Promise.all(fileUpdates);

    // Then update all subfolders in this folder
    const foldersQuery = query(
      collection(db, "folders"),
      where("ownerId", "==", user.uid),
      where("path", "==", oldPath)
    );
    
    const foldersSnapshot = await getDocs(foldersQuery);
    const folderUpdates = [];
    foldersSnapshot.forEach((doc) => {
      const subfolderData = doc.data();
      const newSubfolderPath = newFullPath + subfolderData.name + '/';
      folderUpdates.push(updateDoc(doc.ref, {
        path: newFullPath,
        fullPath: newSubfolderPath
      }));
    });
    await Promise.all(folderUpdates);

    // Update current path if we're inside the renamed folder
    if (currentPath.startsWith(oldPath)) {
      currentPath = currentPath.replace(oldPath, newFullPath);
      currentPathArray = currentPath ? currentPath.split('/').filter(Boolean) : [];
    }
    
    // Refresh the view
    displayFiles(user.uid);
    closeRenameFolderModal();
    alert('Folder renamed successfully!');
  } catch (error) {
    console.error("Error renaming folder:", error);
    alert("Failed to rename folder. Please try again.");
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
  const user = auth.currentUser;
  if (!user) return;

  try {
    // First get the file document to ensure we have all needed data
    const docRef = doc(db, "archiveItems", docId);
    const docSnapshot = await getDoc(docRef);
    
    if (!docSnapshot.exists()) {
      throw new Error("File not found");
    }
    
    const fileData = docSnapshot.data();
    
    // Delete from Azure Blob Storage if URL exists
    if (fileData.url) {
      try {
        const response = await fetch('/api/delete-blob', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            blobName: fileData.url.split('/').pop() // Extract blob name from URL
          }) 
        });
        
        if (!response.ok) {
          console.error("Blob deletion failed:", await response.text());
          // Continue with Firestore deletion even if blob deletion fails
        }
      } catch (error) {
        console.error("Error deleting blob:", error);
        // Continue with Firestore deletion
      }
    }

    // Delete related Firestore documents
    await deleteDoc(docRef);
    
    // Delete from searchIndex
    const searchQuery = query(
      collection(db, "searchIndex"),
      where("itemId", "==", docId)
    );
    const searchSnapshot = await getDocs(searchQuery);
    const searchDeletions = [];
    searchSnapshot.forEach((searchDoc) => {
      searchDeletions.push(deleteDoc(doc(db, "searchIndex", searchDoc.id)));
    });
    
    // Delete from archiveCollections
    const collectionQuery = query(
      collection(db, "archiveCollections"),
      where("itemId", "==", docId)
    );
    const collectionSnapshot = await getDocs(collectionQuery);
    const collectionDeletions = [];
    collectionSnapshot.forEach((collDoc) => {
      collectionDeletions.push(deleteDoc(doc(db, "archiveCollections", collDoc.id)));
    });
    
    // Wait for all deletions to complete
    await Promise.all([...searchDeletions, ...collectionDeletions]);

    // Remove from user's uploads
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const uploads = userDoc.data().uploads || [];
      const updatedUploads = uploads.filter(upload => upload.itemId !== docId);
      await updateDoc(userRef, { uploads: updatedUploads });
    }

    // Refresh the file list
    displayFiles(user.uid);
    alert('File deleted successfully!');
  } catch (error) {
    console.error("Error deleting file:", error);
    alert("Failed to delete file. Please try again.");
  }
}

// Delete folder
async function deleteFolder(folderId, userId) {
  if (!confirm('Are you sure you want to delete this folder and all its contents?')) {
    return;
  }

  try {
    const folderRef = doc(db, "folders", folderId);
    const folderDoc = await getDoc(folderRef);
    
    if (!folderDoc.exists()) {
      throw new Error("Folder not found");
    }

    const folderData = folderDoc.data();
    const folderPath = folderData.fullPath;

    // 1. First delete all files in this folder
    const filesQuery = query(
      collection(db, "archiveItems"),
      where("uploadedBy", "==", userId),
      where("path", "==", folderPath)
    );
    
    const filesSnapshot = await getDocs(filesQuery);
    const fileDeletions = [];
    filesSnapshot.forEach((fileDoc) => {
      fileDeletions.push(deleteFile(fileDoc.id, fileDoc.data().url));
    });
    await Promise.all(fileDeletions);

    // 2. Delete all subfolders recursively
    const subfoldersQuery = query(
      collection(db, "folders"),
      where("ownerId", "==", userId),
      where("path", "==", folderPath)
    );
    
    const subfoldersSnapshot = await getDocs(subfoldersQuery);
    const folderDeletions = [];
    subfoldersSnapshot.forEach((subfolderDoc) => {
      folderDeletions.push(deleteFolder(subfolderDoc.id, userId));
    });
    await Promise.all(folderDeletions);

    // 3. Finally delete the folder itself
    await deleteDoc(folderRef);
    
    // Refresh the view
    displayFiles(userId);
    alert('Folder and all contents deleted successfully!');
  } catch (error) {
    console.error("Error deleting folder:", error);
    alert("Failed to delete folder. Please try again.");
  }
}