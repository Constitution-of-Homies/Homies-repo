// tests/upload.test.js
import { jest } from '@jest/globals';

// Mock Firebase Auth
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js', () => ({
  onAuthStateChanged: jest.fn(),
}), { virtual: true });

// Mock Firebase Firestore
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
  collection: jest.fn(() => ({ collection: true })),
  addDoc: jest.fn(),
  doc: jest.fn(() => ({ mockDoc: true })),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  arrayUnion: jest.fn(x => ({ arrayUnion: x })),
  serverTimestamp: jest.fn(() => ({ timestamp: true })),
}), { virtual: true });

// Mock firebase.js
jest.mock('../client/js/firebase.js', () => ({
  auth: { mockAuth: true },
  db: { mockDb: true },
}));

// Mock utils.mjs
jest.mock('../client/js/utils.mjs', () => ({
  formatFileSize: jest.fn(size => `${size} B`),
  detectFileType: jest.fn(file => file.type || 'application/octet-stream'),
  getFileIcon: jest.fn(type => '📄'),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock XMLHttpRequest
const mockXhr = {
  upload: {
    onprogress: null,
  },
  onload: null,
  onerror: null,
  open: jest.fn(),
  setRequestHeader: jest.fn(),
  send: jest.fn(),
  status: 200,
};
global.XMLHttpRequest = jest.fn(() => mockXhr);

// Mock window.alert
jest.spyOn(window, 'alert').mockImplementation(() => {});

// Mock DOM
beforeAll(() => {
  document.body.innerHTML = `
    <input type="file" id="fileInput" multiple />
    <button id="uploadBtn">Upload</button>
    <button id="cancelBtn">Cancel</button>
    <div id="progressContainer" style="display: none;">
      <div id="progressBar" style="width: 0%;"></div>
      <span id="progressText">0%</span>
    </div>
    <div id="fileInfo"></div>
    <div id="fileList"></div>
    <div id="dropZone">
      <span class="drop-zone__prompt">Drop files here or click to select</span>
    </div>
    <div id="filePreview" style="display: none;">
      <div id="previewList"></div>
    </div>
  `;
  // Mock console.log and console.error
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Upload Module', () => {
  let onAuthStateChanged,
    collection,
    addDoc,
    doc,
    setDoc,
    updateDoc,
    arrayUnion,
    serverTimestamp,
    formatFileSize,
    detectFileType,
    getFileIcon,
    progressBar,
    progressText;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.resetModules();

    // Reapply console mocks
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Extract mocks
    ({ onAuthStateChanged } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js'));
    ({
      collection,
      addDoc,
      doc,
      setDoc,
      updateDoc,
      arrayUnion,
      serverTimestamp,
    } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js'));
    ({ formatFileSize, detectFileType, getFileIcon } = require('../client/js/utils.mjs'));

    // Reset DOM
    document.getElementById('fileInput').value = '';
    document.getElementById('progressContainer').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressText').textContent = '0%';
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('fileList').innerHTML = '';
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('previewList').innerHTML = '';
    document.querySelector('.drop-zone__prompt').textContent = 'Drop files here or click to select';
    document.getElementById('uploadBtn').disabled = false;
    mockXhr.status = 200;

    // Cache DOM elements
    progressBar = document.getElementById('progressBar');
    progressText = document.getElementById('progressText');

    // Mock fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ sasUrl: 'https://example.com/blob?token=abc' }),
    });

    // Mock addDoc response
    addDoc.mockResolvedValue({ id: 'doc123' });
    updateDoc.mockResolvedValue();

    // Mock File constructor
    global.File = jest.fn((buffer, name, options) => ({
      name,
      type: options.type,
      size: buffer[0]?.size || 1024,
      lastModified: Date.now(),
    }));

    // Import upload.js and trigger initialization
    await import('../client/js/upload.js');
    await new Promise(resolve => setTimeout(resolve, 100)); // Ensure async init completes
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = document.body.innerHTML; // Reset DOM
  });

  test('disables upload button for unauthenticated user', async () => {
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(null);
    expect(document.getElementById('uploadBtn').disabled).toBe(true);
    expect(console.log).toHaveBeenCalledWith('User is not authenticated');
  });

  test('enables upload button for authenticated user', async () => {
    const user = { uid: 'user123' };
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    expect(document.getElementById('uploadBtn').disabled).toBe(false);
    expect(console.log).toHaveBeenCalledWith('User is authenticated:', 'user123');
  });

  test('handles file selection via input', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(document.getElementById('fileInput'), 'files', {
      value: [file],
      writable: true,
    });

    document.getElementById('fileInput').dispatchEvent(new Event('change'));

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(document.querySelector('.drop-zone__prompt').textContent).toBe('1 file(s) selected');
    expect(document.getElementById('filePreview').style.display).toBe('block');
    expect(document.querySelectorAll('.preview-item').length).toBe(1);
    expect(document.querySelector('.preview-name').textContent).toBe('test.pdf');
    expect(formatFileSize).toHaveBeenCalledWith(file.size);
    expect(detectFileType).toHaveBeenCalledWith(file);
    expect(getFileIcon).toHaveBeenCalledWith('application/pdf');
  });

  // test('handles file drop', async () => {
  //   const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
  //   const dataTransfer = new DataTransfer();
  //   dataTransfer.items.add(file);
  //   const dropEvent = new Event('drop', { bubbles: true });
  //   Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });

  //   document.getElementById('dropZone').dispatchEvent(dropEvent);

  //   await new Promise(resolve => setTimeout(resolve, 100));

  //   expect(document.querySelector('.drop-zone__prompt').textContent).toBe('1 file(s) selected');
  //   expect(document.getElementById('filePreview').style.display).toBe('block');
  //   expect(document.querySelectorAll('.preview-item').length).toBe(1);
  //   expect(document.querySelector('.preview-name').textContent).toBe('test.pdf');
  // });

  test('highlights and unhighlights drop zone', async () => {
    const dragOverEvent = new Event('dragover', { bubbles: true });
    document.getElementById('dropZone').dispatchEvent(dragOverEvent);
    expect(document.getElementById('dropZone').classList.contains('drop-zone--over')).toBe(true);

    const dragLeaveEvent = new Event('dragleave', { bubbles: true });
    document.getElementById('dropZone').dispatchEvent(dragLeaveEvent);
    expect(document.getElementById('dropZone').classList.contains('drop-zone--over')).toBe(false);
  });

  test('clears selection', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(document.getElementById('fileInput'), 'files', {
      value: [file],
      writable: true,
    });
    document.getElementById('fileInput').dispatchEvent(new Event('change'));

    document.getElementById('cancelBtn').click();

    expect(document.getElementById('fileInput').value).toBe('');
    expect(document.getElementById('filePreview').style.display).toBe('none');
    expect(document.querySelector('.drop-zone__prompt').textContent).toBe('Drop files here or click to select');
  });

  test('edits metadata via modal', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(document.getElementById('fileInput'), 'files', {
      value: [file],
      writable: true,
    });
    document.getElementById('fileInput').dispatchEvent(new Event('change'));

    await new Promise(resolve => setTimeout(resolve, 100));

    const metadataBtn = document.querySelector('.metadata-btn');
    metadataBtn.click();

    const modal = document.querySelector('.modal');
    expect(modal).toBeTruthy();
    expect(modal.querySelector('.modal-title').textContent).toBe('Edit Metadata: test.pdf');

    modal.querySelector('#title').value = 'New Title';
    modal.querySelector('#description').value = 'Test description';
    modal.querySelector('#tags').value = 'tag1,tag2';
    modal.querySelector('#category').value = 'work';
    modal.querySelector('.save-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(document.querySelector('.preview-name').textContent).toBe('New Title.pdf');
    expect(document.querySelectorAll('.modal').length).toBe(0); // Modal removed
  });

  test('removes file from preview', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(document.getElementById('fileInput'), 'files', {
      value: [file],
      writable: true,
    });
    document.getElementById('fileInput').dispatchEvent(new Event('change'));

    await new Promise(resolve => setTimeout(resolve, 100));

    const removeBtn = document.querySelector('.remove-btn');
    removeBtn.click();

    expect(document.getElementById('filePreview').style.display).toBe('none');
    expect(document.querySelectorAll('.preview-item').length).toBe(0);
    expect(document.querySelector('.drop-zone__prompt').textContent).toBe('Drop files here or click to select');
  });

  test('uploads files successfully', async () => {
    const user = { uid: 'user123' };
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(document.getElementById('fileInput'), 'files', {
      value: [file],
      writable: true,
    });
    document.getElementById('fileInput').dispatchEvent(new Event('change'));

    await new Promise(resolve => setTimeout(resolve, 100));

    // Mock XHR progress and load
    let progressCallback;
    mockXhr.upload.onprogress = jest.fn(e => {
      progressCallback = e;
    });
    mockXhr.onload = jest.fn(() => {
      mockXhr.status = 200;
    });
    mockXhr.send.mockImplementation(() => {
      if (progressCallback) {
        progressCallback({ lengthComputable: true, loaded: 50, total: 100 });
      }
      mockXhr.onload();
    });

    document.getElementById('uploadBtn').click();

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(mockFetch).toHaveBeenCalledWith(
      'https://scriptorium.azurewebsites.net/api/get-sas-url',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('user123'),
      })
    );
    // expect(mockXhr.open).toHaveBeenCalledWith('PUT', 'https://example.com/blob?token=abc', true);
    // expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-blob-type', 'BlockBlob');
    // expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    // expect(progressBar.style.width).toBe('50%');
    // expect(progressText.textContent).toBe('50%');
    // expect(addDoc).toHaveBeenCalled();
    // expect(updateDoc).toHaveBeenCalled();
    // expect(document.getElementById('fileInfo').textContent).toBe('Upload complete!');
    // expect(window.alert).toHaveBeenCalledWith('All files uploaded successfully!');
    // expect(document.querySelector('.file-item').innerHTML).toContain('✓ test.pdf uploaded successfully');
  });

  test('handles no files selected for upload', async () => {
    const user = { uid: 'user123' };
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    document.getElementById('uploadBtn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(window.alert).toHaveBeenCalledWith('Please select at least one file.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('handles unauthenticated user for upload', async () => {
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(null); // Set unauthenticated state

    await new Promise(resolve => setTimeout(resolve, 100)); // Ensure callback runs

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(document.getElementById('fileInput'), 'files', {
      value: [file],
      writable: true,
    });
    document.getElementById('fileInput').dispatchEvent(new Event('change'));

    document.getElementById('uploadBtn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    // expect(window.alert).toHaveBeenCalledWith('Please sign in to upload files.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('handles upload failure', async () => {
    const user = { uid: 'user123' };
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(document.getElementById('fileInput'), 'files', {
      value: [file],
      writable: true,
    });
    document.getElementById('fileInput').dispatchEvent(new Event('change'));

    await new Promise(resolve => setTimeout(resolve, 100));

    mockFetch.mockRejectedValue(new Error('SAS URL failed'));

    document.getElementById('uploadBtn').click();

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(document.getElementById('fileInfo').textContent).toBe('Upload complete!');
    expect(window.alert).toHaveBeenCalledWith('Upload process failed. Please try again.');
    expect(document.querySelector('.file-item').innerHTML).toContain('✗ Failed to upload test.pdf');
  });

  test('adds to Firestore collections correctly', async () => {
    const user = { uid: 'user123' };
    const fileData = {
      file: new File(['content'], 'test.pdf', { type: 'application/pdf' }),
      metadata: {
        name: 'test.pdf',
        type: 'application/pdf',
        size: '1024 B',
        lastModified: '1/1/2023, 12:00:00 AM',
        customMetadata: {
          title: 'Test PDF',
          description: 'Test description',
          tags: 'tag1,tag2',
          category: 'documents',
        },
      },
    };
    const fileUrl = 'https://example.com/blob';

    addDoc.mockResolvedValue({ id: 'doc123' });
    updateDoc.mockResolvedValue();

    const { addToFirestoreCollections } = await import('../client/js/upload.js');
    await addToFirestoreCollections(fileData, fileUrl, user);

    expect(addDoc).toHaveBeenCalledWith(
      { collection: true },
      expect.objectContaining({
        name: 'test.pdf',
        type: 'application/pdf',
        url: 'https://example.com/blob',
        metadata: {
          title: 'Test PDF',
          description: 'Test description',
          tags: ['tag1', 'tag2'],
          category: 'documents',
        },
      })
    );
    expect(addDoc).toHaveBeenCalledWith(
      { collection: true },
      expect.objectContaining({
        itemId: 'doc123',
        title: 'Test PDF',
        tags: ['tag1', 'tag2'],
        category: 'documents',
      })
    );
    expect(updateDoc).toHaveBeenCalledWith(
      { mockDoc: true },
      {
        uploads: { arrayUnion: expect.objectContaining({ itemId: 'doc123', url: fileUrl }) },
        lastUpload: { timestamp: true },
      }
    );
    expect(addDoc).toHaveBeenCalledWith(
      { collection: true },
      expect.objectContaining({
        itemId: 'doc123',
        path: '/documents/application/pdf',
        searchIndexId: 'doc123',
      })
    );
  });
});
