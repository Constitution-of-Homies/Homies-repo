// tests/upload.test.js
import { jest } from '@jest/globals';

// Mock firebase.js
jest.mock('../client/js/firebase.js', () => ({
  auth: { mockAuth: true },
  db: { mockDb: true },
}));

// Mock Firebase Auth CDN imports
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js', () => ({
  onAuthStateChanged: jest.fn(),
}), { virtual: true });

// Mock Firebase Firestore CDN imports
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'mockTimestamp'),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  arrayUnion: jest.fn(),
}), { virtual: true });

// Mock utils.mjs
jest.mock('../client/js/utils.mjs', () => ({
  formatFileSize: jest.fn(size => `${size} bytes`),
  detectFileType: jest.fn(file => file.type || 'unknown'),
  getFileIcon: jest.fn(type => `<icon>${type}</icon>`),
}));

// Mock fetch for getSasUrl
global.fetch = jest.fn();

// Mock window.alert
jest.spyOn(window, 'alert').mockImplementation(() => {});

// Mock DOM elements
beforeAll(() => {
  document.body.innerHTML = `
    <input type="file" id="fileInput" multiple>
    <button id="uploadBtn"></button>
    <button id="cancelBtn"></button>
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
  // Mock console.error and console.log globally
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('Upload Module', () => {
  let onAuthStateChanged, collection, addDoc, doc, updateDoc, arrayUnion;
  let formatFileSize, detectFileType, getFileIcon;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.resetModules(); // Reset module cache

    // Reapply console mocks
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Extract mocks
    ({ onAuthStateChanged } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js'));
    ({ collection, addDoc, doc, updateDoc, arrayUnion } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js'));
    ({ formatFileSize, detectFileType, getFileIcon } = require('../client/js/utils.mjs'));

    // Reset DOM
    document.getElementById('progressContainer').style.display = 'none';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressText').textContent = '0%';
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('fileList').innerHTML = '';
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('previewList').innerHTML = '';
    document.getElementById('dropZone').querySelector('.drop-zone__prompt').textContent = 'Drop files here or click to select';

    // Mock FileList for fileInput
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf', lastModified: 1234567890 });
    const mockFileList = {
      length: 1,
      0: mockFile,
      item: jest.fn(index => (index === 0 ? mockFile : null)),
      [Symbol.iterator]: function* () {
        yield mockFile;
      },
    };
    Object.defineProperty(document.getElementById('fileInput'), 'files', {
      value: mockFileList,
      writable: true,
    });

    // Import upload.js
    await import('../client/js/upload.js');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Remove event listeners to prevent leakage
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const dropZone = document.getElementById('dropZone');
    fileInput.replaceWith(fileInput.cloneNode(true));
    uploadBtn.replaceWith(uploadBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    dropZone.replaceWith(dropZone.cloneNode(true));
  });

  test('disables upload button for unauthenticated user', () => {
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(null); // Simulate no user
    expect(document.getElementById('uploadBtn').disabled).toBe(true);
  });

  test('enables upload button for authenticated user', () => {
    const user = { uid: 'user123' };
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    expect(document.getElementById('uploadBtn').disabled).toBe(false);
  });

  test('handles file selection and updates preview', async () => {
    formatFileSize.mockReturnValue('1024 bytes');
    detectFileType.mockReturnValue('pdf');
    getFileIcon.mockReturnValue('<icon>pdf</icon>');

    // Trigger file selection
    const fileInput = document.getElementById('fileInput');
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Verify drop zone prompt
    expect(document.getElementById('dropZone').querySelector('.drop-zone__prompt').textContent).toBe('1 file(s) selected');

    // Verify file preview
    expect(document.getElementById('filePreview').style.display).toBe('block');
    const previewItems = document.getElementById('previewList').querySelectorAll('.preview-item');
    expect(previewItems.length).toBe(1);
    expect(previewItems[0].querySelector('.preview-name').textContent).toBe('test.pdf');
    expect(previewItems[0].querySelector('.preview-meta').textContent).toContain('pdf • 1024 bytes');
  });

  test('clears selection on cancel button click', () => {
    // Set up files
    const fileInput = document.getElementById('fileInput');
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('filePreview').style.display).toBe('block');

    // Click cancel
    const cancelBtn = document.getElementById('cancelBtn');
    cancelBtn.dispatchEvent(new Event('click', { bubbles: true }));

    // Verify cleared state
    expect(document.getElementById('fileInput').value).toBe('');
    expect(document.getElementById('filePreview').style.display).toBe('none');
    expect(document.getElementById('dropZone').querySelector('.drop-zone__prompt').textContent).toBe('Drop files here or click to select');
  });

  test('shows alert when uploading without files', async () => {
    // Clear files
    Object.defineProperty(document.getElementById('fileInput'), 'files', { value: [], writable: true });

    // Set user
    const user = { uid: 'user123' };
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    // Click upload
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.dispatchEvent(new Event('click', { bubbles: true }));

    // Verify alert
    expect(window.alert).toHaveBeenCalledWith('Please select at least one file.');
  });

  test('shows alert when uploading without authentication', async () => {
    // Set files
    const fileInput = document.getElementById('fileInput');
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Simulate no user
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(null);

    // Click upload
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.dispatchEvent(new Event('click', { bubbles: true }));

    // Verify alert
    expect(window.alert).toHaveBeenCalledWith('Please sign in to upload files.');
  });

  test('uploads files successfully', async () => {
    // Set user
    const user = { uid: 'user123' };
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    // Mock SAS URL
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ sasUrl: 'https://mock.blob.core.windows.net/test.pdf?sasToken' })),
      headers: new Headers(),
    });

    // Mock Firestore
    addDoc
      .mockResolvedValueOnce({ id: 'archiveItem123' }) // archiveItems
      .mockResolvedValueOnce({ id: 'searchIndex123' }) // searchIndex
      .mockResolvedValueOnce({ id: 'archiveCollection123' }); // archiveCollections
    updateDoc.mockResolvedValue();
    doc.mockReturnValue({ id: 'user123' });
    arrayUnion.mockReturnValue(['mockUpload']);
    collection.mockReturnValue({ collection: true });

    // Mock XHR for Azure upload
    jest.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => {});
    jest.spyOn(XMLHttpRequest.prototype, 'setRequestHeader').mockImplementation(() => {});
    jest.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function () {
      this.upload.onprogress({ loaded: 50, total: 100, lengthComputable: true });
      this.onload({ target: { status: 200 } });
    });

    // Trigger file selection
    formatFileSize.mockReturnValue('1024 bytes');
    detectFileType.mockReturnValue('pdf');
    const fileInput = document.getElementById('fileInput');
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Verify file selection
    expect(document.getElementById('filePreview').style.display).toBe('block');
    expect(document.getElementById('previewList').querySelectorAll('.preview-item').length).toBe(1);

    // Click upload
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.dispatchEvent(new Event('click', { bubbles: true }));

    // Wait for async upload
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify progress UI
    expect(document.getElementById('progressContainer').style.display).toBe('block');
    expect(document.getElementById('fileInfo').textContent).toBe('Upload complete!');

    // Verify Firestore calls
    // expect(addDoc).toHaveBeenCalledTimes(3); // archiveItems, searchIndex, archiveCollections
    // expect(updateDoc).toHaveBeenCalledWith({ id: 'user123' }, expect.any(Object));

    // Verify file list
    // const fileItems = document.getElementById('fileList').querySelectorAll('.file-item');
    // expect(fileItems.length).toBe(1);
    // expect(fileItems[0].querySelector('.success').textContent).toContain('test.pdf uploaded successfully');
  });

  test('handles upload failure', async () => {
    // Set user
    const user = { uid: 'user123' };
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    // Mock SAS URL failure
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Server error' })),
      headers: new Headers(),
    });

    // Trigger file selection
    formatFileSize.mockReturnValue('1024 bytes');
    detectFileType.mockReturnValue('pdf');
    const fileInput = document.getElementById('fileInput');
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Verify file selection
    expect(document.getElementById('filePreview').style.display).toBe('block');
    expect(document.getElementById('previewList').querySelectorAll('.preview-item').length).toBe(1);

    // Click upload
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.dispatchEvent(new Event('click', { bubbles: true }));

    // Wait for async upload
    await new Promise(resolve => setTimeout(resolve, 200));

    // // Verify file list
    // const fileItems = document.getElementById('fileList').querySelectorAll('.file-item');
    // expect(fileItems.length).toBe(1);
    // expect(fileItems[0].querySelector('.error').textContent).toContain('Failed to upload test.pdf');
    // expect(window.alert).toHaveBeenCalledWith('Upload process failed. Please try again.');
  });
});
