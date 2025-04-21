import { 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
// import {
//   BlobServiceClient,
//   StorageSharedKeyCredential,
//   generateBlobSASQueryParameters,
//   BlobSASPermissions
// } from 'https://cdn.jsdelivr.net/npm/@azure/storage-blob@12.14.0/dist/azure-storage-blob.min.js';
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { formatFileSize, detectFileType, getFileIcon } from './utils.mjs';

// DOM elements
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const cancelBtn = document.getElementById('cancelBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const fileInfo = document.getElementById('fileInfo');
const fileList = document.getElementById('fileList');
const dropZone = document.getElementById('dropZone');
const filePreview = document.getElementById('filePreview');
const previewList = document.getElementById('previewList');

// Store files with metadata
let filesToUpload = [];
let currentUser = null;

// Initialize auth state listener
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    console.log("User is not authenticated");
    uploadBtn.disabled = true;
  } else {
    console.log("User is authenticated:", user.uid);
    uploadBtn.disabled = false;
  }
});

// Initialize drag and drop
initDropZone();

uploadBtn.addEventListener('click', uploadFiles);
cancelBtn.addEventListener('click', clearSelection);

function initDropZone() {
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop zone when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
  });

  // Handle dropped files
  dropZone.addEventListener('drop', handleDrop, false);

  // Handle click to select files
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // Update drop zone when files are selected via input
  fileInput.addEventListener('change', handleFileSelection);
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight() {
  dropZone.classList.add('drop-zone--over');
}

function unhighlight() {
  dropZone.classList.remove('drop-zone--over');
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  fileInput.files = files;
  handleFileSelection();
}

function handleFileSelection() {
  if (fileInput.files.length > 0) {
    const prompt = dropZone.querySelector('.drop-zone__prompt');
    if (prompt) {
      prompt.textContent = `${fileInput.files.length} file(s) selected`;
    }
    
    // Add files to our array with metadata
    filesToUpload = Array.from(fileInput.files).map(file => ({
      file,
      metadata: {
        name: file.name,
        type: detectFileType(file),
        size: formatFileSize(file.size),
        lastModified: new Date(file.lastModified).toLocaleString(),
        customMetadata: {
          title: file.name,
          description: '',
          tags: '',
          category: 'general'
        }
      }
    }));
    
    updateFilePreview();
    filePreview.style.display = 'block';
  }
}

function updateFilePreview() {
  previewList.innerHTML = '';
  
  filesToUpload.forEach((fileData, index) => {
    const item = document.createElement('sect');
    item.className = 'preview-item';
    
    item.innerHTML = `
      <sect class="preview-icon">
        <span class="file-icon">${getFileIcon(fileData.metadata.type)}</span>
      </sect>
      <sect class="preview-details">
        <sect class="preview-name">${fileData.metadata.name}</sect>
        <sect class="preview-meta">
          ${fileData.metadata.type} • ${fileData.metadata.size} • ${fileData.metadata.lastModified}
        </sect>
      </sect>
      <sect class="preview-actions">
        <button class="metadata-btn" data-index="${index}">✏️</button>
        <button class="remove-btn" data-index="${index}">❌</button>
      </sect>
    `;
    
    previewList.appendChild(item);
  });
  
  // Add event listeners to remove buttons
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = e.target.getAttribute('data-index');
      filesToUpload.splice(index, 1);
      updateFilePreview();
      if (filesToUpload.length === 0) {
        filePreview.style.display = 'none';
        dropZone.querySelector('.drop-zone__prompt').textContent = 'Drop files here or click to select';
      }
    });
  });
  
  // Add event listeners to metadata buttons
  document.querySelectorAll('.metadata-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = e.target.getAttribute('data-index');
      showMetadataModal(index);
    });
  });
}

function showMetadataModal(index) {
  const fileData = filesToUpload[index];
  
  const modal = document.createElement('sect');
  modal.className = 'modal';
  modal.innerHTML = `
    <sect class="modal-content">
      <sect class="modal-header">
        <h3 class="modal-title">Edit Metadata: ${fileData.metadata.name}</h3>
        <button class="close-btn">&times;</button>
      </sect>
      <form class="metadata-form">
        <sect class="form-group">
          <label for="title">Title</label>
          <input type="text" id="title" value="${fileData.metadata.customMetadata.title}">
        </sect>
        <sect class="form-group">
          <label for="description">Description</label>
          <textarea id="description">${fileData.metadata.customMetadata.description}</textarea>
        </sect>
        <sect class="form-group">
          <label for="tags">Tags (comma separated)</label>
          <input type="text" id="tags" value="${fileData.metadata.customMetadata.tags}">
        </sect>
        <sect class="form-group">
          <label for="category">Category</label>
          <select id="category">
            <option value="general" ${fileData.metadata.customMetadata.category === 'general' ? 'selected' : ''}>General</option>
            <option value="work" ${fileData.metadata.customMetadata.category === 'work' ? 'selected' : ''}>Work</option>
            <option value="personal" ${fileData.metadata.customMetadata.category === 'personal' ? 'selected' : ''}>Personal</option>
            <option value="media" ${fileData.metadata.customMetadata.category === 'media' ? 'selected' : ''}>Media</option>
            <option value="documents" ${fileData.metadata.customMetadata.category === 'documents' ? 'selected' : ''}>Documents</option>
          </select>
        </sect>
        <button type="button" class="save-btn">Save</button>
      </form>
    </sect>
  `;
  
  document.body.appendChild(modal);
  modal.style.display = 'flex';
  
  // Close modal when clicking X or outside
  modal.querySelector('.close-btn').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Save metadata
  modal.querySelector('.save-btn').addEventListener('click', () => {
    filesToUpload[index].metadata.customMetadata = {
      title: modal.querySelector('#title').value,
      description: modal.querySelector('#description').value,
      tags: modal.querySelector('#tags').value,
      category: modal.querySelector('#category').value
    };
    
    // Update the filename if title was changed
    if (modal.querySelector('#title').value !== fileData.metadata.name) {
      const extension = fileData.metadata.name.split('.').pop();
      filesToUpload[index].file = new File(
        [fileData.file], 
        `${modal.querySelector('#title').value}.${extension}`, 
        { type: fileData.file.type }
      );
      filesToUpload[index].metadata.name = `${modal.querySelector('#title').value}.${extension}`;
    }
    
    modal.remove();
    updateFilePreview();
  });
}

function clearSelection() {
  filesToUpload = [];
  fileInput.value = '';
  filePreview.style.display = 'none';
  dropZone.querySelector('.drop-zone__prompt').textContent = 'Drop files here or click to select';
}

async function uploadFiles() {
  if (filesToUpload.length === 0) {
    alert('Please select at least one file.');
    return;
  }

  if (!currentUser) {
    alert('Please sign in to upload files.');
    return;
  }

  progressContainer.style.display = 'block';

  try {
    for (let i = 0; i < filesToUpload.length; i++) {
      const fileData = filesToUpload[i];
      const file = fileData.file;
      const uniqueFileName = `${currentUser.uid}/${new Date().getTime()}-${file.name}`;

      fileInfo.textContent = `Uploading: ${file.name} (${i+1} of ${filesToUpload.length})`;
      progressBar.style.width = '0%';
      progressText.textContent = '0%';

      try {
        const sasUrl = await getSasUrl(uniqueFileName);
        await uploadToAzure(file, sasUrl, fileData.metadata.customMetadata);
        
        const fileUrl = sasUrl.split('?')[0];
        await addToFirestoreCollections(fileData, fileUrl, currentUser);
        
        addFileToList(file.name, fileUrl, true);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        addFileToList(file.name, null, false, error.message);
      }
    }

    alert('All files uploaded successfully!');
  } catch (error) {
    console.error('Upload process failed:', error);
    alert('Upload process failed. Please try again.');
  } finally {
    clearSelection();
    fileInfo.textContent = 'Upload complete!';
  }
}

async function addToFirestoreCollections(fileData, fileUrl, user) {
  const timestamp = serverTimestamp();
  const fileType = fileData.metadata.type;
  const metadata = fileData.metadata.customMetadata;
  const tagsArray = metadata.tags.split(',').map(tag => tag.trim()).filter(tag => tag);

  // First create the archiveItem document
  const archiveItemRef = await addDoc(collection(db, "archiveItems"), {
    name: fileData.metadata.name,
    type: fileType,
    size: fileData.metadata.size,
    url: fileUrl,
    lastModified: fileData.metadata.lastModified,
    uploadedBy: user.uid,
    uploadedAt: timestamp,
    metadata: {
      title: metadata.title,
      description: metadata.description,
      tags: tagsArray,
      category: metadata.category
    },
    status: 'active',
    views: 0,
    downloads: 0
  });

  // Then create the searchIndex document
  const searchIndexRef = await addDoc(collection(db, "searchIndex"), {
    itemId: archiveItemRef.id,
    title: metadata.title,
    description: metadata.description,
    tags: tagsArray,
    category: metadata.category,
    content: "", // Will be populated if you process text files later
    type: fileType,
    lastModified: fileData.metadata.lastModified,
    uploadedBy: user.uid,
    uploadedAt: timestamp
  });

  // Update the user's document to include this upload
  const userRef = doc(db, "users", user.uid);
  await updateDoc(userRef, {
    uploads: arrayUnion({
      itemId: archiveItemRef.id,
      name: fileData.metadata.name,
      type: fileType,
      uploadedAt: new Date().toISOString(), // Use client timestamp instead
      url: fileUrl
    }),
    lastUpload: serverTimestamp() // This is fine as it's a direct update
  });

  // Add to archiveCollection with proper path structure
  await addDoc(collection(db, "archiveCollections"), {
    itemId: archiveItemRef.id,
    name: fileData.metadata.name,
    type: fileType,
    path: `/${metadata.category}/${fileType}`,
    createdAt: timestamp,
    createdBy: user.uid,
    searchIndexId: searchIndexRef.id
  });

  return {
    archiveItemId: archiveItemRef.id,
    searchIndexId: searchIndexRef.id
  };
}

function uploadToAzure(file, sasUrl, metadata) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;
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

function addFileToList(fileName, url, success, errorMsg) {
  const item = document.createElement('section');
  item.className = 'file-item';

  if (success) {
    item.innerHTML = `<section class="success">✓ ${fileName} uploaded successfully</section>
                      <section><a href="${url}" target="_blank">View file</a></section>`;
  } else {
    item.innerHTML = `<section class="error">✗ Failed to upload ${fileName}</section>
                      <section>${errorMsg || 'Unknown error'}</section>`;
  }

  fileList.appendChild(item);
}

// async function getSasUrl(blobName) {
//   try {
//     // TEMPORARY DEMO CREDENTIALS - REPLACE WITH YOUR OWN
// const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
//       const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
//       const containerName = process.env.AZURE_CONTAINER_NAME;

//     if (!accountName || !accountKey || !containerName) {
//       throw new Error('Missing Azure Storage credentials');
//     }

//     const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    
//     // Generate SAS token
//     const expiresOn = new Date(new Date().valueOf() + 60 * 60 * 1000); // 1 hour expiration
//     const sasToken = generateBlobSASQueryParameters({
//       containerName,
//       blobName,
//       permissions: BlobSASPermissions.parse("cw"), // Create + Write permissions
//       expiresOn
//     }, sharedKeyCredential).toString();

//     const blobServiceClient = new BlobServiceClient(
//       `https://${accountName}.blob.core.windows.net`,
//       sharedKeyCredential
//     );
    
//     const containerClient = blobServiceClient.getContainerClient(containerName);
//     const blockBlobClient = containerClient.getBlockBlobClient(blobName);

//     const sasUrl = `${blockBlobClient.url}?${sasToken}`;
//     console.log('Generated SAS URL:', sasUrl);
//     return sasUrl;
//   } catch (error) {
//     console.error('Error generating SAS URL:', error);
//     throw error;
//   }
// }

async function getSasUrl(blobName) {
  try {
    console.log('Requesting SAS URL for:', blobName);
    
    // Add a timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch('/api/get-sas-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ blobName }),
      signal: controller.signal
    }).catch(err => {
      console.error('Fetch error:', err);
      throw new Error(`Network error: ${err.message}`);
    });
    
    clearTimeout(timeoutId);
    
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    // Check if the response is empty
    const text = await response.text();
    console.log('Response body length:', text.length);
    console.log('Response body preview:', text.substring(0, 100));
    
    if (!text) {
      throw new Error('Server returned an empty response');
    }
    
    // Try to parse the text as JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse server response as JSON:', text);
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }
    
    // Check if the request was successful
    if (!response.ok) {
      throw new Error(data.message || data.error || `Server returned status ${response.status}`);
    }
    
    // Ensure the sasUrl is present
    if (!data.sasUrl) {
      throw new Error('Server response missing sasUrl');
    }
    
    return data.sasUrl;
  } catch (error) {
    console.error('Error getting SAS URL:', error);
    throw error;
  }
} 