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

// Mock utils.mjs (not used in the updated ViewUpload.js)
jest.mock('../client/js/utils.mjs', () => ({}));

// Mock upload.js
const mockInitializeUpload = jest.fn();
const mockSetUploadPath = jest.fn();
jest.mock('../client/js/upload.js', () => ({
  initializeUpload: mockInitializeUpload,
  setUploadPath: mockSetUploadPath,
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

    // Mock console.error and console.log
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});

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

    // Import ViewUpload.js and trigger DOMContentLoaded
    try {
      await import('../client/js/ViewUpload.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
    } catch (error) {
      console.error('Error importing ViewUpload.js:', error);
    }
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
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
    expect(container.querySelectorAll('.folder-card').length).toBe(1);
    expect(container.querySelector('.folder-card .name').textContent).toBe('TestFolder');
    expect(container.querySelectorAll('.file-card').length).toBe(1);
    expect(container.querySelector('.file-card .name').textContent).toBe('Test PDF');
  }, 15000);

  describe('handleFileUpload', () => {
    let handleFileUpload, displayFiles;

    beforeEach(async () => {
      const module = await import('../client/js/ViewUpload.js');
      handleFileUpload = module.handleFileUpload;
      displayFiles = jest.spyOn(module, 'displayFiles').mockResolvedValue();
    });

    test('successfully uploads a single file', async () => {
      const user = { uid: 'user123' };
      auth.currentUser = user;
      const callback = onAuthStateChanged.mock.calls[0][1];
      callback(user);

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

      mockXhr.onload = jest.fn(() => {
        mockXhr.status = 200;
      });
      mockXhr.send.mockImplementation(() => {
        mockXhr.onload();
      });

      await handleFileUpload(fileList, user.uid);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://scriptorium.azurewebsites.net/api/get-sas-url',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"blobName":"user123/'),
        })
      );
      expect(mockXhr.open).toHaveBeenCalledWith('PUT', 'https://example.com/blob?token=abc', true);
      expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-blob-type', 'BlockBlob');
      expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(addDoc).toHaveBeenCalledWith(
        { collection: true },
        expect.objectContaining({
          name: 'test.pdf',
          type: 'pdf',
          size: 1024,
          url: 'https://example.com/blob',
          uploadedBy: 'user123',
          path: '',
          metadata: {
            title: 'test.pdf',
            description: '',
            tags: [],
            category: 'general',
          },
        })
      );
      expect(updateDoc).toHaveBeenCalledWith(
        { mockDoc: true, ref: { id: 'mockDoc' } },
        expect.objectContaining({
          uploads: expect.any(Object),
          lastUpload: { timestamp: true },
        })
      );
      expect(displayFiles).toHaveBeenCalledWith(user.uid);
      expect(window.alert).toHaveBeenCalledWith('Files uploaded successfully!');
      expect(fileInput.value).toBe('');
    }, 15000);

    test('successfully uploads multiple files', async () => {
      const user = { uid: 'user123' };
      auth.currentUser = user;
      const callback = onAuthStateChanged.mock.calls[0][1];
      callback(user);

      const file1 = new File([new ArrayBuffer(1024)], 'test1.pdf', { type: 'application/pdf' });
      const file2 = new File([new ArrayBuffer(2048)], 'test2.png', { type: 'image/png' });
      const fileList = {
        0: file1,
        1: file2,
        length: 2,
        item: index => [file1, file2][index],
        [Symbol.iterator]: function* () {
          yield file1;
          yield file2;
        },
      };

      mockXhr.onload = jest.fn(() => {
        mockXhr.status = 200;
      });
      mockXhr.send.mockImplementation(() => {
        mockXhr.onload();
      });

      await handleFileUpload(fileList, user.uid);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockXhr.open).toHaveBeenCalledTimes(2);
      expect(addDoc).toHaveBeenCalledTimes(2);
      expect(addDoc).toHaveBeenCalledWith(
        { collection: true },
        expect.objectContaining({ name: 'test1.pdf', type: 'pdf', size: 1024 })
      );
      expect(addDoc).toHaveBeenCalledWith(
        { collection: true },
        expect.objectContaining({ name: 'test2.png', type: 'image', size: 2048 })
      );
      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(displayFiles).toHaveBeenCalledWith(user.uid);
      expect(window.alert).toHaveBeenCalledWith('Files uploaded successfully!');
    }, 15000);

    test('handles empty file list', async () => {
      const user = { uid: 'user123' };
      auth.currentUser = user;
      const callback = onAuthStateChanged.mock.calls[0][1];
      callback(user);

      const fileList = {
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      };

      await handleFileUpload(fileList, user.uid);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockXhr.open).not.toHaveBeenCalled();
      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
      expect(displayFiles).not.toHaveBeenCalled();
      expect(window.alert).not.toHaveBeenCalled();
    }, 15000);

    test('handles unauthenticated user', async () => {
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

      await handleFileUpload(fileList, null);

      expect(window.alert).toHaveBeenCalledWith('Please sign in to upload files.');
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockXhr.open).not.toHaveBeenCalled();
      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
      expect(displayFiles).not.toHaveBeenCalled();
    }, 15000);

    test('handles getSasUrl failure', async () => {
      const user = { uid: 'user123' };
      auth.currentUser = user;
      const callback = onAuthStateChanged.mock.calls[0][1];
      callback(user);

      const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
      const fileList = {
        0: file,
        length: 1,
        item: index => fileList[index],
        [Symbol.iterator]: function* () {
          yield file;
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid blob name' }),
        text: () => Promise.resolve('Bad Request'),
      });

      await handleFileUpload(fileList, user.uid);

      expect(mockFetch).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error uploading files:', expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Error uploading files: Failed to get SAS URL: Invalid blob name'));
      expect(mockXhr.open).not.toHaveBeenCalled();
      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    }, 15000);

    test('handles uploadToAzure failure', async () => {
      const user = { uid: 'user123' };
      auth.currentUser = user;
      const callback = onAuthStateChanged.mock.calls[0][1];
      callback(user);

      const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
      const fileList = {
        0: file,
        length: 1,
        item: index => fileList[index],
        [Symbol.iterator]: function* () {
          yield file;
        },
      };

      mockXhr.onerror = jest.fn();
      mockXhr.send.mockImplementation(() => {
        mockXhr.onerror();
      });

      await handleFileUpload(fileList, user.uid);

      expect(mockFetch).toHaveBeenCalled();
      expect(mockXhr.open).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error uploading files:', expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Error uploading files: Network error'));
      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    }, 15000);

    test('handles addDoc failure', async () => {
      const user = { uid: 'user123' };
      auth.currentUser = user;
      const callback = onAuthStateChanged.mock.calls[0][1];
      callback(user);

      const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
      const fileList = {
        0: file,
        length: 1,
        item: index => fileList[index],
        [Symbol.iterator]: function* () {
          yield file;
        },
      };

      addDoc.mockRejectedValueOnce(new Error('Firestore error'));

      mockXhr.onload = jest.fn(() => {
        mockXhr.status = 200;
      });
      mockXhr.send.mockImplementation(() => {
        mockXhr.onload();
      });

      await handleFileUpload(fileList, user.uid);

      expect(mockFetch).toHaveBeenCalled();
      expect(mockXhr.open).toHaveBeenCalled();
      expect(addDoc).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error uploading files:', expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Error uploading files: Firestore error'));
      expect(updateDoc).not.toHaveBeenCalled();
    }, 15000);

    test('handles updateDoc failure', async () => {
      const user = { uid: 'user123' };
      auth.currentUser = user;
      const callback = onAuthStateChanged.mock.calls[0][1];
      callback(user);

      const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
      const fileList = {
        0: file,
        length: 1,
        item: index => fileList[index],
        [Symbol.iterator]: function* () {
          yield file;
        },
      };

      updateDoc.mockRejectedValueOnce(new Error('Firestore update error'));

      mockXhr.onload = jest.fn(() => {
        mockXhr.status = 200;
      });
      mockXhr.send.mockImplementation(() => {
        mockXhr.onload();
      });

      await handleFileUpload(fileList, user.uid);

      expect(mockFetch).toHaveBeenCalled();
      expect(mockXhr.open).toHaveBeenCalled();
      expect(addDoc).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error uploading files:', expect.any(Error));
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Error uploading files: Firestore update error'));
    }, 15000);

    test('handles file with missing metadata', async () => {
      const user = { uid: 'user123' };
      auth.currentUser = user;
      const callback = onAuthStateChanged.mock.calls[0][1];
      callback(user);

      const file = new File([new ArrayBuffer(1024)], '', { type: '' });
      const fileList = {
        0: file,
        length: 1,
        item: index => fileList[index],
        [Symbol.iterator]: function* () {
          yield file;
        },
      };

      mockXhr.onload = jest.fn(() => {
        mockXhr.status = 200;
      });
      mockXhr.send.mockImplementation(() => {
        mockXhr.onload();
      });

      await handleFileUpload(fileList, user.uid);

      expect(addDoc).toHaveBeenCalledWith(
        { collection: true },
        expect.objectContaining({
          name: '',
          type: 'default',
          size: 1024,
          url: 'https://example.com/blob',
          uploadedBy: 'user123',
          metadata: {
            title: '',
            description: '',
            tags: [],
            category: 'general',
          },
        })
      );
      expect(window.alert).toHaveBeenCalledWith('Files uploaded successfully!');
    }, 15000);
  });

  test('creates folder', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    document.getElementById('create-folder-btn').click();
    document.getElementById('folder-name').value = 'NewFolder';
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
      <section class="file-group-card">
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
      <section class="file-group-card">
        <section class="file-card" data-doc-id="file1">
          <section class="file-folder-row">
            <p class="icon">📕</p>
            <p class="name">Test PDF</p>
            <button class="ellipsis-btn" data-doc-id="file1">⋯</button>
            <section class="file-actions">
              <section class="file-menu hidden" id="menu-file1">
                <button class="delete-btn" data-doc-id="file1" data-blob-name="https://example.com/test.pdf">Delete</button>
              </section>
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
      <section class="file-group-card">
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
      <section class="file-group-card">
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
      <section class="file-group-card">
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

    jest.advanceTimersByTime(10000);
    await Promise.resolve();

    const container = document.getElementById('files-container');
    expect(container.innerHTML).toBe('<p class="error-message">Error loading files. Please check console for details.</p>');
  }, 15000);

  test('toggles file menu', async () => {
    const user = { uid: 'user123' };
    auth.currentUser = user;
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    const container = document.getElementById('files-container');
    container.innerHTML = `
      <section class="file-group-card">
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
      </section>
    `;

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const ellipsisBtn = document.querySelector('.ellipsis-btn');
    ellipsisBtn.dispatchEvent(new Event('click'));

    const menu = document.getElementById('menu-file1');
    expect(menu.classList.contains('hidden')).toBe(false);

    ellipsisBtn.dispatchEvent(new Event('click'));
    expect(menu.classList.contains('hidden')).toBe(true);
  }, 15000);

  describe('Utility Functions', () => {
    const { formatFileSize, detectFileType } = require('../client/js/ViewUpload.js');

    describe('formatFileSize', () => {
      test('returns "Unknown size" for non-numeric input', () => {
        expect(formatFileSize('invalid')).toBe('Unknown size');
        expect(formatFileSize(null)).toBe('Unknown size');
        expect(formatFileSize(undefined)).toBe('Unknown size');
      });

      test('formats bytes correctly (< 1024)', () => {
        expect(formatFileSize(0)).toBe('0 B');
        expect(formatFileSize(500)).toBe('500 B');
        expect(formatFileSize(1023)).toBe('1023 B');
      });

      test('formats kilobytes correctly (1024 to < 1048576)', () => {
        expect(formatFileSize(1024)).toBe('1.0 KB');
        expect(formatFileSize(5120)).toBe('5.0 KB');
        expect(formatFileSize(1048575)).toBe('1024.0 KB');
      });

      test('formats megabytes correctly (1048576 to < 1073741824)', () => {
        expect(formatFileSize(1048576)).toBe('1.0 MB');
        expect(formatFileSize(5242880)).toBe('5.0 MB');
        expect(formatFileSize(1073741823)).toBe('1024.0 MB');
      });

      test('formats gigabytes correctly (>= 1073741824)', () => {
        expect(formatFileSize(1073741824)).toBe('1.0 GB');
        expect(formatFileSize(2147483648)).toBe('2.0 GB');
        expect(formatFileSize(5368709120)).toBe('5.0 GB');
      });
    });

    describe('detectFileType', () => {
      test('detects file type from MIME type', () => {
        const file = {
          type: 'image/png',
          name: 'test.png',
        };
        expect(detectFileType(file)).toBe('image');

        file.type = 'video/mp4';
        file.name = 'test.mp4';
        expect(detectFileType(file)).toBe('video');

        file.type = 'audio/mpeg';
        file.name = 'test.mp3';
        expect(detectFileType(file)).toBe('audio');

        file.type = 'application/pdf';
        file.name = 'test.pdf';
        expect(detectFileType(file)).toBe('pdf');

        file.type = 'application/vnd.ms-excel';
        file.name = 'test.xls';
        expect(detectFileType(file)).toBe('spreadsheet');

        file.type = 'application/vnd.ms-powerpoint';
        file.name = 'test.ppt';
        expect(detectFileType(file)).toBe('presentation');

        file.type = 'application/zip';
        file.name = 'test.zip';
        expect(detectFileType(file)).toBe('archive');

        file.type = 'text/javascript';
        file.name = 'test.js';
        expect(detectFileType(file)).toBe('code');
      });

      test('detects file type from extension when MIME type is empty or generic', () => {
        const file = {
          type: '',
          name: 'test.jpg',
        };
        expect(detectFileType(file)).toBe('image');

        file.name = 'test.mp4';
        expect(detectFileType(file)).toBe('video');

        file.name = 'test.mp3';
        expect(detectFileType(file)).toBe('audio');

        file.name = 'test.pdf';
        expect(detectFileType(file)).toBe('pdf');

        file.name = 'test.xlsx';
        expect(detectFileType(file)).toBe('spreadsheet');

        file.name = 'test.pptx';
        expect(detectFileType(file)).toBe('presentation');

        file.name = 'test.zip';
        expect(detectFileType(file)).toBe('archive');

        file.name = 'test.py';
        expect(detectFileType(file)).toBe('code');
      });

      test('returns first part of MIME type when no match is found', () => {
        const file = {
          type: 'text/plain',
          name: 'test.txt',
        };
        expect(detectFileType(file)).toBe('text');
      });

      test('returns "default" when no MIME type or extension match', () => {
        const file = {
          type: '',
          name: 'test.unknown',
        };
        expect(detectFileType(file)).toBe('default');

        file.type = 'application/octet-stream';
        file.name = 'test.bin';
        expect(detectFileType(file)).toBe('application');
      });

      test('handles case insensitivity', () => {
        const file = {
          type: 'IMAGE/JPEG',
          name: 'test.JPG',
        };
        expect(detectFileType(file)).toBe('image');

        file.type = '';
        file.name = 'test.PDF';
        expect(detectFileType(file)).toBe('pdf');
      });

      test('handles files without name property', () => {
        const file = {
          type: 'image/png',
        };
        expect(detectFileType(file)).toBe('image');

        file.type = 'text/plain';
        expect(detectFileType(file)).toBe('text');
      });
    });

    describe('getSimplifiedType', () => {
      const { getSimplifiedType } = require('../client/js/ViewUpload.js');

      test('returns "default" for falsy input', () => {
        expect(getSimplifiedType('')).toBe('default');
        expect(getSimplifiedType(null)).toBe('default');
        expect(getSimplifiedType(undefined)).toBe('default');
      });

      test('detects simplified type from MIME type', () => {
        expect(getSimplifiedType('image/png')).toBe('image');
        expect(getSimplifiedType('video/mp4')).toBe('video');
        expect(getSimplifiedType('audio/mpeg')).toBe('audio');
        expect(getSimplifiedType('application/pdf')).toBe('pdf');
        expect(getSimplifiedType('application/vnd.ms-excel')).toBe('spreadsheet');
        expect(getSimplifiedType('application/vnd.ms-powerpoint')).toBe('presentation');
        expect(getSimplifiedType('application/zip')).toBe('archive');
        expect(getSimplifiedType('text/javascript')).toBe('code');
      });

      test('handles alternative MIME types for same category', () => {
        expect(getSimplifiedType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('spreadsheet');
        expect(getSimplifiedType('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('presentation');
        expect(getSimplifiedType('application/x-rar-compressed')).toBe('archive');
        expect(getSimplifiedType('application/x-tar')).toBe('archive');
        expect(getSimplifiedType('application/x-7z-compressed')).toBe('archive');
        expect(getSimplifiedType('text/x-python')).toBe('code');
      });

      test('returns first part of MIME type when no match is found', () => {
        expect(getSimplifiedType('text/plain')).toBe('text');
        expect(getSimplifiedType('application/json')).toBe('application');
      });

      test('handles case insensitivity', () => {
        expect(getSimplifiedType('IMAGE/JPEG')).toBe('image');
        expect(getSimplifiedType('VIDEO/MP4')).toBe('video');
        expect(getSimplifiedType('APPLICATION/PDF')).toBe('pdf');
        expect(getSimplifiedType('TEXT/JAVASCRIPT')).toBe('code');
      });

      test('returns "default" for malformed MIME type', () => {
        expect(getSimplifiedType('invalid')).toBe('default');
        expect(getSimplifiedType('/')).toBe('default');
      });
    });
  });
});

describe('getFileIcon', () => {
  const { getFileIcon } = require('../client/js/ViewUpload.js');

  test('returns correct icon for known file types', () => {
    expect(getFileIcon('image')).toBe('🖼️');
    expect(getFileIcon('pdf')).toBe('📕');
    expect(getFileIcon('video')).toBe('🎥');
    expect(getFileIcon('audio')).toBe('🎵');
    expect(getFileIcon('spreadsheet')).toBe('📊');
    expect(getFileIcon('presentation')).toBe('📽️');
    expect(getFileIcon('archive')).toBe('🗃️');
    expect(getFileIcon('code')).toBe('💻');
  });

  test('returns default icon for unknown file types', () => {
    expect(getFileIcon('text')).toBe('📄');
    expect(getFileIcon('application')).toBe('📄');
    expect(getFileIcon('unknown')).toBe('📄');
  });

  test('returns default icon for falsy inputs', () => {
    expect(getFileIcon('')).toBe('📄');
    expect(getFileIcon(null)).toBe('📄');
    expect(getFileIcon(undefined)).toBe('📄');
  });
});

describe('formatDate', () => {
  const { formatDate } = require('../client/js/ViewUpload.js');

  test('formats valid date correctly', () => {
    const date = new Date('2023-01-01T12:00:00Z');
    expect(formatDate(date)).toBe('Jan 1, 2023');

    const date2 = new Date('2025-05-19T14:16:00Z');
    expect(formatDate(date2)).toBe('May 19, 2025');
  });

  test('returns "Unknown date" for falsy inputs', () => {
    expect(formatDate(null)).toBe('Unknown date');
    expect(formatDate(undefined)).toBe('Unknown date');
    expect(formatDate('')).toBe('Unknown date');
    expect(formatDate(0)).toBe('Unknown date');
    expect(formatDate(false)).toBe('Unknown date');
  });

  test('returns "Unknown date" for invalid date', () => {
    const invalidDate = new Date('invalid');
    expect(formatDate(invalidDate)).toBe('Unknown date');
  });
});

describe('filesUploaded event listener', () => {
  let displayFiles;

  beforeEach(async () => {
    // Reset mocks and re-import module to ensure fresh event listener
    jest.resetModules();
    jest.clearAllMocks();

    // Set up auth mock
    mockFirebase.auth.currentUser = null;

    // Import ViewUpload.js to register event listener
    const module = await import('../client/js/ViewUpload.js');
    // Mock displayFiles
    displayFiles = jest.spyOn(module, 'displayFiles').mockResolvedValue();
  });

  afterEach(() => {
    // Clean up event listeners to prevent leakage
    window.removeEventListener('filesUploaded', expect.any(Function));
  });

  test('calls displayFiles for authenticated user', async () => {
    // Set authenticated user
    mockFirebase.auth.currentUser = { uid: 'user123' };

    // Dispatch filesUploaded event
    window.dispatchEvent(new Event('filesUploaded'));

    // Verify displayFiles was called
    expect(displayFiles).toHaveBeenCalledWith('user123');
    expect(displayFiles).toHaveBeenCalledTimes(1);
  });

  test('does not call displayFiles for unauthenticated user', async () => {
    // Ensure no authenticated user
    mockFirebase.auth.currentUser = null;

    // Dispatch filesUploaded event
    window.dispatchEvent(new Event('filesUploaded'));

    // Verify displayFiles was not called
    expect(displayFiles).not.toHaveBeenCalled();
  });
});

describe('uploadToAzure', () => {
  let consoleLogSpy;
  const { uploadToAzure } = require('../client/js/ViewUpload.js');

  beforeEach(() => {
    // Reset mockXhr state
    mockXhr.status = 200;
    mockXhr.onload = null;
    mockXhr.onerror = null;
    mockXhr.upload.onprogress = null;
    mockXhr.open.mockClear();
    mockXhr.setRequestHeader.mockClear();
    mockXhr.send.mockClear();

    // Spy on console.log for progress tracking
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test('successfully uploads file with valid inputs', async () => {
    const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
    const sasUrl = 'https://example.com/blob?token=abc';
    const metadata = {
      title: 'Test PDF',
      description: 'A test file',
      tags: 'test, pdf',
      category: 'general'
    };

    mockXhr.onload = jest.fn(() => {
      mockXhr.status = 200;
    });
    mockXhr.send.mockImplementation(() => {
      mockXhr.onload();
    });

    await expect(uploadToAzure(file, sasUrl, metadata)).resolves.toBeUndefined();

    expect(mockXhr.open).toHaveBeenCalledWith('PUT', sasUrl, true);
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-blob-type', 'BlockBlob');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-meta-title', 'Test PDF');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-meta-description', 'A test file');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-meta-tags', 'test, pdf');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-meta-category', 'general');
    expect(mockXhr.send).toHaveBeenCalledWith(file);
  });

  test('rejects with error on non-2xx status', async () => {
    const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
    const sasUrl = 'https://example.com/blob?token=abc';
    const metadata = {
      title: 'Test PDF',
      description: '',
      tags: '',
      category: 'general'
    };

    mockXhr.onload = jest.fn(() => {
      mockXhr.status = 400;
    });
    mockXhr.send.mockImplementation(() => {
      mockXhr.onload();
    });

    await expect(uploadToAzure(file, sasUrl, metadata)).rejects.toThrow('Upload failed: 400');

    expect(mockXhr.open).toHaveBeenCalledWith('PUT', sasUrl, true);
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-blob-type', 'BlockBlob');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(mockXhr.send).toHaveBeenCalledWith(file);
  });

  test('rejects with error on network failure', async () => {
    const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
    const sasUrl = 'https://example.com/blob?token=abc';
    const metadata = {
      title: 'Test PDF',
      description: '',
      tags: '',
      category: 'general'
    };

    mockXhr.onerror = jest.fn();
    mockXhr.send.mockImplementation(() => {
      mockXhr.onerror();
    });

    await expect(uploadToAzure(file, sasUrl, metadata)).rejects.toThrow('Network error during upload');

    expect(mockXhr.open).toHaveBeenCalledWith('PUT', sasUrl, true);
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-blob-type', 'BlockBlob');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(mockXhr.send).toHaveBeenCalledWith(file);
  });

  test('logs progress for computable upload events', async () => {
    const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
    const sasUrl = 'https://example.com/blob?token=abc';
    const metadata = {
      title: 'Test PDF',
      description: '',
      tags: '',
      category: 'general'
    };

    let progressCallback;
    mockXhr.upload.onprogress = jest.fn((e) => {
      progressCallback = mockXhr.upload.onprogress;
    });
    mockXhr.onload = jest.fn(() => {
      mockXhr.status = 200;
    });
    mockXhr.send.mockImplementation(() => {
      // Simulate progress events
      progressCallback({ lengthComputable: true, loaded: 512, total: 1024 });
      progressCallback({ lengthComputable: true, loaded: 1024, total: 1024 });
      mockXhr.onload();
    });

    await uploadToAzure(file, sasUrl, metadata);

    expect(consoleLogSpy).toHaveBeenCalledWith('Upload progress: 50%');
    expect(consoleLogSpy).toHaveBeenCalledWith('Upload progress: 100%');
    expect(mockXhr.send).toHaveBeenCalledWith(file);
  });

  test('uses fallback Content-Type when file.type is empty', async () => {
    const file = new File([new ArrayBuffer(1024)], 'test.bin', { type: '' });
    const sasUrl = 'https://example.com/blob?token=abc';
    const metadata = {
      title: 'Test File',
      description: '',
      tags: '',
      category: 'general'
    };

    mockXhr.onload = jest.fn(() => {
      mockXhr.status = 200;
    });
    mockXhr.send.mockImplementation(() => {
      mockXhr.onload();
    });

    await uploadToAzure(file, sasUrl, metadata);

    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
    expect(mockXhr.send).toHaveBeenCalledWith(file);
  });

  test('handles falsy metadata values', async () => {
    const file = new File([new ArrayBuffer(1024)], 'test.pdf', { type: 'application/pdf' });
    const sasUrl = 'https://example.com/blob?token=abc';
    const metadata = {
      title: '',
      description: null,
      tags: undefined,
      category: ''
    };

    mockXhr.onload = jest.fn(() => {
      mockXhr.status = 200;
    });
    mockXhr.send.mockImplementation(() => {
      mockXhr.onload();
    });

    await uploadToAzure(file, sasUrl, metadata);

    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-meta-title', '');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-meta-description', 'null');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-meta-tags', 'undefined');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-meta-category', '');
    expect(mockXhr.send).toHaveBeenCalledWith(file);
  });
});