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
        folder: '<img src="images/icons/folder (1).png" alt="Folder Icon" class="file-icon">',
        default: '<img src="images/icons/default.png" alt="Default Icon" class="file-icon">'
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
  if (typeof bytes !== 'number') return ' ';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}
export function formatFileType(type) {
  const typeMap = {
    'image': 'Image File',
    'video': 'Video File',
    'audio': 'Audio File',
    'pdf': 'PDF Document',
    'document': 'Document',
    'spreadsheet': 'Spreadsheet',
    'presentation': 'Presentation',
    'archive': 'Archive',
    'code': 'Code File',
    'folder': 'Folder',
    'default': 'File'
  };
  if (type.includes('pdf')) return 'PDF Document';
  if (type.includes('jpg') || type.includes('jpeg') || type.includes('png')) return 'Image File';
  if (type.includes('doc') || type.includes('docx')) return 'Word Document';
  if (type.includes('xls') || type.includes('xlsx')) return 'Excel Spreadsheet';
  if (type.includes('ppt') || type.includes('pptx')) return 'PowerPoint Presentation';
  
  return typeMap[type] || typeMap['default'];
}
export function detectFileType(file) {
  const type = file.type ? file.type.toLowerCase() : '';
  const name = file.name ? file.name.toLowerCase() : '';
  if (type.includes('image') || 
  ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => name.endsWith(ext))) {
return 'image';
}
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


export function getFileIcon(type) {
  return fileIcons[type] || fileIcons.default;
}

export function formatDate(date) {
  if (!date) return 'Unknown date';
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'numeric',
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

// Global variables to manage the active menu and its close timeout
let activeMenu = null; // Stores the currently open menu element
let menuCloseTimeout = null; // Stores the ID of the timeout for closing the menu

// Helper function to close all menus
function closeAllMenus() {
    document.querySelectorAll('.file-menu, .folder-menu').forEach(menu => {
        menu.classList.add('hidden');
        const openedByButton = document.querySelector(`[aria-expanded="true"][aria-controls="${menu.id}"]`);
        if (openedByButton) {
            openedByButton.setAttribute('aria-expanded', 'false');
        }
    });
    activeMenu = null; // Clear the active menu
    if (menuCloseTimeout) { // Clear any pending close timeout
        clearTimeout(menuCloseTimeout);
        menuCloseTimeout = null;
    }
}

function setupEventListeners(userId) {

    // --- Core Event Listeners ---

    // 1. Handle Click to Open and General Clicks to Close
    document.addEventListener('click', async (e) => {
        const ellipsisBtn = e.target.closest('.ellipsis-btn'); // Use closest to account for child elements

        // If a click is on an ellipsis button
        if (ellipsisBtn) {
            e.preventDefault();
            e.stopPropagation(); // Stop propagation to prevent document click from closing

            const isFolder = ellipsisBtn.hasAttribute('data-folder-id');
            const id = isFolder ? ellipsisBtn.dataset.folderId : ellipsisBtn.dataset.docId;
            const menuId = isFolder ? `folder-menu-${id}` : `menu-${id}`;
            const menu = document.getElementById(menuId);

            if (menu) {
                // Clear any pending close timeout immediately
                if (menuCloseTimeout) {
                    clearTimeout(menuCloseTimeout);
                    menuCloseTimeout = null;
                }

                // Close all other menus, but only if they are not the target menu
                document.querySelectorAll('.file-menu, .folder-menu').forEach(m => {
                    if (m.id !== menuId) {
                        m.classList.add('hidden');
                        const otherBtn = document.querySelector(`[aria-controls="${m.id}"]`);
                        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
                    }
                });

                // Toggle visibility of the current menu
                menu.classList.toggle('hidden');
                const isHidden = menu.classList.contains('hidden');

                // Set/unset active menu
                activeMenu = isHidden ? null : menu;

                // Update ARIA attributes
                ellipsisBtn.setAttribute('aria-expanded', String(!isHidden));
                ellipsisBtn.setAttribute('aria-controls', menuId); // Link button to menu

                // Position the menu only if it's being shown
                if (!isHidden) {
                    const btnRect = ellipsisBtn.getBoundingClientRect();
                    let topPos = btnRect.bottom + window.scrollY;
                    let leftPos = btnRect.left + window.scrollX;

                    // Dynamic left positioning to keep menu in viewport
                    const menuWidth = menu.offsetWidth;
                    const viewportWidth = window.innerWidth;
                    if (leftPos + menuWidth > viewportWidth - 10) {
                         leftPos = viewportWidth - menuWidth - 10;
                    }
                    if (leftPos < 10) {
                        leftPos = 10;
                    }

                    menu.style.top = `${topPos}px`;
                    menu.style.left = `${leftPos}px`;
                }
            }
            return; // Important: Exit function after handling ellipsis click
        }

        // If click is not on an ellipsis button, and not inside an active menu, close all menus
        // This handles clicks anywhere else on the document to close menus.
        if (activeMenu && !activeMenu.contains(e.target)) {
            closeAllMenus();
        }
    });

    // 2. Handle Mouseenter (Hovering over ellipsis button or open menu)
    document.addEventListener('mouseenter', (e) => {
        // If mouse enters an ellipsis button that *might* open a menu
        if (e.target.classList.contains('ellipsis-btn')) {
            // If there's a pending close timeout, clear it.
            // This prevents a menu from closing if you briefly move off and then back on its button.
            if (menuCloseTimeout) {
                clearTimeout(menuCloseTimeout);
                menuCloseTimeout = null;
            }
            // We only open on click, so no further action here on mouseenter for button
        }
        // If mouse enters an already active/open menu
        else if (activeMenu && (activeMenu === e.target || activeMenu.contains(e.target))) {
            // If there's a pending close timeout for this menu, clear it.
            // This keeps the menu open as long as the mouse is over it.
            if (menuCloseTimeout) {
                clearTimeout(menuCloseTimeout);
                menuCloseTimeout = null;
            }
        }
    }, true); // Use capture phase

    // 3. Handle Mouseleave (Hovering away from ellipsis button or active menu)
    document.addEventListener('mouseleave', (e) => {
        const targetElement = e.target;
        const relatedTarget = e.relatedTarget; // The element the mouse is moving to

        // Check if leaving an ellipsis button
        if (targetElement.classList.contains('ellipsis-btn')) {
            const isFolder = targetElement.hasAttribute('data-folder-id');
            const id = isFolder ? targetElement.dataset.folderId : targetElement.dataset.docId;
            const menuId = isFolder ? `folder-menu-${id}` : `menu-${id}`;
            const menu = document.getElementById(menuId);

            // If a menu is open and we're leaving the button
            if (menu && !menu.classList.contains('hidden')) {
                // If the mouse is moving from the button *into* the associated menu, don't close
                if (menu.contains(relatedTarget)) {
                    return;
                }
                // Otherwise, set a timeout to close the menu
                menuCloseTimeout = setTimeout(() => {
                    // Only close if the mouse is truly outside both the button and the menu
                    // Use a more robust check involving elementFromPoint or checking if relatedTarget is still outside
                    const currentTarget = document.elementFromPoint(e.clientX, e.clientY);
                    if (!ellipsisBtn.contains(currentTarget) && !menu.contains(currentTarget)) {
                        closeAllMenus(); // Use the general close function
                    }
                }, 200); // 200ms delay to allow moving to menu
            }
        }
        // Check if leaving an active menu itself
        else if (activeMenu && (targetElement === activeMenu || activeMenu.contains(targetElement))) {
            // If the mouse is moving from the menu *into* its associated ellipsis button, don't close
            const associatedEllipsisBtn = document.querySelector(`[aria-controls="${activeMenu.id}"]`);
            if (associatedEllipsisBtn && associatedEllipsisBtn.contains(relatedTarget)) {
                return;
            }

            // Otherwise, set a timeout to close the menu
            menuCloseTimeout = setTimeout(() => {
                // Only close if the mouse is truly outside the menu (and its button)
                const currentTarget = document.elementFromPoint(e.clientX, e.clientY);
                if (!activeMenu.contains(currentTarget) && !(associatedEllipsisBtn && associatedEllipsisBtn.contains(currentTarget))) {
                     closeAllMenus(); // Use the general close function
                }
            }, 200); // 200ms delay
        }
    }, true); // Use capture phase for reliability

    // --- Rest of your event listeners (actions, modals, etc.) ---
    // These remain the same, ensure `closeAllMenus()` is called after an action.

    // Example for `edit-button`
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-button')) {
            closeAllMenus(); // Close the menu immediately after clicking an action
            const docId = e.target.dataset.docId;
            const title = e.target.dataset.title || 'Untitled';
            const description = e.target.dataset.description || '';
            const tags = e.target.dataset.tags || '';
            const category = e.target.dataset.category || 'general';
            openEditModal(docId, title, description, tags, category);
        }
        // ... (other action buttons like rename-folder-btn, delete-btn, etc.)
        else if (e.target.classList.contains('rename-folder-btn')) {
            closeAllMenus();
            const folderId = e.target.dataset.folderId;
            const currentName = e.target.dataset.currentName || '';
            openRenameFolderModal(folderId, currentName);
        } else if (e.target.classList.contains('delete-btn')) {
            closeAllMenus();
            const docId = e.target.dataset.docId;
            const blobUrl = e.target.dataset.blobName;
            if (confirm('Are you sure you want to permanently delete this file?')) {
                try {
                    // Assuming deleteFile is an async function
                    deleteFile(docId, blobUrl);
                } catch (error) {
                    alert('Error deleting file: ' + error.message);
                }
            }
        } else if (e.target.classList.contains('delete-folder-btn')) {
            closeAllMenus();
            e.stopPropagation();
            const folderId = e.target.dataset.folderId;
            if (confirm('Are you sure you want to delete this folder and all its contents?')) {
                try {
                    // Assuming deleteFolder is an async function
                    deleteFolder(folderId, auth.currentUser.uid);
                } catch (error) {
                    alert('Error deleting folder: ' + error.message);
                }
            }
        } else if (e.target.classList.contains('breadcrumb')) {
            closeAllMenus();
            const path = e.target.dataset.path || '';
            navigateToDirectory(path);
        } else if (e.target.classList.contains('move-btn')) {
            closeAllMenus();
            const docId = e.target.dataset.docId;
            const currentPath = e.target.dataset.currentPath || '';
            openMoveModal(docId, currentPath);
        } else if (e.target.closest('.folder-card')) {
            const folderCard = e.target.closest('.folder-card');
            if (!e.target.closest('.folder-actions') && !e.target.classList.contains('ellipsis-btn')) {
                closeAllMenus();
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
            closeMoveModal();
        });
    }

    // Cancel move button
    const cancelMoveBtn = document.getElementById('cancel-move');
    if (cancelMoveBtn) {
        cancelMoveBtn.addEventListener('click', closeMoveModal);
    }

    // Handle file selection
    // Ensure fileInput is defined in the scope or passed
    // e.g., const fileInput = document.getElementById('file-input');
    if (typeof fileInput !== 'undefined' && fileInput) {
        fileInput.addEventListener('change', async () => {
            if (fileInput.files.length > 0) {
                const user = auth.currentUser;
                if (!user) {
                    alert('Please sign in to upload files.');
                    return;
                }
                await handleFileUpload(fileInput.files, user.uid);
            }
        });
    }

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
                closeRenameFolderModal();
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
            await updateFileMetadata(docId, {
                title,
                description,
                tags,
                category
            });
            closeEditModal();
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
      // In displayFiles() where folders are created:
      folderCard.innerHTML = `
        <section class="file-folder-row">
          <section class="icon">${fileIcons.folder}</section>
          <section class="name">${folder.name}</section>
          <section class="type">Folder</section>
          <section class="created">${formatDate(folder.createdAt?.toDate())}</section>
          <section class="size">-</section>
          <section class="actions">
            <button class="ellipsis-btn" data-folder-id="${doc.id}">⋯</button>
          </section>
        </section>
      `;

      // And the folder menu creation:
      const folderMenu = document.createElement('section');
      folderMenu.className = 'folder-menu hidden';
      folderMenu.id = `folder-menu-${doc.id}`;
      folderMenu.innerHTML = `
        <button class="rename-folder-btn" data-folder-id="${doc.id}" data-current-name="${folder.name}">
          <img src="images/icons/rename.png" class="menu-icon" alt="Rename"> Rename
        </button>
        <button class="delete-folder-btn" data-folder-id="${doc.id}">
          <img src="images/icons/delete.png" class="menu-icon" alt="Delete"> Delete
        </button>
      `;
      document.body.appendChild(folderMenu);
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
        
        // In the displayFiles function, modify the file card HTML generation:
        const card = document.createElement('section');
        card.className = 'file-card';
        card.innerHTML = `
            <section class="file-folder-row">
              <section class="icon">${fileIcon}</section>
              <section class="name">${file.metadata?.title || file.name || 'Untitled'}</section>
              <section class="type">${formatFileType(file.type)}</section>
              <section class="created">${formatDate(file.uploadedAt?.toDate())}</section>
              <section class="size">${formatFileSize(file.size)}</section>
              <section class="actions">
                <button class="ellipsis-btn" data-doc-id="${doc.id}">⋯</button>
              </section>
            </section>
        `;

        // Create menu separately and append to body
        const menu = document.createElement('section');
        menu.className = 'file-menu hidden';
        menu.id = `menu-${doc.id}`;
        menu.innerHTML = `
          <button class="view-btn" onclick="window.open('${file.url}', '_blank')">
            <img src="images/icons/view.png" class="menu-icon" alt="View"> View
          </button>
          <button class="download-btn" onclick="window.location.href='${file.url}'">
            <img src="images/icons/download.png" class="menu-icon" alt="Download"> Download
          </button>
          <button class="move-btn" 
            data-doc-id="${doc.id}"
            data-current-path="${file.path || ''}">
            <img src="images/icons/move.png" class="menu-icon" alt="Move"> Move
          </button>
          <button class="edit-button" 
            data-doc-id="${doc.id}" 
            data-title="${file.metadata?.title || file.name || 'Untitled'}"
            data-description="${file.metadata?.description || ''}"
            data-tags="${file.metadata?.tags?.join(', ') || ''}"
            data-category="${file.metadata?.category || 'general'}">
            <img src="images/icons/edit.png" class="menu-icon" alt="Edit"> Edit
          </button>
          <button class="delete-btn" data-doc-id="${doc.id}" data-blob-name="${file.url}">
            <img src="images/icons/delete.png" class="menu-icon" alt="Delete"> Delete
          </button>
        `;
        document.body.appendChild(menu);
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

  // Reset Home breadcrumb styling
  const homeBtn = breadcrumbs.querySelector('.breadcrumb');
  homeBtn.classList.remove('active');

  if (currentPathArray.length === 0) {
    homeBtn.classList.add('active');
  }
  
  let accumulatedPath = '';
  currentPathArray.forEach((folder, index) => {
    accumulatedPath += `${folder}/`;
    const breadcrumb = document.createElement('button');
    breadcrumb.className = 'breadcrumb';
    breadcrumb.dataset.path = accumulatedPath;
    breadcrumb.textContent = folder;

    if (index === currentPathArray.length - 1) {
  breadcrumb.classList.add('active');
    }
    breadcrumbs.appendChild(breadcrumb);

  });
}

function navigateToDirectory(path) {
  // Close any open menus
  document.querySelectorAll('.file-menu, .folder-menu').forEach(menu => {
    menu.classList.add('hidden');
  });
  
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

export async function uploadToAzure(file, sasUrl, metadata) {
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
    const folders = [];
    
    foldersSnapshot.forEach((doc) => {
      const folder = doc.data();
      folders.push({
        name: folder.name,
        path: folder.fullPath,
        depth: folder.fullPath.split('/').filter(Boolean).length - 1
      });
    });

    // Sort by path to keep hierarchy order
    folders.sort((a, b) => a.path.localeCompare(b.path));

    folders.forEach((folder) => {
      const option = document.createElement('option');
      // Create tree-like indentation using Unicode tree characters
      let treePrefix = '';
      for (let i = 0; i < folder.depth; i++) {
        treePrefix += (i === folder.depth - 1) ? '├── ' : '│   ';
      }
      option.value = folder.path;
      option.innerHTML = `${treePrefix}${folder.name}`;
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