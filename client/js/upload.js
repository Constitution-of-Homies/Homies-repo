import { 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
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
let uploadPath = "";
export function setUploadPath(path) {
  uploadPath = path || "";
}

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

export function handleFileSelection() {
  console.log('handleFileSelection: files=', fileInput.files);
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
        <button class="close-btn">×</button>
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
  console.log('uploadFiles: filesToUpload=', filesToUpload, 'currentUser=', currentUser);
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
        
        // Process file to extract text and generate embeddings
        const processResult = await processFile(fileUrl, fileData.metadata.type);
        
        // Add to Firestore with processing results
        await addToFirestoreCollections(fileData, fileUrl, currentUser, processResult);
        
        addFileToList(file.name, fileUrl, true);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        addFileToList(file.name, null, false, error.message);
        throw error; // Rethrow to trigger outer catch
      }
    }

    alert('All files uploaded successfully!');
    setTimeout(() => {
      document.getElementById('upload-modal').style.display = 'none';
    
      // Tell ViewUpload.js to refresh file list
      window.dispatchEvent(new CustomEvent('filesUploaded'));
    }, 1000);
  } catch (error) {
    console.error('Upload process failed:', error);
    alert('Upload process failed. Please try again.');
  } finally {
    clearSelection();
    fileInfo.textContent = 'Upload complete!';
  }
}

// Function to call the processFile API
async function processFile(fileUrl, fileType) {
  console.log('processFile called with:', { fileUrl, fileType });

  // Map detected file type to processFile API expected types
  const typeMapping = {
    pdf: 'pdf',
    document: 'document',
    text: 'text',
    code: 'text' // Treat code files as text
  };

  const mappedType = typeMapping[fileType] || null;

  if (!mappedType) {
    console.warn(`Unsupported file type for processing: ${fileType}`);
    return { extractedText: '', embeddings: [] };
  }

  try {
    console.log('Preparing fetch request...');
    const apiEndpoint = 'https://scriptorium.azurewebsites.net/api/processFile';
    const apiKey = "9dWaV8vYwFhlniMHJCV4m7MgAI2Ag1LMwY9RTSs3sFvKGNugVFm7JQQJ99BEACrIdLPXJ3w3AAABACOGfviS";

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        fileUrl,
        fileType: mappedType
      })
    });

    console.log('Fetch response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process file');
    }

    const data = await response.json();
    console.log('File processed successfully:', data);
    return {
      extractedText: data.extractedText || '',
      embeddings: data.embeddings || []
    };
  } catch (error) {
    console.error('Error processing file:', error);
    return { extractedText: '', embeddings: [] }; // Return empty results to allow upload to proceed
  }
}

export async function addToFirestoreCollections(fileData, fileUrl, user, processResult = { extractedText: '', embeddings: [] }) {
  const timestamp = serverTimestamp();
  const fileType = fileData.metadata.type;
  const metadata = fileData.metadata.customMetadata;
  const tagsArray = metadata.tags.split(',').map(tag => tag.trim()).filter(tag => tag);

  // First create the archiveItem document
  const archiveItemRef = await addDoc(collection(db, "archiveItems"), {
    name: fileData.metadata.name,
    type: fileType,
    size: fileData.file.size,
    url: fileUrl,
    lastModified: fileData.metadata.lastModified,
    uploadedBy: user.uid,
    uploadedAt: timestamp,
    path: uploadPath,
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

  // Then create the searchIndex document with processing results
  const searchIndexRef = await addDoc(collection(db, "searchIndex"), {
    itemId: archiveItemRef.id,
    title: metadata.title,
    description: metadata.description,
    tags: tagsArray,
    category: metadata.category,
    content: processResult.extractedText,
    embeddings: processResult.embeddings,
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
      uploadedAt: new Date().toISOString(),
      url: fileUrl
    }),
    lastUpload: serverTimestamp()
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

async function getSasUrl(blobName) {
  try {
    console.log('Requesting SAS URL for blob:', blobName);
    
    // Use your Function App endpoint
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