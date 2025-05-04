// tests/viewupload.test.js
import { jest } from '@jest/globals';

// Mock Firebase App
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js', () => ({
  initializeApp: jest.fn(),
}), { virtual: true });

// Mock Firebase Auth
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js', () => ({
  getAuth: jest.fn(() => ({ mockAuth: true })),
}), { virtual: true });

// Mock Firebase Firestore
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(() => ({ collection: true })),
  query: jest.fn(() => ({ query: true })),
  where: jest.fn(() => ({ where: true })),
  getDocs: jest.fn(),
  doc: jest.fn(() => ({ mockDoc: true })),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ timestamp: true })),
  arrayUnion: jest.fn(x => ({ arrayUnion: x })),
}), { virtual: true });

// Mock firebase.js
jest.mock('../client/js/firebase.js', () => ({
  auth: {
    mockAuth: true,
    currentUser: null,
    onAuthStateChanged: jest.fn(),
  },
  db: { mockDb: true },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock XMLHttpRequest
const mockXhr = {
  upload: { onprogress: null },
  onload: null,
  onerror: null,
  open: jest.fn(),
  setRequestHeader: jest.fn(),
  send: jest.fn(),
  status: 200,
};
global.XMLHttpRequest = jest.fn(() => mockXhr);

// Mock window.alert and window.confirm
jest.spyOn(window, 'alert').mockImplementation(() => {});
jest.spyOn(window, 'confirm').mockImplementation(() => true);

// Mock DOM
beforeAll(() => {
  document.body.innerHTML = `
    <div id="files-container"></div>
    <div id="directory-breadcrumbs">
      <button class="breadcrumb" data-path="">Home</button>
    </div>
    <button id="create-folder-btn">Create Folder</button>
    <button id="upload-file-btn">Upload File</button>
    <div id="folder-modal" style="display: none;">
      <form id="folder-form">
        <input id="folder-name" />
        <button type="submit">Create</button>
        <button id="cancel-folder">Cancel</button>
      </form>
    </div>
    <div id="edit-modal" style="display: none;">
      <form id="edit-form">
        <input id="edit-title" />
        <textarea id="edit-description"></textarea>
        <input id="edit-tags" />
        <select id="edit-category">
          <option value="general">General</option>
          <option value="work">Work</option>
        </select>
        <button type="submit">Save</button>
        <button id="cancel-edit">Cancel</button>
      </form>
    </div>
    <div id="move-modal" style="display: none;">
      <form id="move-form">
        <span id="current-folder"></span>
        <select id="target-folder">
          <option value="">Home (Root Folder)</option>
          <option value="TargetFolder/">TargetFolder</option>
        </select>
        <button type="submit">Move</button>
        <button id="cancel-move">Cancel</button>
      </form>
    </div>
    <div id="rename-folder-modal" style="display: none;">
      <form id="rename-folder-form">
        <input id="new-folder-name" />
        <button type="submit">Rename</button>
        <button id="cancel-rename-folder">Cancel</button>
      </form>
    </div>
  `;
});

describe('ViewUpload Module', () => {
  let getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    serverTimestamp,
    arrayUnion,
    auth;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.resetModules();

    // Extract mocks
    ({
      getDocs,
      addDoc,
      updateDoc,
      deleteDoc,
      getDoc,
      serverTimestamp,
      arrayUnion,
    } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js'));
    ({ auth } = require('../client/js/firebase.js'));

    // Reset DOM
    document.getElementById('files-container').innerHTML = '';
    document.getElementById('directory-breadcrumbs').innerHTML = '<button class="breadcrumb" data-path="">Home</button>';
    document.getElementById('folder-modal').style.display = 'none';
    document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('move-modal').style.display = 'none';
    document.getElementById('rename-folder-modal').style.display = 'none';
    mockXhr.status = 200;

    // Mock fetch response
    mockFetch.mockImplementation(url => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(url.includes('get-sas-url') ? { sasUrl: 'https://example.com/blob?token=abc' } : {}),
      text: () => Promise.resolve(''),
    }));

    // Mock Firestore responses
    addDoc.mockResolvedValue({ id: 'doc123' });
    updateDoc.mockResolvedValue();
    deleteDoc.mockResolvedValue();
    getDoc.mockImplementation(() => Promise.resolve({
      exists: () => false,
      data: () => ({}),
    }));
    getDocs.mockImplementation(() => Promise.resolve({
      empty: true,
      docs: [],
      forEach: (fn) => [],
    }));

    // Mock File constructor
    global.File = jest.fn((buffer, name, options) => ({
      name,
      type: options.type,
      size: buffer[0]?.size || 1024,
      lastModified: Date.now(),
    }));

    // Reset auth.currentUser
    auth.currentUser = null;

    // Import ViewUpload.js and trigger DOMContentLoaded
    await import('../client/js/ViewUpload.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('displays sign-in message for unauthenticated user', async () => {
    const callback = auth.onAuthStateChanged.mock.calls[0][0];
    callback(null);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(document.getElementById('files-container').innerHTML).toBe(
      '<p class="auth-message">Please sign in to view your files</p>'
    );
  }, 10000);

  test('displays files and folders for authenticated user', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = auth.onAuthStateChanged.mock.calls[0][0];
    callback(user);

    // Mock Firestore data
    getDocs
      .mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'folder1',
          data: () => ({
            name: 'TestFolder',
            fullPath: 'TestFolder/',
            createdAt: { toDate: () => new Date('2023-01-01') },
            ownerId: 'user123',
            path: '',
          }),
        }],
        forEach: function (fn) {
          this.docs.forEach(fn);
        },
      }) // Folders
      .mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'file1',
          data: () => ({
            name: 'test.pdf',
            type: 'application/pdf',
            size: 1024,
            url: 'https://example.com/test.pdf',
            uploadedAt: { toDate: () => new Date('2023-01-01') },
            path: '',
            uploadedBy: 'user123',
            metadata: { title: 'Test PDF', description: '', tags: [], category: 'general' },
          }),
        }],
        forEach: function (fn) {
          this.docs.forEach(fn);
        },
      }); // Files

    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    const container = document.getElementById('files-container');
    expect(container.querySelectorAll('.folder-card').length).toBe(1);
    expect(container.querySelector('.folder-card h3').textContent).toBe('TestFolder');
    expect(container.querySelectorAll('.file-card').length).toBe(1);
    expect(container.querySelector('.file-card h3').textContent).toBe('Test PDF');
  }, 10000);

  test('uploads file successfully', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = auth.onAuthStateChanged.mock.calls[0][0];
    callback(user);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Ensure fileInput exists
    let fileInput = document.getElementById('fileInput');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'fileInput';
      fileInput.multiple = true;
      fileInput.className = 'drop-zone__input';
      document.body.appendChild(fileInput);
    }

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const fileList = {
      0: file,
      length: 1,
      item: index => fileList[index],
      [Symbol.iterator]: function* () {
        yield file;
      },
    };
    Object.defineProperty(fileInput, 'files', {
      value: fileList,
      writable: true,
    });

    // Mock XHR
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

    // Trigger file selection
    fileInput.dispatchEvent(new Event('change'));

    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://scriptorium.azurewebsites.net/api/get-sas-url',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('user123'),
      })
    );
    expect(mockXhr.open).toHaveBeenCalledWith('PUT', 'https://example.com/blob?token=abc', true);
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-blob-type', 'BlockBlob');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(addDoc).toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('Files uploaded successfully!');
  }, 10000);

  test('handles unauthenticated file upload', async () => {
    const callback = auth.onAuthStateChanged.mock.calls[0][0];
    callback(null);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Ensure fileInput exists
    let fileInput = document.getElementById('fileInput');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'fileInput';
      fileInput.multiple = true;
      fileInput.className = 'drop-zone__input';
      document.body.appendChild(fileInput);
    }

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const fileList = {
      0: file,
      length: 1,
      item: index => fileList[index],
      [Symbol.iterator]: function* () {
        yield file;
      },
    };
    Object.defineProperty(fileInput, 'files', {
      value: fileList,
      writable: true,
    });

    fileInput.dispatchEvent(new Event('change'));

    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    expect(window.alert).toHaveBeenCalledWith('Please sign in to upload files.');
    expect(mockFetch).not.toHaveBeenCalled();
  }, 10000);

  test('creates folder', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = auth.onAuthStateChanged.mock.calls[0][0];
    callback(user);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    document.getElementById('create-folder-btn').click();
    document.getElementById('folder-name').value = 'NewFolder';
    document.getElementById('folder-form').dispatchEvent(new Event('submit'));

    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    expect(addDoc).toHaveBeenCalledWith(
      { collection: true },
      expect.objectContaining({
        name: 'NewFolder',
        path: '',
        fullPath: 'NewFolder/',
        ownerId: 'user123',
      })
    );
    expect(document.getElementById('folder-modal').style.display).toBe('none');
  }, 10000);

  test('edits file metadata', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = auth.onAuthStateChanged.mock.calls[0][0];
    callback(user);

    // Add file card
    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="file-card" data-doc-id="file1">
        <section class="file-icon">📕</section>
        <section class="file-details">
          <h3>Test PDF</h3>
          <button class="edit-btn" data-doc-id="file1" data-title="Test PDF" data-description="" data-tags="" data-category="general">Edit</button>
        </section>
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Simulate edit button click
    const editBtn = document.querySelector('.edit-btn');
    editBtn.click();

    const form = document.getElementById('edit-form');
    form.dataset.docId = 'file1';
    document.getElementById('edit-title').value = 'New Title';
    document.getElementById('edit-description').value = 'New Description';
    document.getElementById('edit-tags').value = 'tag1,tag2';
    document.getElementById('edit-category').value = 'work';
    form.dispatchEvent(new Event('submit'));

    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    expect(updateDoc).toHaveBeenCalledWith(
      { mockDoc: true },
      {
        metadata: {
          title: 'New Title',
          description: 'New Description',
          tags: ['tag1', 'tag2'],
          category: 'work',
        },
      }
    );
    expect(document.getElementById('edit-modal').style.display).toBe('none');
  }, 10000);

  test('deletes file', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = auth.onAuthStateChanged.mock.calls[0][0];
    callback(user);

    // Mock getDoc for file
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        url: 'https://example.com/test.pdf',
        uploadedBy: 'user123',
      }),
    });

    // Mock getDocs for searchIndex and archiveCollections
    getDocs
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] }) // searchIndex
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] }); // archiveCollections

    // Add file card
    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="file-card" data-doc-id="file1">
        <section class="file-icon">📕</section>
        <section class="file-details">
          <h3>Test PDF</h3>
          <button class="delete-btn" data-doc-id="file1" data-blob-name="test.pdf">Delete</button>
        </section>
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Simulate delete button click
    const deleteBtn = document.querySelector('.delete-btn');
    deleteBtn.click();

    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/delete-blob',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobName: 'test.pdf' }),
      })
    );
    expect(deleteDoc).toHaveBeenCalledWith({ mockDoc: true });
  }, 10000);

  test('navigates to folder', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = auth.onAuthStateChanged.mock.calls[0][0];
    callback(user);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Simulate breadcrumb click
    const breadcrumb = document.createElement('button');
    breadcrumb.className = 'breadcrumb';
    breadcrumb.dataset.path = 'TestFolder/';
    document.getElementById('directory-breadcrumbs').appendChild(breadcrumb);
    breadcrumb.click();

    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    expect(document.getElementById('directory-breadcrumbs').children.length).toBe(2);
    expect(document.getElementById('directory-breadcrumbs').lastChild.textContent).toBe('TestFolder');
  }, 10000);

  test('moves file to another folder', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = auth.onAuthStateChanged.mock.calls[0][0];
    callback(user);

    // Mock Firestore data for available folders
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'folder1',
        data: () => ({
          name: 'TargetFolder',
          fullPath: 'TargetFolder/',
          ownerId: 'user123',
        }),
      }],
      forEach: function (fn) {
        this.docs.forEach(fn);
      },
    });

    // Add file card
    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="file-card" data-doc-id="file1">
        <section class="file-icon">📕</section>
        <section class="file-details">
          <h3>Test PDF</h3>
          <button class="move-btn" data-doc-id="file1" data-current-path="">Move</button>
        </section>
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Simulate move button click
    const moveBtn = document.querySelector('.move-btn');
    moveBtn.click();

    const form = document.getElementById('move-form');
    form.dataset.docId = 'file1';
    document.getElementById('target-folder').value = 'TargetFolder/';
    console.log('target-folder value:', document.getElementById('target-folder').value);
    form.dispatchEvent(new Event('submit'));

    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    expect(updateDoc).toHaveBeenCalledWith(
      { mockDoc: true },
      { path: 'TargetFolder/' }
    );
    expect(document.getElementById('move-modal').style.display).toBe('none');
    expect(window.alert).toHaveBeenCalledWith('File moved successfully!');
  }, 10000);

  test('renames folder', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = auth.onAuthStateChanged.mock.calls[0][0];
    callback(user);

    // Mock getDoc for folder
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: 'TestFolder',
        fullPath: 'TestFolder/',
        path: '',
      }),
    });

    // Mock getDocs for files and subfolders
    getDocs
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] }) // archiveItems
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] }); // folders

    // Add folder card
    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="folder-card" data-path="TestFolder/" data-folder-id="folder1">
        <section class="folder-icon">📁</section>
        <section class="folder-details">
          <h3>TestFolder</h3>
          <button class="rename-folder-btn" data-folder-id="folder1" data-current-name="TestFolder">Rename</button>
        </section>
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Simulate rename button click
    const renameBtn = document.querySelector('.rename-folder-btn');
    renameBtn.click();

    const form = document.getElementById('rename-folder-form');
    form.dataset.folderId = 'folder1';
    document.getElementById('new-folder-name').value = 'NewFolder';
    form.dispatchEvent(new Event('submit'));

    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    expect(updateDoc).toHaveBeenCalledWith(
      { mockDoc: true },
      {
        name: 'NewFolder',
        fullPath: 'NewFolder/',
        updatedAt: { timestamp: true },
      }
    );
    expect(document.getElementById('rename-folder-modal').style.display).toBe('none');
    expect(window.alert).toHaveBeenCalledWith('Folder renamed successfully!');
  }, 10000);

  test('deletes folder', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = auth.onAuthStateChanged.mock.calls[0][0];
    callback(user);

    // Mock Firestore data
    getDocs
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] }) // Files in folder
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] }); // Subfolders
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ fullPath: 'TestFolder/', path: '' }),
    });

    // Add folder card
    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="folder-card" data-path="TestFolder/" data-folder-id="folder1">
        <section class="folder-icon">📁</section>
        <section class="folder-details">
          <h3>TestFolder</h3>
          <button class="delete-folder-btn" data-folder-id="folder1">Delete</button>
        </section>
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Simulate delete folder button click
    const deleteBtn = document.querySelector('.delete-folder-btn');
    deleteBtn.click();

    jest.advanceTimersByTime(3000);
    await Promise.resolve();

    expect(deleteDoc).toHaveBeenCalledWith({ mockDoc: true });
    expect(window.alert).toHaveBeenCalledWith('Folder and all contents deleted successfully!');
  }, 10000);
});