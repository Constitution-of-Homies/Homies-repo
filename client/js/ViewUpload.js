import { db, auth } from './firebase.js';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, serverTimestamp, arrayUnion } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';

let currentPath = '';
let currentPathArray = [];

const fileIcons = {
  pdf: '📕',
  image: '🖼️',
  video: '🎥',
  audio: '🎵',
  document: '📄',
  spreadsheet: '📊',
  presentation: '📈',
  code: '💻',
  archive: '🗜️',
  default: '📎',
};

function formatDate(date) {
  return date ? date.toLocaleString() : 'Unknown';
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function getSimplifiedType(mimeType) {
  if (!mimeType) return 'default';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('video')) return 'video';
  if (mimeType.includes('audio')) return 'audio';
  if (mimeType.includes('msword') || mimeType.includes('wordprocessingml')) return 'document';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('python')) return 'code';
  return 'default';
}

function detectFileType(file) {
  return file.type || getSimplifiedType(file.name.split('.').pop().toLowerCase());
}

function updateBreadcrumbs() {
  const breadcrumbs = document.getElementById('directory-breadcrumbs');
  if (!breadcrumbs) return;

  breadcrumbs.innerHTML = '<button class="breadcrumb" data-path="">Home</button>';
  if (currentPathArray.length > 0) {
    let path = '';
    currentPathArray.forEach((folder, index) => {
      path += folder + '/';
      breadcrumbs.innerHTML += `<button class="breadcrumb" data-path="${path}">${folder}</button>`;
    });
  }
}

function navigateToFolder(path) {
  currentPath = path || '';
  currentPathArray = currentPath ? currentPath.split('/').filter(Boolean) : [];
  updateBreadcrumbs();
}

async function uploadToAzure(file, sasUrl, metadata) {
  console.log('uploadToAzure called for:', file.name);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        console.log(`Upload progress for ${file.name}: ${percentComplete}%`);
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        console.log('Upload completed:', file.name);
        resolve();
      } else {
        console.error('Upload failed:', xhr.status, xhr.statusText);
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => {
      console.error('Upload error:', file.name);
      reject(new Error('Network error during upload'));
    };
    xhr.open('PUT', sasUrl, true);
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

function closeEditModal() {
  const modal = document.getElementById('edit-modal');
  if (modal) modal.style.display = 'none';
}

function closeMoveModal() {
  const modal = document.getElementById('move-modal');
  if (modal) modal.style.display = 'none';
}

function closeRenameFolderModal() {
  const modal = document.getElementById('rename-folder-modal');
  if (modal) modal.style.display = 'none';
}

async function openEditModal(button) {
  console.log('openEditModal called with docId:', button.dataset.docId);
  const modal = document.getElementById('edit-modal');
  const form = document.getElementById('edit-form');
  if (!modal || !form) return;

  form.dataset.docId = button.dataset.docId;
  document.getElementById('edit-title').value = button.dataset.title || '';
  document.getElementById('edit-description').value = button.dataset.description || '';
  document.getElementById('edit-tags').value = button.dataset.tags || '';
  document.getElementById('edit-category').value = button.dataset.category || 'general';
  modal.style.display = 'block';
}

async function openMoveModal(button) {
  console.log('openMoveModal called with docId:', button.dataset.docId);
  const modal = document.getElementById('move-modal');
  const form = document.getElementById('move-form');
  const targetFolder = document.getElementById('target-folder');
  const currentFolderSpan = document.getElementById('current-folder');
  if (!modal || !form || !targetFolder || !currentFolderSpan) return;

  form.dataset.docId = button.dataset.docId;
  currentFolderSpan.textContent = button.dataset.currentPath || 'Home';
  targetFolder.innerHTML = '<option value="">Home (Root Folder)</option>';

  try {
    const foldersQuery = query(collection(db, 'folders'), where('ownerId', '==', auth.currentUser.uid));
    const foldersSnapshot = await getDocs(foldersQuery);
    console.log('foldersSnapshot in openMoveModal:', foldersSnapshot?.docs?.map(doc => doc.data()));

    if (foldersSnapshot && foldersSnapshot.forEach) {
      foldersSnapshot.forEach((doc) => {
        const folder = doc.data();
        targetFolder.innerHTML += `<option value="${folder.fullPath}">${folder.name}</option>`;
      });
    } else {
      console.warn('No folders found or foldersSnapshot is invalid');
    }
    modal.style.display = 'block';
  } catch (error) {
    console.error('Error loading folders:', error);
    modal.style.display = 'none';
  }
}

async function openRenameFolderModal(button) {
  console.log('openRenameFolderModal called with folderId:', button.dataset.folderId);
  const modal = document.getElementById('rename-folder-modal');
  const form = document.getElementById('rename-folder-form');
  if (!modal || !form) return;

  form.dataset.folderId = button.dataset.folderId;
  document.getElementById('new-folder-name').value = button.dataset.currentName || '';
  modal.style.display = 'block';
}

async function createFolder(folderName, userId) {
  console.log('createFolder called with folderName:', folderName, 'userId:', userId);
  try {
    const fullPath = currentPath ? `${currentPath}${folderName}/` : `${folderName}/`;
    await addDoc(collection(db, 'folders'), {
      name: folderName,
      path: currentPath,
      fullPath,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('Folder created successfully');
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
}

async function updateFileMetadata(docId, metadata) {
  console.log('updateFileMetadata called with docId:', docId, 'metadata:', metadata);
  try {
    const docRef = doc(db, 'archiveItems', docId);
    await updateDoc(docRef, {
      metadata: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags ? metadata.tags.split(',').map(tag => tag.trim()) : [],
        category: metadata.category,
      },
    });
    console.log('Metadata updated successfully');
  } catch (error) {
    console.error('Error updating metadata:', error);
    throw error;
  }
}

async function displayFiles(userId) {
  console.log('displayFiles called with userId:', userId);
  const container = document.getElementById('files-container');
  const breadcrumbs = document.getElementById('directory-breadcrumbs');
  if (!container || !breadcrumbs) {
    console.error('Required elements not found');
    return;
  }

  try {
    container.innerHTML = '<section class="file-card">Loading...</section>';
    console.log('container HTML set to Loading...');

    updateBreadcrumbs();
    console.log('currentPath:', currentPath);

    const foldersQuery = query(
      collection(db, 'folders'),
      where('ownerId', '==', userId),
      where('path', '==', currentPath)
    );
    console.log('foldersQuery created');

    const foldersSnapshot = await getDocs(foldersQuery);
    console.log('foldersSnapshot:', foldersSnapshot?.docs?.map(doc => doc.data()) || 'undefined');

    const filesQuery = query(
      collection(db, 'archiveItems'),
      where('uploadedBy', '==', userId),
      where('path', '==', currentPath || '')
    );
    console.log('filesQuery created');

    const filesSnapshot = await getDocs(filesQuery);
    console.log('filesSnapshot:', filesSnapshot?.docs?.map(doc => doc.data()) || 'undefined');

    container.innerHTML = '';
    console.log('container HTML cleared');

    if (!foldersSnapshot || !filesSnapshot || (foldersSnapshot.empty && filesSnapshot.empty)) {
      console.log('Both snapshots empty or undefined');
      container.innerHTML = '<p class="empty-message">This folder is empty</p>';
      return;
    }

    if (foldersSnapshot.docs) {
      foldersSnapshot.docs.forEach((doc) => {
        console.log('Rendering folder:', doc.data());
        const folder = doc.data();
        const folderCard = document.createElement('section');
        folderCard.className = 'folder-card';
        folderCard.dataset.path = folder.fullPath;
        folderCard.dataset.folderId = doc.id;
        folderCard.innerHTML = `
          <section class="folder-icon">📁</section>
          <section class="folder-details">
            <h3>${folder.name}</h3>
            <section class="folder-meta">
              <p>Folder</p>
              <p>Created: ${formatDate(folder.createdAt?.toDate())}</p>
            </section>
            <section class="folder-actions">
              <button class="rename-folder-btn" 
                data-folder-id="${doc.id}"
                data-current-name="${folder.name}">Rename</button>
              <button class="delete-folder-btn" data-folder-id="${doc.id}">Delete</button>
            </section>
          </section>
        `;
        container.appendChild(folderCard);
      });
    }

    if (filesSnapshot.docs) {
      filesSnapshot.docs.forEach((doc) => {
        console.log('Rendering file:', doc.data());
        const file = doc.data();
        const fileType = getSimplifiedType(file.type);
        const fileIcon = fileIcons[fileType] || fileIcons.default;

        const card = document.createElement('section');
        card.className = 'file-card';
        card.dataset.docId = doc.id;
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
              <button class="move-btn" 
                data-doc-id="${doc.id}"
                data-current-path="${file.path || ''}">Move</button>
              <button class="delete-btn" data-doc-id="${doc.id}" data-blob-name="${file.url.split('/').pop()}">Delete</button>
            </section>
          </section>
        `;
        container.appendChild(card);
      });
    }
  } catch (error) {
    console.error('Error loading files:', error);
    container.innerHTML = '<p class="error-message">Error loading files. Please check console for details.</p>';
  }
}

async function handleFileUpload(files, userId) {
  console.log('handleFileUpload called with files:', files, 'userId:', userId);
  console.log('auth.currentUser:', auth.currentUser);
  if (!auth.currentUser) {
    console.log('No user, alerting sign-in required');
    alert('Please sign in to upload files.');
    return;
  }
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log('Processing file:', file.name);
      const fileType = detectFileType(file);
      const fileSize = formatFileSize(file.size);
      const lastModified = new Date(file.lastModified).toLocaleString();

      const pathPrefix = currentPath ? `${userId}/${currentPath}` : `${userId}/`;
      const uniqueFileName = `${pathPrefix}${new Date().getTime()}-${file.name}`;
      console.log('Generated uniqueFileName:', uniqueFileName);

      const response = await fetch('https://scriptorium.azurewebsites.net/api/get-sas-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blobName: uniqueFileName,
          userId: userId,
        }),
      });
      const { sasUrl } = await response.json();
      console.log('Received sasUrl:', sasUrl);

      await uploadToAzure(file, sasUrl, {
        title: file.name,
        description: '',
        tags: '',
        category: 'general',
      });
      console.log('uploadToAzure completed for:', file.name);

      const fileUrl = sasUrl.split('?')[0];

      const docRef = await addDoc(collection(db, 'archiveItems'), {
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
          category: 'general',
        },
        status: 'active',
        views: 0,
        downloads: 0,
      });
      console.log('addDoc completed, docRef:', docRef.id);

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        uploads: arrayUnion({
          itemId: docRef.id,
          name: file.name,
          type: fileType,
          uploadedAt: new Date().toISOString(),
          url: fileUrl,
        }),
        lastUpload: serverTimestamp(),
      });
      console.log('updateDoc for user completed');
    }

    displayFiles(userId);
    console.log('Alerting upload success');
    alert('Files uploaded successfully!');
    let fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
  } catch (error) {
    console.error('Error uploading files:', error);
    alert('Error uploading files: ' + error.message);
  }
}

async function deleteFile(docId, blobName) {
  const user = auth.currentUser;
  if (!user) return;

  console.log('deleteFile called with docId:', docId, 'blobName:', blobName);
  try {
    const docRef = doc(db, 'archiveItems', docId);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot || !docSnapshot.exists()) {
      console.warn('File not found');
      return;
    }

    const fileData = docSnapshot.data();
    console.log('File data:', fileData);

    if (fileData.url) {
      console.log('Deleting blob:', blobName);
      try {
        const response = await fetch('/api/delete-blob', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ blobName }),
        });
        console.log('Blob deletion response:', response.ok);
        if (!response.ok) {
          console.error('Blob deletion failed:', await response.text());
        }
      } catch (error) {
        console.error('Error deleting blob:', error);
      }
    }

    console.log('Deleting Firestore document:', docId);
    await deleteDoc(docRef);

    const searchQuery = query(collection(db, 'searchIndex'), where('itemId', '==', docId));
    const searchSnapshot = await getDocs(searchQuery);
    const searchDeletions = [];
    if (searchSnapshot && searchSnapshot.forEach) {
      searchSnapshot.forEach((searchDoc) => {
        console.log('Deleting search index:', searchDoc.id);
        searchDeletions.push(deleteDoc(doc(db, 'searchIndex', searchDoc.id)));
      });
    }

    const collectionQuery = query(collection(db, 'archiveCollections'), where('itemId', '==', docId));
    const collectionSnapshot = await getDocs(collectionQuery);
    const collectionDeletions = [];
    if (collectionSnapshot && collectionSnapshot.forEach) {
      collectionSnapshot.forEach((collDoc) => {
        console.log('Deleting collection:', collDoc.id);
        collectionDeletions.push(deleteDoc(doc(db, 'archiveCollections', collDoc.id)));
      });
    }

    await Promise.all([...searchDeletions, ...collectionDeletions]);
    console.log('All related documents deleted');

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    if (userDoc && userDoc.exists()) {
      const uploads = userDoc.data().uploads || [];
      const updatedUploads = uploads.filter(upload => upload.itemId !== docId);
      console.log('Updating user uploads');
      await updateDoc(userRef, { uploads: updatedUploads });
    }

    displayFiles(user.uid);
    console.log('Alerting delete success');
    alert('File deleted successfully!');
  } catch (error) {
    console.error('Error deleting file:', error);
    alert('Failed to delete file. Please try again.');
  }
}

async function moveFile(docId, targetPath) {
  const user = auth.currentUser;
  if (!user) return;

  console.log('moveFile called with docId:', docId, 'targetPath:', targetPath);
  try {
    const docRef = doc(db, 'archiveItems', docId);
    const newPath = targetPath || '';
    console.log('Updating path to:', newPath);
    await updateDoc(docRef, {
      path: newPath,
    });

    displayFiles(user.uid);
    console.log('Closing move modal');
    closeMoveModal();
    alert('File moved successfully!');
  } catch (error) {
    console.error('Error moving file:', error);
    closeMoveModal();
    alert('Failed to move file. Please try again.');
  }
}

async function renameFolder(folderId, newName) {
  const user = auth.currentUser;
  if (!user) return;

  console.log('renameFolder called with folderId:', folderId, 'newName:', newName);
  try {
    const folderRef = doc(db, 'folders', folderId);
    const folderDoc = await getDoc(folderRef);

    if (!folderDoc || !folderDoc.exists()) {
      console.warn('Folder not found');
      closeRenameFolderModal();
      alert('Folder not found');
      return;
    }

    const folderData = folderDoc.data();
    const oldName = folderData.name;
    const oldPath = folderData.fullPath;
    const newFullPath = folderData.path + newName + '/';
    console.log('New fullPath:', newFullPath);

    await updateDoc(folderRef, {
      name: newName,
      fullPath: newFullPath,
      updatedAt: serverTimestamp(),
    });
    console.log('updateDoc for folder completed');

    const filesQuery = query(
      collection(db, 'archiveItems'),
      where('uploadedBy', '==', user.uid),
      where('path', '==', oldPath)
    );
    const filesSnapshot = await getDocs(filesQuery);
    const fileUpdates = [];
    if (filesSnapshot && filesSnapshot.forEach) {
      filesSnapshot.forEach((doc) => {
        console.log('Updating file path for:', doc.id);
        fileUpdates.push(updateDoc(doc.ref, {
          path: newFullPath,
        }));
      });
    }
    await Promise.all(fileUpdates);
    console.log('File path updates completed');

    const foldersQuery = query(
      collection(db, 'folders'),
      where('ownerId', '==', user.uid),
      where('path', '==', oldPath)
    );
    const foldersSnapshot = await getDocs(foldersQuery);
    const folderUpdates = [];
    if (foldersSnapshot && foldersSnapshot.forEach) {
      foldersSnapshot.forEach((doc) => {
        const subfolderData = doc.data();
        const newSubfolderPath = newFullPath + subfolderData.name + '/';
        console.log('Updating subfolder path for:', doc.id);
        folderUpdates.push(updateDoc(doc.ref, {
          path: newFullPath,
          fullPath: newSubfolderPath,
        }));
      });
    }
    await Promise.all(folderUpdates);
    console.log('Subfolder path updates completed');

    if (currentPath.startsWith(oldPath)) {
      currentPath = currentPath.replace(oldPath, newFullPath);
      currentPathArray = currentPath ? currentPath.split('/').filter(Boolean) : [];
      console.log('Updated currentPath:', currentPath);
    }

    displayFiles(user.uid);
    console.log('Closing rename modal');
    closeRenameFolderModal();
    alert('Folder renamed successfully!');
  } catch (error) {
    console.error('Error renaming folder:', error);
    closeRenameFolderModal();
    alert('Failed to rename folder. Please try again.');
  }
}

async function deleteFolder(folderId, userId) {
  console.log('deleteFolder called with folderId:', folderId, 'userId:', userId);
  if (!window.confirm('Are you sure you want to delete this folder and all its contents?')) {
    console.log('Folder deletion cancelled');
    return;
  }

  try {
    const folderRef = doc(db, 'folders', folderId);
    const folderDoc = await getDoc(folderRef);

    if (!folderDoc || !folderDoc.exists()) {
      console.warn('Folder not found');
      return;
    }

    const folderData = folderDoc.data();
    const folderPath = folderData.fullPath;
    console.log('Folder path:', folderPath);

    const filesQuery = query(
      collection(db, 'archiveItems'),
      where('uploadedBy', '==', userId),
      where('path', '==', folderPath)
    );
    const filesSnapshot = await getDocs(filesQuery);
    const fileDeletions = [];
    if (filesSnapshot && filesSnapshot.forEach) {
      filesSnapshot.forEach((fileDoc) => {
        console.log('Deleting file:', fileDoc.id);
        fileDeletions.push(deleteFile(fileDoc.id, fileDoc.data().url));
      });
    }
    await Promise.all(fileDeletions);
    console.log('All files deleted');

    const subfoldersQuery = query(
      collection(db, 'folders'),
      where('ownerId', '==', userId),
      where('path', '==', folderPath)
    );
    const subfoldersSnapshot = await getDocs(subfoldersQuery);
    const folderDeletions = [];
    if (subfoldersSnapshot && subfoldersSnapshot.forEach) {
      subfoldersSnapshot.forEach((subfolderDoc) => {
        console.log('Deleting subfolder:', subfolderDoc.id);
        folderDeletions.push(deleteFolder(subfolderDoc.id, userId));
      });
    }
    await Promise.all(folderDeletions);
    console.log('All subfolders deleted');

    console.log('Deleting folder:', folderId);
    await deleteDoc(folderRef);

    displayFiles(userId);
    console.log('Alerting folder delete success');
    alert('Folder and all contents deleted successfully!');
  } catch (error) {
    console.error('Error deleting folder:', error);
    alert('Failed to delete folder. Please try again.');
  }
}

function setupEventListeners(userId) {
  console.log('setupEventListeners called with userId:', userId);
  const filesContainer = document.getElementById('files-container');
  const createFolderBtn = document.getElementById('create-folder-btn');
  const uploadFileBtn = document.getElementById('upload-file-btn');
  const folderForm = document.getElementById('folder-form');
  const editForm = document.getElementById('edit-form');
  const moveForm = document.getElementById('move-form');
  const renameFolderForm = document.getElementById('rename-folder-form');
  const cancelFolder = document.getElementById('cancel-folder');
  const cancelEdit = document.getElementById('cancel-edit');
  const cancelMove = document.getElementById('cancel-move');
  const cancelRenameFolder = document.getElementById('cancel-rename-folder');

  let fileInput = document.getElementById('fileInput');
  if (!fileInput) {
    console.log('Creating fileInput');
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'fileInput';
    fileInput.multiple = true;
    fileInput.className = 'drop-zone__input';
    document.body.appendChild(fileInput);
  }

  if (filesContainer) {
    filesContainer.addEventListener('click', async (e) => {
      console.log('filesContainer click, target:', e.target.className);
      if (e.target.classList.contains('folder-card')) {
        const path = e.target.dataset.path;
        console.log('Navigating to folder:', path);
        navigateToFolder(path);
        await displayFiles(userId);
      }
      if (e.target.classList.contains('edit-btn')) {
        console.log('Edit button clicked, docId:', e.target.dataset.docId);
        await openEditModal(e.target);
      }
      if (e.target.classList.contains('move-btn')) {
        console.log('Move button clicked, docId:', e.target.dataset.docId);
        await openMoveModal(e.target);
      }
      if (e.target.classList.contains('delete-btn')) {
        console.log('Delete button clicked, docId:', e.target.dataset.docId);
        await deleteFile(e.target.dataset.docId, e.target.dataset.blobName);
      }
      if (e.target.classList.contains('rename-folder-btn')) {
        console.log('Rename folder button clicked, folderId:', e.target.dataset.folderId);
        await openRenameFolderModal(e.target);
      }
      if (e.target.classList.contains('delete-folder-btn')) {
        e.stopPropagation();
        const folderId = e.target.dataset.folderId;
        console.log('Delete folder button clicked, folderId:', folderId);
        await deleteFolder(folderId, userId);
      }
    });
  }

  if (createFolderBtn) {
    createFolderBtn.addEventListener('click', () => {
      console.log('create-folder-btn clicked');
      document.getElementById('folder-modal').style.display = 'block';
    });
  }

  if (uploadFileBtn) {
    uploadFileBtn.addEventListener('click', () => {
      console.log('upload-file-btn clicked');
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      console.log('fileInput change, files:', fileInput.files);
      await handleFileUpload(fileInput.files, userId);
    });
  }

  if (folderForm) {
    folderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('folder-form submitted');
      const folderName = document.getElementById('folder-name').value.trim();
      console.log('folderName:', folderName);
      if (folderName) {
        try {
          await createFolder(folderName, auth.currentUser.uid);
          console.log('createFolder completed');
          document.getElementById('folder-name').value = '';
        } finally {
          console.log('Closing folder modal');
          document.getElementById('folder-modal').style.display = 'none';
        }
      }
    });
  }

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('edit-form submitted');
      const docId = editForm.dataset.docId;
      const title = document.getElementById('edit-title').value;
      const description = document.getElementById('edit-description').value;
      const tags = document.getElementById('edit-tags').value;
      const category = document.getElementById('edit-category').value;
      console.log('Updating metadata for docId:', docId);
      try {
        await updateFileMetadata(docId, { title, description, tags, category });
        console.log('updateFileMetadata completed');
        const user = auth.currentUser;
        if (user) {
          await displayFiles(user.uid);
        }
      } finally {
        console.log('Closing edit modal');
        closeEditModal();
      }
    });
  }

  if (moveForm) {
    moveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('move-form submitted');
      const docId = moveForm.dataset.docId;
      const targetPath = document.getElementById('target-folder').value;
      console.log('Moving docId:', docId, 'to targetPath:', targetPath);
      try {
        await moveFile(docId, targetPath);
        console.log('moveFile completed');
      } finally {
        console.log('Closing move modal');
        closeMoveModal();
      }
    });
  }

  if (renameFolderForm) {
    renameFolderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('rename-folder-form submitted');
      const folderId = renameFolderForm.dataset.folderId;
      const newName = document.getElementById('new-folder-name').value.trim();
      console.log('Renaming folderId:', folderId, 'to:', newName);
      try {
        await renameFolder(folderId, newName);
        console.log('renameFolder completed');
      } finally {
        console.log('Closing rename folder modal');
        closeRenameFolderModal();
      }
    });
  }

  if (cancelFolder) {
    cancelFolder.addEventListener('click', () => {
      console.log('cancel-folder clicked');
      document.getElementById('folder-modal').style.display = 'none';
    });
  }

  if (cancelEdit) {
    cancelEdit.addEventListener('click', () => {
      console.log('cancel-edit clicked');
      closeEditModal();
    });
  }

  if (cancelMove) {
    cancelMove.addEventListener('click', () => {
      console.log('cancel-move clicked');
      closeMoveModal();
    });
  }

  if (cancelRenameFolder) {
    cancelRenameFolder.addEventListener('click', () => {
      console.log('cancel-rename-folder clicked');
      closeRenameFolderModal();
    });
  }

  const breadcrumbs = document.getElementById('directory-breadcrumbs');
  if (breadcrumbs) {
    breadcrumbs.addEventListener('click', async (e) => {
      if (e.target.classList.contains('breadcrumb')) {
        console.log('breadcrumb clicked, path:', e.target.dataset.path);
        navigateToFolder(e.target.dataset.path);
        await displayFiles(userId);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded');
  auth.onAuthStateChanged((user) => {
    console.log('onAuthStateChanged, user:', user?.uid);
    const container = document.getElementById('files-container');
    if (!container) {
      console.error('files-container not found');
      return;
    }
    if (user) {
      setupEventListeners(user.uid);
      displayFiles(user.uid);
    } else {
      container.innerHTML = '<p class="auth-message">Please sign in to view your files</p>';
    }
  });
});