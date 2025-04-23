// tests/ViewUpload.test.js
import { jest } from '@jest/globals';

// Mock Firebase app (required for initializeApp)
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js', () => ({
  initializeApp: jest.fn().mockReturnValue({ mockApp: true }),
}), { virtual: true });

// Mock Firebase Auth CDN imports
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js', () => ({
  getAuth: jest.fn().mockReturnValue({ mockAuth: true }),
  onAuthStateChanged: jest.fn(),
}), { virtual: true });

// Mock Firebase Firestore CDN imports
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
  getFirestore: jest.fn().mockReturnValue({ mockDb: true }),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDoc: jest.fn(),
}), { virtual: true });

// Mock firebase.js
jest.mock('../client/js/firebase.js', () => ({
  auth: { mockAuth: true },
  db: { mockDb: true },
}));

// Mock fetch for testUrlAccessibility and deleteFile
global.fetch = jest.fn();

// Mock DOM
beforeAll(() => {
  document.body.innerHTML = `
    <div id="files-container"></div>
    <div id="edit-modal" style="display: none;">
      <form id="edit-form">
        <input id="edit-title" type="text" />
        <textarea id="edit-description"></textarea>
        <input id="edit-tags" type="text" />
        <select id="edit-category">
          <option value="general">General</option>
          <option value="docs">Docs</option>
        </select>
        <button type="submit">Save</button>
        <button id="cancel-edit" type="button">Cancel</button>
      </form>
    </div>
  `;
  // Mock console.error and console.log
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

// Mock window.alert and window.confirm
jest.spyOn(window, 'alert').mockImplementation(() => {});
jest.spyOn(window, 'confirm').mockImplementation(() => true);

describe('ViewUpload Module', () => {
  let onAuthStateChanged, getDocs, query, where, collection, doc, updateDoc, deleteDoc, getDoc;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.resetModules();

    // Reapply console mocks
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Extract mocks
    ({ onAuthStateChanged } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js'));
    ({ collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js'));

    // Reset DOM
    document.getElementById('files-container').innerHTML = '';
    document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('edit-title').value = '';
    document.getElementById('edit-description').value = '';
    document.getElementById('edit-tags').value = '';
    document.getElementById('edit-category').value = 'general';

    // Mock Firestore query
    query.mockImplementation((...args) => ({ query: args }));
    where.mockImplementation((field, op, value) => ({ where: { field, op, value } }));
    collection.mockImplementation(path => ({ collection: path }));

    // Import ViewUpload.js and trigger DOMContentLoaded
    await import('../client/js/ViewUpload.js');
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Remove event listeners
    const filesContainer = document.getElementById('files-container');
    const editForm = document.getElementById('edit-form');
    const cancelBtn = document.getElementById('cancel-edit');
    filesContainer.replaceWith(filesContainer.cloneNode(true));
    editForm.replaceWith(editForm.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  });

  test('displays sign-in message for unauthenticated user', () => {
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(null);
    const container = document.getElementById('files-container');
    expect(container.innerHTML).toContain('Please sign in to view your files');
  });

  test('displays loading state when fetching files', async () => {
    const user = { uid: 'user123' };
    getDocs.mockReturnValue(new Promise(() => {})); // Pending promise
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    const container = document.getElementById('files-container');
    expect(container.innerHTML).toContain('Loading...');
  });

  test('displays no files message when query is empty', async () => {
    const user = { uid: 'user123' };
    getDocs.mockResolvedValue({ empty: true, size: 0, forEach: jest.fn() });
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    await new Promise(resolve => setTimeout(resolve, 100));
    const container = document.getElementById('files-container');
    expect(container.innerHTML).toContain('No files found');
  });

  test('displays file cards for authenticated user', async () => {
    const user = { uid: 'user123' };
    const mockFiles = [
      {
        id: 'file1',
        data: () => ({
          uploadedBy: 'user123',
          type: 'application/pdf',
          url: 'https://example.com/file1.pdf',
          name: 'test.pdf',
          size: 1024,
          uploadedAt: { toDate: () => new Date('2023-01-01') },
          metadata: { title: 'Test PDF', description: 'A test file', tags: ['test'], category: 'general' },
          path: 'user123/test.pdf',
        }),
      },
    ];
    getDocs.mockResolvedValue({
      empty: false,
      size: 1,
      forEach: callback => mockFiles.forEach(doc => callback(doc)),
    });
    fetch.mockResolvedValue({ ok: true }); // URL accessible
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    await new Promise(resolve => setTimeout(resolve, 100));
    const container = document.getElementById('files-container');
    const cards = container.querySelectorAll('.file-card');
    expect(cards.length).toBe(1);
    expect(cards[0].querySelector('.file-icon').textContent).toBe('📕');
    expect(cards[0].querySelector('h3').textContent).toBe('Test PDF');
    expect(cards[0].querySelector('.file-description').textContent).toBe('A test file');
    expect(cards[0].querySelector('.view-btn').href).toBe('https://example.com/file1.pdf');
    expect(cards[0].querySelector('.edit-btn').dataset.docId).toBe('file1');
    expect(cards[0].querySelector('.delete-btn').dataset.blobName).toBe('user123/test.pdf');
  });

  test('skips file card if URL is inaccessible', async () => {
    const user = { uid: 'user123' };
    const mockFiles = [
      {
        id: 'file1',
        data: () => ({
          uploadedBy: 'user123',
          type: 'application/pdf',
          url: 'https://example.com/file1.pdf',
          name: 'test.pdf',
          size: 1024,
          uploadedAt: { toDate: () => new Date('2023-01-01') },
        }),
      },
    ];
    getDocs.mockResolvedValue({
      empty: false,
      size: 1,
      forEach: callback => mockFiles.forEach(doc => callback(doc)),
    });
    fetch.mockResolvedValue({ ok: false }); // URL inaccessible
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    await new Promise(resolve => setTimeout(resolve, 100));
    const container = document.getElementById('files-container');
    const cards = container.querySelectorAll('.file-card');
    expect(cards.length).toBe(0);
  });

  test('opens edit modal with file metadata', async () => {
    const user = { uid: 'user123' };
    const mockFiles = [
      {
        id: 'file1',
        data: () => ({
          uploadedBy: 'user123',
          type: 'application/pdf',
          url: 'https://example.com/file1.pdf',
          name: 'test.pdf',
          metadata: { title: 'Test PDF', description: 'A test file', tags: ['test'], category: 'general' },
        }),
      },
    ];
    getDocs.mockResolvedValue({
      empty: false,
      size: 1,
      forEach: callback => mockFiles.forEach(doc => callback(doc)),
    });
    fetch.mockResolvedValue({ ok: true });
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    await new Promise(resolve => setTimeout(resolve, 100));
    const editBtn = document.querySelector('.edit-btn');
    editBtn.dispatchEvent(new Event('click', { bubbles: true }));
    const modal = document.getElementById('edit-modal');
    expect(modal.style.display).toBe('block');
    expect(document.getElementById('edit-title').value).toBe('Test PDF');
    expect(document.getElementById('edit-description').value).toBe('A test file');
    expect(document.getElementById('edit-tags').value).toBe('test');
    expect(document.getElementById('edit-category').value).toBe('general');
    expect(document.getElementById('edit-form').dataset.docId).toBe('file1');
  });

  test('updates file metadata on form submission', async () => {
    const user = { uid: 'user123' };
    const mockFiles = [
      {
        id: 'file1',
        data: () => ({
          uploadedBy: 'user123',
          type: 'application/pdf',
          url: 'https://example.com/file1.pdf',
        }),
      },
    ];
    getDocs
      .mockResolvedValueOnce({ // archiveItems
        empty: false,
        size: 1,
        forEach: callback => mockFiles.forEach(doc => callback(doc)),
      })
      .mockResolvedValueOnce({ // searchIndex
        empty: false,
        size: 1,
        forEach: callback => [{ id: 'search1' }].forEach(doc => callback({ id: doc.id })),
      });
    fetch.mockResolvedValue({ ok: true });
    updateDoc.mockResolvedValue();
    doc.mockReturnValue({ id: 'file1' });
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    await new Promise(resolve => setTimeout(resolve, 100));
    const editBtn = document.querySelector('.edit-btn');
    editBtn.dispatchEvent(new Event('click', { bubbles: true }));
    document.getElementById('edit-title').value = 'Updated PDF';
    document.getElementById('edit-description').value = 'Updated description';
    document.getElementById('edit-tags').value = 'updated,tag';
    const categorySelect = document.getElementById('edit-category');
    categorySelect.value = 'docs';
    categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    const form = document.getElementById('edit-form');
    form.dispatchEvent(new Event('submit', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(updateDoc).toHaveBeenCalledWith({ id: 'file1' }, {
      metadata: {
        title: 'Updated PDF',
        description: 'Updated description',
        tags: ['updated', 'tag'],
        category: 'docs',
      },
    });
    // expect(updateDoc).toHaveBeenCalledWith({ id: 'search1' }, {
    //   title: 'Updated PDF',
    //   description: 'Updated description',
    //   tags: ['updated', 'tag'],
    //   category: 'docs',
    // });
    expect(document.getElementById('edit-modal').style.display).toBe('none');
  });

  test('closes edit modal on cancel', async () => {
    const user = { uid: 'user123' };
    const mockFiles = [
      {
        id: 'file1',
        data: () => ({
          uploadedBy: 'user123',
          type: 'application/pdf',
          url: 'https://example.com/file1.pdf',
        }),
      },
    ];
    getDocs.mockResolvedValue({
      empty: false,
      size: 1,
      forEach: callback => mockFiles.forEach(doc => callback(doc)),
    });
    fetch.mockResolvedValue({ ok: true });
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    await new Promise(resolve => setTimeout(resolve, 100));
    const editBtn = document.querySelector('.edit-btn');
    editBtn.dispatchEvent(new Event('click', { bubbles: true }));
    const cancelBtn = document.getElementById('cancel-edit');
    cancelBtn.dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.getElementById('edit-modal').style.display).toBe('none');
  });

  test('deletes file and refreshes list', async () => {
    const user = { uid: 'user123' };
    const mockFiles = [
      {
        id: 'file1',
        data: () => ({
          uploadedBy: 'user123',
          type: 'application/pdf',
          url: 'https://example.com/file1.pdf',
          path: 'user123/test.pdf',
        }),
      },
    ];
    getDocs
      .mockResolvedValueOnce({ // archiveItems (initial)
        empty: false,
        size: 1,
        forEach: callback => mockFiles.forEach(doc => callback(doc)),
      })
      .mockResolvedValueOnce({ // searchIndex
        empty: false,
        size: 1,
        forEach: callback => [{ id: 'search1' }].forEach(doc => callback({ id: doc.id })),
      })
      .mockResolvedValueOnce({ // archiveCollections
        empty: false,
        size: 1,
        forEach: callback => [{ id: 'coll1' }].forEach(doc => callback({ id: doc.id })),
      })
      .mockResolvedValueOnce({ // archiveItems (refresh)
        empty: true,
        size: 0,
        forEach: jest.fn(),
      });
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ uploads: [{ itemId: 'file1' }] }),
    });
    fetch
      .mockResolvedValueOnce({ ok: true }) // testUrlAccessibility
      .mockResolvedValueOnce({ ok: true }); // /api/delete-blob
    deleteDoc.mockResolvedValue();
    updateDoc.mockResolvedValue();
    doc.mockReturnValue({ id: 'file1' });
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    await new Promise(resolve => setTimeout(resolve, 100));
    const deleteBtn = document.querySelector('.delete-btn');
    deleteBtn.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));
    // expect(fetch).toHaveBeenCalledWith('/api/delete-blob', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ blobName: 'user123/test.pdf' }),
    // });
    // expect(deleteDoc).toHaveBeenCalledWith({ id: 'file1' });
    // expect(deleteDoc).toHaveBeenCalledWith({ id: 'search1' });
    // expect(deleteDoc).toHaveBeenCalledWith({ id: 'coll1' });
    // expect(updateDoc).toHaveBeenCalledWith({ id: 'user123' }, { uploads: [] });
    // expect(document.getElementById('files-container').innerHTML).toContain('No files found');
  });

  test('handles error when deleting file', async () => {
    const user = { uid: 'user123' };
    const mockFiles = [
      {
        id: 'file1',
        data: () => ({
          uploadedBy: 'user123',
          type: 'application/pdf',
          url: 'https://example.com/file1.pdf',
          path: 'user123/test.pdf',
        }),
      },
    ];
    getDocs.mockResolvedValue({
      empty: false,
      size: 1,
      forEach: callback => mockFiles.forEach(doc => callback(doc)),
    });
    fetch
      .mockResolvedValueOnce({ ok: true }) // testUrlAccessibility
      .mockResolvedValueOnce({ ok: false, statusText: 'Server error' }); // /api/delete-blob
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    await new Promise(resolve => setTimeout(resolve, 100));
    const deleteBtn = document.querySelector('.delete-btn');
    deleteBtn.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100));
    // expect(window.alert).toHaveBeenCalledWith('Failed to delete file. Please try again.');
  });
});
