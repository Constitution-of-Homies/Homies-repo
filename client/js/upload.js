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

function detectFileType(file) {
  const type = file.type.split('/')[0];
  const extension = file.name.split('.').pop().toLowerCase();
  
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';
  if (type === 'audio') return 'audio';
  
  // Check common document types
  const documentTypes = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
  if (documentTypes.includes(extension)) return 'document';
  
  // Check spreadsheet types
  const spreadsheetTypes = ['xls', 'xlsx', 'csv'];
  if (spreadsheetTypes.includes(extension)) return 'spreadsheet';
  
  // Check presentation types
  const presentationTypes = ['ppt', 'pptx'];
  if (presentationTypes.includes(extension)) return 'presentation';
  
  // Check archive types
  const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz'];
  if (archiveTypes.includes(extension)) return 'archive';
  
  // Check code types
  const codeTypes = ['js', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'json', 'xml'];
  if (codeTypes.includes(extension)) return 'code';
  
  return 'unknown';
}

function getFileIcon(type) {
  const icons = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    document: '📄',
    spreadsheet: '📊',
    presentation: '📑',
    archive: '🗄️',
    code: '💻',
    unknown: '📁'
  };
  return icons[type] || icons.unknown;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  progressContainer.style.display = 'block';

  for (let i = 0; i < filesToUpload.length; i++) {
    const fileData = filesToUpload[i];
    const file = fileData.file;
    const uniqueFileName = new Date().getTime() + '-' + file.name;

    fileInfo.textContent = `Uploading: ${file.name} (${i+1} of ${filesToUpload.length})`;
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    try {
      const sasUrl = await getSasUrl(uniqueFileName);
      await uploadToAzure(file, sasUrl, fileData.metadata.customMetadata);
      addFileToList(file.name, sasUrl.split('?')[0], true);
    } catch (error) {
      console.error(error);
      addFileToList(file.name, null, false, error.message);
    }
  }

  clearSelection();
  fileInfo.textContent = 'Upload complete!';
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
  const response = await fetch('/get-sas-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ blobName }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to get SAS URL');
  return data.sasUrl;
}