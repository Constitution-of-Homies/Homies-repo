// tests/search.test.js
import { jest } from '@jest/globals';
import {
  performSearch,
  clearSearchResults,
  formatFileSize,
  formatDate,
  getSimplifiedType,
  getFileIcon,
} from '../client/js/search.js';

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
  getFirestore: jest.fn(() => ({ mockDb: true })),
  collection: jest.fn((db, name) => ({ collection: name })),
  query: jest.fn((collection) => ({ query: true, collection })),
  getDocs: jest.fn(),
  doc: jest.fn((db, collection, id) => ({ mockDoc: true, id, collection })),
  getDoc: jest.fn(),
};
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
  getFirestore: jest.fn(() => ({ mockDb: true })),
  collection: jest.fn((db, name) => ({ collection: name })),
  query: jest.fn((collection) => ({ query: true, collection })),
  getDocs: jest.fn(),
  doc: jest.fn((db, collection, id) => ({ mockDoc: true, id, collection })),
  getDoc: jest.fn(),
}), { virtual: true });

// Mock firebase.js
jest.mock('../client/js/firebase.js', () => ({
  auth: { mockAuth: true, currentUser: { uid: 'user123' } },
  db: { mockDb: true },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock window.alert and console
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(window, 'alert').mockImplementation(() => {});

// Mock DOM
beforeAll(() => {
  document.body.innerHTML = `
    <div class="centered-content"></div>
    <div class="search-results-container" style="display: none;">
      <div id="search-results"></div>
    </div>
    <input class="search-input" value="" />
    <select id="filter-type">
      <option value="">All Types</option>
      <option value="pdf">PDF</option>
      <option value="image">Image</option>
    </select>
    <select id="filter-category">
      <option value="">All Categories</option>
      <option value="work">Work</option>
      <option value="personal">Personal</option>
    </select>
    <select id="filter-date">
      <option value="">Any Date</option>
      <option value="day">Today</option>
      <option value="week">This Week</option>
      <option value="month">This Month</option>
      <option value="year">This Year</option>
    </select>
    <input id="filter-tags" value="" />
    <select id="sort-option">
      <option value="relevance">Relevance</option>
      <option value="date-desc">Date (Newest)</option>
      <option value="date-asc">Date (Oldest)</option>
      <option value="title-asc">Title (A-Z)</option>
      <option value="title-desc">Title (Z-A)</option>
      <option value="size-asc">Size (Smallest)</option>
      <option value="size-desc">Size (Largest)</option>
    </select>
    <input type="checkbox" id="nlp-toggle" />
  `;
});

describe('Search Module', () => {
  let getDocs, getDoc;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.resetModules();

    // Extract mocks
    ({ getDocs, getDoc } = mockFirestore);

    // Reset DOM
    document.querySelector('.search-input').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-tags').value = '';
    document.getElementById('sort-option').value = 'relevance';
    document.getElementById('nlp-toggle').checked = false;
    document.getElementById('search-results').innerHTML = '';
    document.querySelector('.search-results-container').style.display = 'none';
    document.querySelector('.centered-content').classList.remove('search-active');

    // Mock fetch response
    mockFetch.mockImplementation(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ embeddings: [0.1, 0.2, 0.3] }),
    }));

    // Mock Firestore default responses
    getDoc.mockImplementation(() => Promise.resolve({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        uploadedBy: 'user123',
        uploadedByName: 'Test User',
        metadata: { title: 'Test PDF', description: 'Test Description', tags: ['tag1', 'tag2'], category: 'work' },
      }),
    }));
    getDocs.mockImplementation(() => Promise.resolve({
      empty: false,
      docs: [{
        id: 'search1',
        exists: () => true,
        data: () => ({
          itemId: 'file1',
          content: 'test document content',
          embeddings: [0.4, 0.5, 0.6],
        }),
      }],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) { yield doc; } },
    }));

    // Import search.js
    await import('../client/js/search.js');
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('sorts existing results when sort option changes', async () => {
    window.currentSearchResults = [
      {
        id: 'file1',
        name: 'zebra.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/zebra.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        metadata: { title: 'Zebra PDF', description: '', tags: [], category: 'work' },
        similarity: 0.8,
        contentSnippet: 'Zebra document',
      },
      {
        id: 'file2',
        name: 'apple.pdf',
        type: 'application/pdf',
        size: 2048,
        url: 'https://example.com/apple.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-17') },
        metadata: { title: 'Apple PDF', description: '', tags: [], category: 'work' },
        similarity: 0.9,
        contentSnippet: 'Apple document',
      },
    ];
    document.getElementById('search-results').innerHTML = `
      <div class="search-result-item">
        <div class="search-result-details"><h3>Zebra PDF</h3></div>
      </div>
      <div class="search-result-item">
        <div class="search-result-details"><h3>Apple PDF</h3></div>
      </div>
    `;

    document.getElementById('sort-option').value = 'title-asc';
    document.getElementById('sort-option').dispatchEvent(new Event('change', { bubbles: true }));

    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    const resultsContainer = document.getElementById('search-results');
    const items = resultsContainer.querySelectorAll('.search-result-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('h3').textContent).toBe('Apple PDF');
    expect(items[1].querySelector('h3').textContent).toBe('Zebra PDF');
    expect(window.currentSearchResults[0].metadata.title).toBe('Apple PDF');
  }, 10000);

  test('handles sort option change with empty results', async () => {
    window.currentSearchResults = [];
    document.getElementById('sort-option').value = 'date-desc';
    document.getElementById('sort-option').dispatchEvent(new Event('change', { bubbles: true }));

    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('');
  }, 10000);

  test('performs search with keyword match and displays results', async () => {
    document.querySelector('.search-input').value = 'test';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();
    await Promise.resolve(); // Extra await for DOM updates

    const resultsContainer = document.getElementById('search-results');
    console.log('Results HTML:', resultsContainer.innerHTML);
    const items = resultsContainer.querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('h3').textContent).toBe('Test PDF');
    expect(items[0].querySelector('.search-result-snippet').textContent).toBe('test document content...');
    expect(items[0].querySelector('.search-result-meta').textContent).toContain('Relevance:');
    expect(document.querySelector('.search-results-container').style.display).toBe('block');
    expect(document.querySelector('.centered-content').classList.contains('search-active')).toBe(true);
    expect(resultsContainer.querySelector('.loading-spinner')).toBeNull();
  }, 25000);

  test('handles missing archive item', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    document.querySelector('.search-input').value = 'test';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    expect(consoleLogSpy).toHaveBeenCalledWith('Archive item not found for searchDoc: search1');
    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 25000);

  test('generates content snippet correctly', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'search1',
        exists: () => true,
        data: () => ({
          itemId: 'file1',
          content: 'A'.repeat(150),
          embeddings: [0.4, 0.5, 0.6],
        }),
      }],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) { yield doc; } },
    });
    document.querySelector('.search-input').value = 'A';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    const resultsContainer = document.getElementById('search-results');
    console.log('Snippet HTML:', resultsContainer.innerHTML);
    const snippet = document.querySelector('.search-result-snippet')?.textContent;
    expect(snippet).toBeDefined();
    expect(snippet.length).toBe(103);
    expect(snippet).toBe('A'.repeat(100) + '...');
  }, 25000);

  test('falls back to file name in content snippet when content is empty', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'search1',
        exists: () => true,
        data: () => ({
          itemId: 'file1',
          content: '',
          embeddings: [0.4, 0.5, 0.6],
        }),
      }],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) { yield doc; } },
    });
    document.querySelector('.search-input').value = 'test';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    const snippet = document.querySelector('.search-result-snippet')?.textContent;
    expect(snippet).toBe('File name: test.pdf');
  }, 25000);

  test('performs NLP-based search and calculates cosine similarity', async () => {
    document.querySelector('.search-input').value = 'test';
    document.getElementById('nlp-toggle').checked = true;
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://scriptorium.azurewebsites.net/api/generateEmbeddings',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' }),
      })
    );
    const resultsContainer = document.getElementById('search-results');
    console.log('NLP HTML:', resultsContainer.innerHTML);
    const items = resultsContainer.querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('.search-result-meta').textContent).toContain('Relevance:');
  }, 25000);

  test('falls back to keyword match when embeddings are empty', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'search1',
        exists: () => true,
        data: () => ({
          itemId: 'file1',
          content: 'test document',
          embeddings: [],
        }),
      }],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) { yield doc; } },
    });
    document.querySelector('.search-input').value = 'test';
    document.getElementById('nlp-toggle').checked = true;
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalled();
    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
  }, 25000);

  test('handles NLP embedding generation failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Embedding error' }),
    });
    document.querySelector('.search-input').value = 'test';
    document.getElementById('nlp-toggle').checked = true;
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating query embeddings:', expect.any(Error));
    expect(document.getElementById('search-results').innerHTML).toBe('<p>Error performing search</p>');
  }, 25000);

  test('applies filters and excludes non-matching files', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'image/png',
        size: 1024,
        url: 'https://example.com/test.pdf',
        uploadedAt: { toDate: () => new Date('2024-05-18') },
        metadata: { title: 'Test PDF', description: '', tags: ['other'], category: 'personal' },
      }),
    });
    document.querySelector('.search-input').value = 'test';
    document.getElementById('filter-type').value = 'pdf';
    document.getElementById('filter-category').value = 'work';
    document.getElementById('filter-date').value = 'day';
    document.getElementById('filter-tags').value = 'tag1';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 25000);

  test('performs final sort and re-renders results', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'search1',
          exists: () => true,
          data: () => ({
            itemId: 'file1',
            content: 'test document',
            embeddings: [0.4, 0.5, 0.6],
          }),
        },
        {
          id: 'search2',
          exists: () => true,
          data: () => ({
            itemId: 'file2',
            content: 'test document',
            embeddings: [0.3, 0.4, 0.5],
          }),
        },
      ],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) { yield doc; } },
    });
    getDoc.mockImplementation((_, id) => Promise.resolve({
      exists: () => true,
      id,
      data: () => ({
        name: id === 'file1' ? 'zebra.pdf' : 'apple.pdf',
        type: 'application/pdf',
        size: id === 'file1' ? 1024 : 2048,
        url: `https://example.com/${id}.pdf`,
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        metadata: { title: id === 'file1' ? 'Zebra PDF' : 'Apple PDF', description: '', tags: [], category: 'work' },
      }),
    }));
    document.querySelector('.search-input').value = 'test';
    document.getElementById('sort-option').value = 'title-asc';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('h3').textContent).toBe('Apple PDF');
    expect(items[1].querySelector('h3').textContent).toBe('Zebra PDF');
  }, 25000);

  test('inserts results in sorted order', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'search1',
          exists: () => true,
          data: () => ({
            itemId: 'file1',
            content: 'test document',
            embeddings: [0.4, 0.5, 0.6],
          }),
        },
        {
          id: 'search2',
          exists: () => true,
          data: () => ({
            itemId: 'file2',
            content: 'test document',
            embeddings: [0.3, 0.4, 0.5],
          }),
        },
      ],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) { yield doc; } },
    });
    getDoc.mockImplementation((_, id) => Promise.resolve({
      exists: () => true,
      id,
      data: () => ({
        name: id === 'file1' ? 'zebra.pdf' : 'apple.pdf',
        type: 'application/pdf',
        size: id === 'file1' ? 1024 : 2048,
        url: `https://example.com/${id}.pdf`,
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        metadata: { title: id === 'file1' ? 'Zebra PDF' : 'Apple PDF', description: '', tags: [], category: 'work' },
      }),
    }));
    document.querySelector('.search-input').value = 'test';
    document.getElementById('sort-option').value = 'title-asc';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('h3').textContent).toBe('Apple PDF');
    expect(items[1].querySelector('h3').textContent).toBe('Zebra PDF');
  }, 25000);

  test('appends results without sorting when insertSorted is false', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'search1',
          exists: () => true,
          data: () => ({
            itemId: 'file1',
            content: 'test document',
            embeddings: [0.4, 0.5, 0.6],
          }),
        },
        {
          id: 'search2',
          exists: () => true,
          data: () => ({
            itemId: 'file2',
            content: 'test document',
            embeddings: [0.3, 0.4, 0.5],
          }),
        },
      ],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) { yield doc; } },
    });
    getDoc.mockImplementation((_, id) => Promise.resolve({
      exists: () => true,
      id,
      data: () => ({
        name: id === 'file1' ? 'zebra.pdf' : 'apple.pdf',
        type: 'application/pdf',
        size: id === 'file1' ? 1024 : 2048,
        url: `https://example.com/${id}.pdf`,
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        metadata: { title: id === 'file1' ? 'Zebra PDF' : 'Apple PDF', description: '', tags: [], category: 'work' },
      }),
    }));
    document.querySelector('.search-input').value = 'test';
    document.getElementById('sort-option').value = 'title-asc';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('h3').textContent).toBe('Apple PDF');
  }, 25000);

  test('calculates keyword match score correctly', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'search1',
        exists: () => true,
        data: () => ({
          itemId: 'file1',
          content: 'test test document',
          embeddings: [],
        }),
      }],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) { yield doc; } },
    });
    document.querySelector('.search-input').value = 'test';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    const meta = document.querySelector('.search-result-meta')?.textContent;
    expect(meta).toContain('Relevance: 10.0%');
  }, 25000);

  test('gives full score for short documents with any match', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'search1',
        exists: () => true,
        data: () => ({
          itemId: 'file1',
          content: 'test doc',
          embeddings: [],
        }),
      }],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) { yield doc; } },
    });
    document.querySelector('.search-input').value = 'test';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    const meta = document.querySelector('.search-result-meta')?.textContent;
    expect(meta).toContain('Relevance: 100.0%');
  }, 25000);

  test('handles stop words in keyword search', async () => {
    document.querySelector('.search-input').value = 'the and test';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
  }, 25000);

  test('matches filters for date ranges', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-15') },
        metadata: { title: 'Test PDF', description: '', tags: ['tag1'], category: 'work' },
      }),
    });
    document.querySelector('.search-input').value = 'test';
    document.getElementById('filter-date').value = 'week';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
  }, 25000);

  test('compares results for all sort options', async () => {
    window.currentSearchResults = [
      {
        id: 'file1',
        name: 'zebra.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/zebra.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        metadata: { title: 'Zebra PDF', description: '', tags: [], category: 'work' },
        similarity: 0.8,
      },
      {
        id: 'file2',
        name: 'apple.pdf',
        type: 'application/pdf',
        size: 2048,
        url: 'https://example.com/apple.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-17') },
        metadata: { title: 'Apple PDF', description: '', tags: [], category: 'work' },
        similarity: 0.9,
      },
    ];

    document.getElementById('sort-option').value = 'relevance';
    document.getElementById('sort-option').dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Apple PDF');

    document.getElementById('sort-option').value = 'date-desc';
    document.getElementById('sort-option').dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Zebra PDF');

    document.getElementById('sort-option').value = 'date-asc';
    document.getElementById('sort-option').dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Apple PDF');

    document.getElementById('sort-option').value = 'title-asc';
    document.getElementById('sort-option').dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Apple PDF');

    document.getElementById('sort-option').value = 'title-desc';
    document.getElementById('sort-option').dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Zebra PDF');

    document.getElementById('sort-option').value = 'size-asc';
    document.getElementById('sort-option').dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Zebra PDF');

    document.getElementById('sort-option').value = 'size-desc';
    document.getElementById('sort-option').dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Apple PDF');
  }, 15000);

  test('handles cosine similarity edge cases', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'search1',
          exists: () => true,
          data: () => ({
            itemId: 'file1',
            content: 'test document',
            embeddings: [],
          }),
        },
        {
          id: 'search2',
          exists: () => true,
          data: () => ({
            itemId: 'file2',
            content: 'test document',
            embeddings: [0, 0, 0],
          }),
        },
      ],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) { yield doc; } },
    });
    getDoc.mockImplementation((_, id) => Promise.resolve({
      exists: () => true,
      id,
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: `https://example.com/${id}.pdf`,
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        metadata: { title: 'Test PDF', description: '', tags: [], category: 'work' },
      }),
    }));
    document.querySelector('.search-input').value = 'test';
    document.getElementById('nlp-toggle').checked = true;
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('.search-result-meta').textContent).toContain('Relevance: 5.0%');
    expect(items[1].querySelector('.search-result-meta').textContent).toContain('Relevance: 0.0%');
  }, 25000);

  test('displays no results when search term has no matches', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'search1',
        exists: () => true,
        data: () => ({
          itemId: 'file1',
          content: 'unrelated content',
          embeddings: [0.4, 0.5, 0.6],
        }),
      }],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) { yield doc; } },
    });
    document.querySelector('.search-input').value = 'nonexistent';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 25000);

  test('alerts when search term is empty', async () => {
    document.querySelector('.search-input').value = '';
    await performSearch();
    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(window.alert).toHaveBeenCalledWith('Please enter a search term.');
    expect(document.getElementById('search-results').innerHTML).toBe('');
  }, 10000);

  test('handles search error gracefully', async () => {
    getDocs.mockRejectedValueOnce(new Error('Firestore error'));
    document.querySelector('.search-input').value = 'test';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>Error performing search</p>');
    expect(window.alert).toHaveBeenCalledWith('Error performing search: Firestore error');
  }, 25000);

  test('clears search results and resets UI', async () => {
    document.querySelector('.search-input').value = 'test';
    document.getElementById('filter-type').value = 'pdf';
    document.getElementById('filter-category').value = 'work';
    document.getElementById('filter-date').value = 'day';
    document.getElementById('filter-tags').value = 'tag1';
    document.getElementById('sort-option').value = 'date-desc';
    document.getElementById('nlp-toggle').checked = true;
    document.querySelector('.search-results-container').style.display = 'block';
    document.querySelector('.centered-content').classList.add('search-active');

    clearSearchResults();
    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(document.querySelector('.search-input').value).toBe('');
    expect(document.getElementById('filter-type').value).toBe('');
    expect(document.getElementById('filter-category').value).toBe('');
    expect(document.getElementById('filter-date').value).toBe('');
    expect(document.getElementById('filter-tags').value).toBe('');
    expect(document.getElementById('sort-option').value).toBe('relevance');
    expect(document.getElementById('nlp-toggle').checked).toBe(false);
    expect(document.querySelector('.search-results-container').style.display).toBe('none');
    expect(document.getElementById('search-results').innerHTML).toBe('');
    expect(document.querySelector('.centered-content').classList.contains('search-active')).toBe(false);
  }, 10000);

  test('formatFileSize formats bytes correctly', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(2097152)).toBe('2.0 MB');
    expect(formatFileSize(2147483648)).toBe('2.0 GB');
    expect(formatFileSize('unknown')).toBe('unknown');
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(-100)).toBe('-100 B');
    expect(formatFileSize(undefined)).toBe(undefined);
  });

  test('formatDate formats dates correctly', () => {
    const date = new Date('2023-01-01');
    expect(formatDate(date)).toBe('1 Jan 2023');
    expect(formatDate(null)).toBe('Unknown date');
  });

  test('getSimplifiedType returns correct file type', () => {
    expect(getSimplifiedType('application/pdf')).toBe('pdf');
    expect(getSimplifiedType('image/png')).toBe('image');
    expect(getSimplifiedType('text/plain')).toBe('text');
    expect(getSimplifiedType('application/javascript')).toBe('code');
    expect(getSimplifiedType('')).toBe('default');
    expect(getSimplifiedType('application/unknown')).toBe('application');
    expect(getSimplifiedType(null)).toBe('default');
  });

  test('getFileIcon returns correct icon HTML', () => {
    expect(getFileIcon('pdf')).toContain('pdf.png');
    expect(getFileIcon('image')).toContain('image.png');
    expect(getFileIcon('unknown')).toContain('default.png');
  });

  // Additional tests for uncovered branches
  test('handles malformed tags in filters', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        metadata: { title: 'Test PDF', description: '', tags: null, category: 'work' },
      }),
    });
    document.querySelector('.search-input').value = 'test';
    document.getElementById('filter-tags').value = 'tag1';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 25000);

  test('handles missing uploadedAt in date filters', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        metadata: { title: 'Test PDF', description: '', tags: [], category: 'work' },
      }),
    });
    document.querySelector('.search-input').value = 'test';
    document.getElementById('filter-date').value = 'day';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 25000);

  test('handles network error in generateQueryEmbeddings', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    document.querySelector('.search-input').value = 'test';
    document.getElementById('nlp-toggle').checked = true;
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating query embeddings:', expect.any(Error));
    expect(document.getElementById('search-results').innerHTML).toBe('<p>Error performing search</p>');
  }, 25000);

  test('handles empty searchIndex collection', async () => {
    getDocs.mockResolvedValueOnce({
      empty: true,
      docs: [],
      forEach: function () {},
      [Symbol.iterator]: function* () {},
    });
    document.querySelector('.search-input').value = 'test';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 25000);

  test('handles missing metadata fields', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-18') },
      }),
    });
    document.querySelector('.search-input').value = 'test';
    await performSearch();
    jest.advanceTimersByTime(20000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('h3').textContent).toBe('test.pdf');
    expect(items[0].querySelector('.search-result-description').textContent).toBe('No description');
  }, 25000);
});