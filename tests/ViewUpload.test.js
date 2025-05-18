// tests/ViewUpload.test.js
import { jest } from '@jest/globals';

// Mock Firebase App
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js', () => ({
  initializeApp: jest.fn(),
}), { virtual: true });

// Mock Firebase Auth
const mockAuth = {
  getAuth: jest.fn(() => ({ mockAuth: true })),
  onAuthStateChanged: jest.fn(),
};
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js', () => mockAuth, { virtual: true });

// Mock Firebase Firestore
const mockFirestore = {
  getFirestore: jest.fn(),
  collection: jest.fn(() => ({ collection: true })),
  query: jest.fn(() => ({ query: true })),
  where: jest.fn(() => ({ where: true })),
  getDocs: jest.fn(),
  doc: jest.fn(() => ({ mockDoc: true, ref: { id: 'mockDoc' } })),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ timestamp: true })),
  arrayUnion: jest.fn(x => ({ arrayUnion: x })),
};
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => mockFirestore, { virtual: true });

// Mock firebase.js
const mockFirebase = {
  auth: { mockAuth: true, currentUser: null },
  db: { mockDb: true },
};
jest.mock('../client/js/firebase.js', () => mockFirebase);

// Mock utils.mjs
jest.mock('../client/js/utils.mjs', () => ({
  formatFileSize: jest.fn().mockImplementation(bytes => {
    if (typeof bytes !== 'number') return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }),
  detectFileType: jest.fn().mockReturnValue('default'),
  getFileIcon: jest.fn().mockReturnValue('📄'),
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

// Define upload.js mock logic
const mockInitializeUpload = jest.fn(() => {
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', async (event) => {
      const files = event.target.files;
      if (!files.length) return;
      const { auth } = require('../client/js/firebase.js');
      if (!auth.currentUser) {
        window.alert('Please sign in to upload files.');
        return;
      }
      try {
        const response = await fetch('https://scriptorium.azurewebsites.net/api/get-sas-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: auth.currentUser.uid }),
        });
        const { sasUrl } = await response.json();
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sasUrl, true);
        xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
        xhr.setRequestHeader('Content-Type', files[0].type);
        xhr.send(files[0]);
        return new Promise((resolve, reject) => {
          xhr.onload = () => resolve();
          xhr.onerror = () => reject(new Error('Network error'));
        });
      } catch (error) {
        window.alert(`Error uploading files: ${error.message}`);
      }
    });
  }
});

// Mock upload.js
jest.mock('../client/js/upload.js', () => ({
  initializeUpload: mockInitializeUpload,
}));

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
    <div id="upload-modal" style="display: none;"></div>
    <input type="file" id="fileInput" multiple class="drop-zone__input">
  `;
});

describe('ViewUpload Module', () => {
  let onAuthStateChanged, getDocs, addDoc, updateDoc, deleteDoc, getDoc, serverTimestamp, arrayUnion, auth;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.resetModules();

    // Extract mocks
    ({ onAuthStateChanged } = mockAuth);
    ({ getDocs, addDoc, updateDoc, deleteDoc, getDoc, serverTimestamp, arrayUnion } = mockFirestore);
    ({ auth } = mockFirebase);

    // Mock window.alert and window.confirm
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    jest.spyOn(window, 'confirm').mockImplementation(() => true);

    // Reset DOM
    document.getElementById('files-container').innerHTML = '';
    document.getElementById('directory-breadcrumbs').innerHTML = '<button class="breadcrumb" data-path="">Home</button>';
    document.getElementById('folder-modal').style.display = 'none';
    document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('move-modal').style.display = 'none';
    document.getElementById('rename-folder-modal').style.display = 'none';
    document.getElementById('upload-modal').style.display = 'none';
    document.getElementById('folder-name').value = '';
    document.getElementById('edit-title').value = '';
    document.getElementById('edit-description').value = '';
    document.getElementById('edit-tags').value = '';
    document.getElementById('edit-category').value = 'general';
    document.getElementById('new-folder-name').value = '';
    document.getElementById('target-folder').value = '';
    const forms = ['edit-form', 'move-form', 'rename-folder-form'];
    forms.forEach(id => {
      const form = document.getElementById(id);
      if (form) form.dataset.docId = '';
    });
    mockXhr.status = 200;

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

    // Mock fetch response
    mockFetch.mockImplementation(url => Promise.resolve({
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
      forEach: function (fn) {
        this.docs.forEach(fn);
      },
      [Symbol.iterator]: function* () {
        for (const doc of this.docs) {
          yield doc;
        }
      },
    }));

    // Mock File constructor
    global.File = jest.fn((buffer, name, options) => ({
      name,
      type: options.type,
      size: buffer.length ? buffer[0]?.size || 1024 : 1024,
      lastModified: Date.now(),
    }));

    // Reset auth.currentUser
    auth.currentUser = null;

    // Debug setup
    console.log('Mock setup: getDocs', getDocs.mock.calls, 'getDoc', getDoc.mock.calls);

    // Import ViewUpload.js and trigger DOMContentLoaded
    try {
      await import('../client/js/ViewUpload.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      console.log('ViewUpload.js imported successfully');
    } catch (error) {
      console.error('Error importing ViewUpload.js:', error);
    }
    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    // Simulate upload.js initialization
    mockInitializeUpload();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('displays sign-in message for unauthenticated user', async () => {
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(null);

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    const container = document.getElementById('files-container');
    console.log('Unauthenticated container:', container.innerHTML);
    expect(container.innerHTML).toBe('<p class="auth-message">Please sign in to view your files</p>');
  }, 15000);

  test('displays files and folders for authenticated user', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    getDocs
      .mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'folder1',
          exists: () => true,
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
        [Symbol.iterator]: function* () {
          for (const doc of this.docs) {
            yield doc;
          }
        },
      })
      .mockResolvedValueOnce({
        empty: false,
        docs: [{
          id: 'file1',
          exists: () => true,
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
        [Symbol.iterator]: function* () {
          for (const doc of this.docs) {
            yield doc;
          }
        },
      });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    });

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    const container = document.getElementById('files-container');
    console.log('Authenticated container:', container.innerHTML);
    expect(container.querySelectorAll('.folder-card').length).toBe(1);
    expect(container.querySelector('.folder-card .name').textContent).toBe('TestFolder');
    expect(container.querySelectorAll('.file-card').length).toBe(1);
    expect(container.querySelector('.file-card .name').textContent).toBe('Test PDF');
  }, 15000);

  test('uploads file successfully', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const fileInput = document.getElementById('fileInput');
    const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
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

    fileInput.dispatchEvent(new Event('change'));

    jest.advanceTimersByTime(5000);
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
  }, 15000);

  test('handles unauthenticated file upload', async () => {
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(null);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const fileInput = document.getElementById('fileInput');
    const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
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

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(window.alert).toHaveBeenCalledWith('Please sign in to upload files.');
    expect(mockFetch).not.toHaveBeenCalled();
  }, 15000);

  test('handles upload failure', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const fileInput = document.getElementById('fileInput');
    const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
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

    mockXhr.onerror = jest.fn();
    mockXhr.send.mockImplementation(() => {
      mockXhr.onerror();
    });

    fileInput.dispatchEvent(new Event('change'));

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalled();
    expect(mockXhr.open).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Error uploading files: Network error'));
  }, 15000);

  test('creates folder', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    console.log('auth.currentUser before click:', auth.currentUser);
    document.getElementById('create-folder-btn').click();
    document.getElementById('folder-name').value = 'NewFolder';
    console.log('auth.currentUser before submit:', auth.currentUser);
    auth.currentUser = user; // Ensure auth.currentUser persists
    document.getElementById('folder-form').dispatchEvent(new Event('submit'));

    jest.advanceTimersByTime(5000);
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
  }, 15000);

  test('handles empty folder name', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    document.getElementById('create-folder-btn').click();
    document.getElementById('folder-name').value = '';
    document.getElementById('folder-form').dispatchEvent(new Event('submit'));

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(addDoc).not.toHaveBeenCalled();
    expect(document.getElementById('folder-modal').style.display).toBe('block');
  }, 15000);

  test('edits file metadata', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="file-card" data-doc-id="file1">
        <section class="file-folder-row">
          <p class="icon">📕</p>
          <p class="name">Test PDF</p>
          <button class="ellipsis-btn" data-doc-id="file1">⋯</button>
          <section class="file-actions">
            <section class="file-menu hidden" id="menu-file1">
              <button class="edit-btn" 
                data-doc-id="file1" 
                data-title="Test PDF" 
                data-description="" 
                data-tags="" 
                data-category="general">Edit</button>
            </section>
          </section>
        </section>
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const ellipsisBtn = document.querySelector('.ellipsis-btn');
    ellipsisBtn.click();
    const editBtn = document.querySelector('.edit-btn');
    editBtn.click();

    const form = document.getElementById('edit-form');
    form.dataset.docId = 'file1';
    document.getElementById('edit-title').value = 'New Title';
    document.getElementById('edit-description').value = 'New Description';
    document.getElementById('edit-tags').value = 'tag1,tag2';
    document.getElementById('edit-category').value = 'work';
    form.dispatchEvent(new Event('submit'));

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(updateDoc).toHaveBeenCalledWith(
      { mockDoc: true, ref: { id: 'mockDoc' } },
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
  }, 15000);

  test('deletes file', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        url: 'https://example.com/test.pdf',
        uploadedBy: 'user123',
      }),
    });
    getDocs
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] })
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] });

    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="file-card" data-doc-id="file1">
        <section class="file-folder-row">
          <p class="icon">📕</p>
          <p class="name">Test PDF</p>
          <button class="ellipsis-btn" data-doc-id="file1">⋯</button>
          <section class="file-actions">
            <section class="file-menu hidden" id="menu-file1">
              <button class="delete-btn" data-doc-id="file1" data-blob-name="test.pdf">Delete</button>
            </section>
          </section>
        </section>
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const ellipsisBtn = document.querySelector('.ellipsis-btn');
    ellipsisBtn.click();
    const deleteBtn = document.querySelector('.delete-btn');
    deleteBtn.click();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/delete-blob',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobName: 'test.pdf' }),
      })
    );
    expect(deleteDoc).toHaveBeenCalledWith({ mockDoc: true, ref: { id: 'mockDoc' } });
    expect(window.alert).toHaveBeenCalledWith('File deleted successfully!');
  }, 15000);

  test('navigates to folder', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const breadcrumb = document.createElement('button');
    breadcrumb.className = 'breadcrumb';
    breadcrumb.dataset.path = 'TestFolder/';
    breadcrumb.textContent = 'TestFolder';
    document.getElementById('directory-breadcrumbs').appendChild(breadcrumb);
    breadcrumb.click();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    const breadcrumbs = document.getElementById('directory-breadcrumbs');
    console.log('Breadcrumbs:', breadcrumbs.innerHTML);
    expect(breadcrumbs.children.length).toBe(2);
    expect(breadcrumbs.lastChild.textContent).toBe('TestFolder');
  }, 15000);

  test('navigates to deep folder structure', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Set up initial breadcrumbs for ParentFolder
    const parentBreadcrumb = document.createElement('button');
    parentBreadcrumb.className = 'breadcrumb';
    parentBreadcrumb.dataset.path = 'ParentFolder/';
    parentBreadcrumb.textContent = 'ParentFolder';
    document.getElementById('directory-breadcrumbs').appendChild(parentBreadcrumb);

    const breadcrumb = document.createElement('button');
    breadcrumb.className = 'breadcrumb';
    breadcrumb.dataset.path = 'ParentFolder/ChildFolder/';
    breadcrumb.textContent = 'ChildFolder';
    document.getElementById('directory-breadcrumbs').appendChild(breadcrumb);
    breadcrumb.click();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    const breadcrumbs = document.getElementById('directory-breadcrumbs');
    console.log('Deep breadcrumbs:', breadcrumbs.innerHTML);
    expect(breadcrumbs.children.length).toBe(3);
    expect(breadcrumbs.children[1].textContent).toBe('ParentFolder');
    expect(breadcrumbs.children[2].textContent).toBe('ChildFolder');
  }, 15000);

  test('moves file to another folder', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'folder1',
        exists: () => true,
        data: () => ({
          name: 'TargetFolder',
          fullPath: 'TargetFolder/',
          ownerId: 'user123',
          url: 'https://example.com/targetfolder', // Added url to match ViewUpload.js expectation
        }),
      }],
      forEach: function (fn) {
        this.docs.forEach(fn);
      },
      [Symbol.iterator]: function* () {
        for (const doc of this.docs) {
          yield doc;
        }
      },
    });

    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="file-card" data-doc-id="file1">
        <section class="file-folder-row">
          <p class="icon">📕</p>
          <p class="name">Test PDF</p>
          <button class="ellipsis-btn" data-doc-id="file1">⋯</button>
          <section class="file-actions">
            <section class="file-menu hidden" id="menu-file1">
              <button class="move-btn" data-doc-id="file1" data-current-path="">Move</button>
            </section>
          </section>
        </section>
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const ellipsisBtn = document.querySelector('.ellipsis-btn');
    ellipsisBtn.click();
    const moveBtn = document.querySelector('.move-btn');
    moveBtn.click();

    const form = document.getElementById('move-form');
    form.dataset.docId = 'file1';
    document.getElementById('target-folder').value = 'TargetFolder/';
    console.log('target-folder value:', document.getElementById('target-folder').value);
    form.dispatchEvent(new Event('submit'));

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(updateDoc).toHaveBeenCalledWith(
      { mockDoc: true, ref: { id: 'mockDoc' } },
      { path: 'TargetFolder/' }
    );
    expect(document.getElementById('move-modal').style.display).toBe('none');
    expect(window.alert).toHaveBeenCalledWith('File moved successfully!');
  }, 15000);

  test('renames folder', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: 'TestFolder',
        fullPath: 'TestFolder/',
        path: '',
      }),
    });
    getDocs
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] })
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] });

    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="folder-card" data-path="TestFolder/" data-folder-id="folder1">
        <section class="file-folder-row">
          <p class="icon">📁</p>
          <p class="name">TestFolder</p>
          <button class="ellipsis-btn" data-folder-id="folder1" data-menu-type="folder">⋯</button>
          <section class="folder-actions">
            <section class="file-menu hidden" id="folder-menu-folder1">
              <button class="rename-folder-btn" data-folder-id="folder1" data-current-name="TestFolder">Rename</button>
            </section>
          </section>
        </section>
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const ellipsisBtn = document.querySelector('.ellipsis-btn');
    ellipsisBtn.click();
    const renameBtn = document.querySelector('.rename-folder-btn');
    renameBtn.click();

    const form = document.getElementById('rename-folder-form');
    form.dataset.folderId = 'folder1';
    document.getElementById('new-folder-name').value = 'NewFolder';
    form.dispatchEvent(new Event('submit'));

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(updateDoc).toHaveBeenCalledWith(
      { mockDoc: true, ref: { id: 'mockDoc' } },
      {
        name: 'NewFolder',
        fullPath: 'NewFolder/',
        updatedAt: { timestamp: true },
      }
    );
    expect(document.getElementById('rename-folder-modal').style.display).toBe('none');
    expect(window.alert).toHaveBeenCalledWith('Folder renamed successfully!');
  }, 15000);

  test('deletes folder', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    getDocs
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] })
      .mockResolvedValueOnce({ empty: true, docs: [], forEach: (fn) => [] });
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ fullPath: 'TestFolder/', path: '' }),
    });

    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="folder-card" data-path="TestFolder/" data-folder-id="folder1">
        <section class="file-folder-row">
          <p class="icon">📁</p>
          <p class="name">TestFolder</p>
          <button class="ellipsis-btn" data-folder-id="folder1" data-menu-type="folder">⋯</button>
          <section class="folder-actions">
            <section class="file-menu hidden" id="folder-menu-folder1">
              <button class="delete-folder-btn" data-folder-id="folder1">Delete</button>
            </section>
          </section>
        </section>
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const ellipsisBtn = document.querySelector('.ellipsis-btn');
    ellipsisBtn.click();
    const deleteBtn = document.querySelector('.delete-folder-btn');
    deleteBtn.click();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(deleteDoc).toHaveBeenCalledWith({ mockDoc: true, ref: { id: 'mockDoc' } });
    expect(window.alert).toHaveBeenCalledWith('Folder and all contents deleted successfully!');
  }, 15000);

  test('handles error loading files', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    getDocs.mockRejectedValueOnce(new Error('Firestore error'));

    jest.advanceTimersByTime(10000); // Increased timer to ensure async completion
    await Promise.resolve();

    const container = document.getElementById('files-container');
    console.log('Error container:', container.innerHTML);
    expect(container.innerHTML).toBe('<p class="error-message">Error loading files. Please check console for details.</p>');
  }, 15000);

  test('toggles file menu', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="file-card" data-doc-id="file1">
        <section class="file-folder-row">
          <p class="icon">📕</p>
          <p class="name">Test PDF</p>
          <button class="ellipsis-btn" data-doc-id="file1">⋯</button>
          <section class="file-actions">
            <section class="file-menu hidden" id="menu-file1">
              <button class="edit-btn">Edit</button>
            </section>
          </section>
        </section>
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const ellipsisBtn = document.querySelector('.ellipsis-btn');
    ellipsisBtn.dispatchEvent(new Event('click'));

    const menu = document.getElementById('menu-file1');
    console.log('Menu classList:', menu.classList);
    expect(menu.classList.contains('hidden')).toBe(false);

    ellipsisBtn.dispatchEvent(new Event('click'));
    expect(menu.classList.contains('hidden')).toBe(true);
  }, 15000);
});