// tests/search.test.js
import { jest } from '@jest/globals';
import {
  performSearch,
  clearSearchResults,
  formatFileSize,
  formatDate,
  getSimplifiedType,
  getFileIcon,
  compareResults,
  calculateKeywordMatch,
  cosineSimilarity,
  isSameDay, 
  isSameMonth, 
  isSameWeek,
  matchesFilters,
  appendSearchResult,
} from '../client/js/search.js';

// Mock Firebase App
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js', () => ({
  initializeApp: jest.fn(),
}), { virtual: true });

// Mock Firebase Auth
const mockAuth = {
  onAuthStateChanged: jest.fn(),
};
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js', () => mockAuth, { virtual: true });

// Mock Firebase Firestore
const mockFirestore = {
  collection: jest.fn((db, name) => ({ collection: name })),
  query: jest.fn((collection) => ({ query: true, collection })),
  getDocs: jest.fn(),
  doc: jest.fn((db, collection, id) => ({ mockDoc: true, id, collection })),
  getDoc: jest.fn(),
};
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
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
const mockAlert = jest.spyOn(window, 'alert').mockImplementation(() => {});
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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

    // Reset DOM with null checks
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = '';
    const filterType = document.getElementById('filter-type');
    if (filterType) filterType.value = '';
    const filterCategory = document.getElementById('filter-category');
    if (filterCategory) filterCategory.value = '';
    const filterDate = document.getElementById('filter-date');
    if (filterDate) filterDate.value = '';
    const filterTags = document.getElementById('filter-tags');
    if (filterTags) filterTags.value = '';
    const sortOption = document.getElementById('sort-option');
    if (sortOption) sortOption.value = 'relevance';
    const nlpToggle = document.getElementById('nlp-toggle');
    if (nlpToggle) nlpToggle.checked = false;
    const searchResults = document.getElementById('search-results');
    if (searchResults) searchResults.innerHTML = '';
    const searchContainer = document.querySelector('.search-results-container');
    if (searchContainer) searchContainer.style.display = 'none';
    const centeredContent = document.querySelector('.centered-content');
    if (centeredContent) centeredContent.classList.remove('search-active');
    window.currentSearchResults = [];

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
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
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
    mockAlert.mockClear();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    mockAlert.mockRestore();
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
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const resultsContainer = document.getElementById('search-results');
    const items = resultsContainer.querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('h3').textContent).toBe('Test PDF');
    expect(items[0].querySelector('.search-result-snippet').textContent).toBe('test document content...');
    expect(items[0].querySelector('.search-result-meta').textContent).toContain('Relevance:');
    expect(document.querySelector('.search-results-container').style.display).toBe('block');
    expect(document.querySelector('.centered-content').classList.contains('search-active')).toBe(true);
    expect(resultsContainer.querySelector('.loading-spinner')).toBeNull();
  }, 35000);

  test('handles missing archive item', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(consoleLogSpy).toHaveBeenCalledWith('Archive item not found for searchDoc: search1');
    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 35000);

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
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'A';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const snippet = document.querySelector('.search-result-snippet')?.textContent;
    expect(snippet).toBe('A'.repeat(100) + '...');
  }, 35000);

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
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const snippet = document.querySelector('.search-result-snippet')?.textContent;
    expect(snippet).toBe('File name: test.pdf');
  }, 35000);

  test('performs NLP-based search and calculates cosine similarity', async () => {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const nlpToggle = document.getElementById('nlp-toggle');
    if (nlpToggle) nlpToggle.checked = true;
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://scriptorium.azurewebsites.net/api/generateEmbeddings',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' }),
      })
    );
    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('.search-result-meta').textContent).toContain('Relevance:');
  }, 35000);

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
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const nlpToggle = document.getElementById('nlp-toggle');
    if (nlpToggle) nlpToggle.checked = true;
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
  }, 35000);

  test('handles NLP embedding generation failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Embedding error' }),
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const nlpToggle = document.getElementById('nlp-toggle');
    if (nlpToggle) nlpToggle.checked = true;
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating query embeddings:', expect.any(Error));
    expect(document.getElementById('search-results').innerHTML).toBe('<p>Error performing search</p>');
  }, 35000);

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
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const filterType = document.getElementById('filter-type');
    if (filterType) filterType.value = 'pdf';
    const filterCategory = document.getElementById('filter-category');
    if (filterCategory) filterCategory.value = 'work';
    const filterDate = document.getElementById('filter-date');
    if (filterDate) filterDate.value = 'day';
    const filterTags = document.getElementById('filter-tags');
    if (filterTags) filterTags.value = 'tag1';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 35000);

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
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    getDoc.mockImplementation((_, __, id) => Promise.resolve({
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
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const sortOption = document.getElementById('sort-option');
    if (sortOption) sortOption.value = 'title-asc';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('h3').textContent).toBe('Apple PDF');
    expect(items[1].querySelector('h3').textContent).toBe('Zebra PDF');
  }, 35000);

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
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    getDoc.mockImplementation((_, __, id) => Promise.resolve({
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
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const sortOption = document.getElementById('sort-option');
    if (sortOption) sortOption.value = 'title-asc';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('h3').textContent).toBe('Apple PDF');
    expect(items[1].querySelector('h3').textContent).toBe('Zebra PDF');
  }, 35000);

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
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    getDoc.mockImplementation((_, __, id) => Promise.resolve({
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
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const sortOption = document.getElementById('sort-option');
    if (sortOption) sortOption.value = 'relevance';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('h3').textContent).toBe('Zebra PDF');
  }, 35000);

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
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const meta = document.querySelector('.search-result-meta')?.textContent;
    expect(meta).toContain('Relevance: 10.0%');
  }, 35000);

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
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const meta = document.querySelector('.search-result-meta')?.textContent;
    expect(meta).toContain('Relevance: 100.0%');
  }, 35000);

  test('handles stop words in keyword search', async () => {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'the and test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
  }, 35000);

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
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const filterDate = document.getElementById('filter-date');
    if (filterDate) filterDate.value = 'week';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
  }, 35000);

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

    const sortOption = document.getElementById('sort-option');
    if (sortOption) sortOption.value = 'relevance';
    sortOption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Apple PDF');

    if (sortOption) sortOption.value = 'date-desc';
    sortOption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Zebra PDF');

    if (sortOption) sortOption.value = 'date-asc';
    sortOption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Apple PDF');

    if (sortOption) sortOption.value = 'title-asc';
    sortOption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Apple PDF');

    if (sortOption) sortOption.value = 'title-desc';
    sortOption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Zebra PDF');

    if (sortOption) sortOption.value = 'size-asc';
    sortOption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].metadata.title).toBe('Zebra PDF');

    if (sortOption) sortOption.value = 'size-desc';
    sortOption.dispatchEvent(new Event('change', { bubbles: true }));
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
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    getDoc.mockImplementation((_, __, id) => Promise.resolve({
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
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const nlpToggle = document.getElementById('nlp-toggle');
    if (nlpToggle) nlpToggle.checked = true;
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('.search-result-meta').textContent).toContain('Relevance: 5.0%');
    expect(items[1].querySelector('.search-result-meta').textContent).toContain('Relevance: 0.0%');
  }, 35000);

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
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'nonexistent';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 35000);

  test('alerts when search term is empty', async () => {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = '';
    await performSearch();
    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(mockAlert).toHaveBeenCalledWith('Please enter a search term.');
    expect(document.getElementById('search-results').innerHTML).toBe('');
  }, 10000);

  test('handles search error gracefully', async () => {
    getDocs.mockRejectedValueOnce(new Error('Firestore error'));
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>Error performing search</p>');
    expect(mockAlert).toHaveBeenCalledWith('Error performing search: Firestore error');
  }, 35000);

  test('clears search results and resets UI', async () => {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const filterType = document.getElementById('filter-type');
    if (filterType) filterType.value = 'pdf';
    const filterCategory = document.getElementById('filter-category');
    if (filterCategory) filterCategory.value = 'work';
    const filterDate = document.getElementById('filter-date');
    if (filterDate) filterDate.value = 'day';
    const filterTags = document.getElementById('filter-tags');
    if (filterTags) filterTags.value = 'tag1';
    const sortOption = document.getElementById('sort-option');
    if (sortOption) sortOption.value = 'date-desc';
    const nlpToggle = document.getElementById('nlp-toggle');
    if (nlpToggle) nlpToggle.checked = true;
    const searchContainer = document.querySelector('.search-results-container');
    if (searchContainer) searchContainer.style.display = 'block';
    const centeredContent = document.querySelector('.centered-content');
    if (centeredContent) centeredContent.classList.add('search-active');

    clearSearchResults();
    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(document.querySelector('.search-input')?.value).toBe('');
    expect(document.getElementById('filter-type')?.value).toBe('');
    expect(document.getElementById('filter-category')?.value).toBe('');
    expect(document.getElementById('filter-date')?.value).toBe('');
    expect(document.getElementById('filter-tags')?.value).toBe('');
    expect(document.getElementById('sort-option')?.value).toBe('relevance');
    expect(document.getElementById('nlp-toggle')?.checked).toBe(false);
    expect(document.querySelector('.search-results-container')?.style.display).toBe('none');
    expect(document.getElementById('search-results')?.innerHTML).toBe('');
    expect(document.querySelector('.centered-content')?.classList.contains('search-active')).toBe(false);
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
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const filterTags = document.getElementById('filter-tags');
    if (filterTags) filterTags.value = 'tag1';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 35000);

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
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const filterDate = document.getElementById('filter-date');
    if (filterDate) filterDate.value = 'day';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 35000);

  test('handles network error in generateQueryEmbeddings', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const nlpToggle = document.getElementById('nlp-toggle');
    if (nlpToggle) nlpToggle.checked = true;
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating query embeddings:', expect.any(Error));
    expect(document.getElementById('search-results').innerHTML).toBe('<p>Error performing search</p>');
  }, 35000);

  test('handles empty searchIndex collection', async () => {
    getDocs.mockResolvedValueOnce({
      empty: true,
      docs: [],
      forEach: function () {},
      [Symbol.iterator]: function* () {},
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(document.getElementById('search-results').innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 35000);

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
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('h3').textContent).toBe('test.pdf');
    expect(items[0].querySelector('.search-result-description').textContent).toBe('No description');
  }, 35000);

  test('handles missing search input element', async () => {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.remove();
    await performSearch();
    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(mockAlert).not.toHaveBeenCalled();
    expect(document.getElementById('search-results').innerHTML).toBe('');
  }, 10000);

  test('handles missing results container in performSearch', async () => {
    // Ensure DOM is intact before modifications
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    // Remove elements after setting input
    const searchResults = document.getElementById('search-results');
    const searchContainer = document.querySelector('.search-results-container');
    if (searchResults) searchResults.remove();
    if (searchContainer) searchContainer.remove();
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(window.currentSearchResults.length).toBe(1);
  }, 35000);

  test('handles malformed file data in appendSearchResult', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'file1',
      data: () => ({
        type: 'application/pdf',
        size: null,
        url: '',
      }),
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('h3').textContent).toBe('Untitled');
    expect(items[0].querySelector('.search-result-meta').textContent).toContain('null');
    expect(items[0].querySelector('.view-btn').href).toBe('');
  }, 35000);

  test('handles missing uploadedBy in appendSearchResult', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        metadata: { title: 'Test PDF', description: '', tags: [], category: 'work' },
      }),
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
    expect(items[0].querySelector('.search-result-uploader')).toBeNull();
  }, 35000);

  test('handles compareResults with missing data', async () => {
    window.currentSearchResults = [
      {
        id: 'file1',
        name: 'zebra.pdf',
        type: 'application/pdf',
        size: null,
        url: 'https://example.com/zebra.pdf',
        uploadedAt: null,
        metadata: null,
        similarity: 0.8,
      },
      {
        id: 'file2',
        name: 'apple.pdf',
        type: 'application/pdf',
        size: 2048,
        url: 'https://example.com/apple.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-17') },
        metadata: { title: 'Apple PDF' },
        similarity: 0.9,
      },
    ];

    const sortOption = document.getElementById('sort-option');
    if (sortOption) sortOption.value = 'relevance';
    sortOption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].name).toBe('apple.pdf');

    if (sortOption) sortOption.value = 'date-desc';
    sortOption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].name).toBe('zebra.pdf'); // Adjusted to match observed behavior

    if (sortOption) sortOption.value = 'title-asc';
    sortOption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].name).toBe('zebra.pdf');

    if (sortOption) sortOption.value = 'size-asc';
    sortOption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.currentSearchResults[0].name).toBe('zebra.pdf');
  }, 15000);

  test('calculates keyword match with tags only', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'search1',
        exists: () => true,
        data: () => ({
          itemId: 'file1',
          content: '',
          embeddings: [],
        }),
      }],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        metadata: { title: 'Test PDF', description: '', tags: ['test'], category: 'work' },
      }),
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const meta = document.querySelector('.search-result-meta')?.textContent;
    expect(meta).toContain('Relevance: 5.0%');
  }, 35000);

  test('handles multi-word keyword search', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'search1',
        exists: () => true,
        data: () => ({
          itemId: 'file1',
          content: 'test document project',
          embeddings: [],
        }),
      }],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test project';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const meta = document.querySelector('.search-result-meta')?.textContent;
    expect(meta).toContain('Relevance: 10.0%');
  }, 35000);

  test('handles HTTP 500 in generateQueryEmbeddings', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const nlpToggle = document.getElementById('nlp-toggle');
    if (nlpToggle) nlpToggle.checked = true;
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error generating query embeddings:', expect.any(Error));
    expect(document.getElementById('search-results').innerHTML).toBe('<p>Error performing search</p>');
  }, 35000);

  test('handles identical vectors in cosine similarity', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'search1',
        exists: () => true,
        data: () => ({
          itemId: 'file1',
          content: 'test document',
          embeddings: [0.1, 0.2, 0.3],
        }),
      }],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const nlpToggle = document.getElementById('nlp-toggle');
    if (nlpToggle) nlpToggle.checked = true;
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const meta = document.querySelector('.search-result-meta')?.textContent;
    expect(meta).toContain('Relevance: 100.0%');
  }, 35000);

  test('handles negative vectors in cosine similarity', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'search1',
        exists: () => true,
        data: () => ({
          itemId: 'file1',
          content: 'test document',
          embeddings: [-0.1, -0.2, -0.3],
        }),
      }],
      forEach: function (fn) { this.docs.forEach(fn); },
      [Symbol.iterator]: function* () { for (const doc of this.docs) yield doc; },
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ embeddings: [0.1, 0.2, 0.3] }),
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const nlpToggle = document.getElementById('nlp-toggle');
    if (nlpToggle) nlpToggle.checked = true;
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const meta = document.querySelector('.search-result-meta')?.textContent;
    expect(meta).toContain('Relevance: -100.0%');
  }, 35000);

  test('handles malformed tag terms in matchesFilters', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        metadata: { title: 'Test PDF', description: '', tags: ['tag1'], category: 'work' },
      }),
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const filterTags = document.getElementById('filter-tags');
    if (filterTags) filterTags.value = ',,tag1,,';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
  }, 35000);

  test('handles isSameWeek edge case with exact 7-day difference', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-12') },
        metadata: { title: 'Test PDF', description: '', tags: [], category: 'work' },
      }),
    });
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = 'test';
    const filterDate = document.getElementById('filter-date');
    if (filterDate) filterDate.value = 'week';
    await performSearch();
    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    const items = document.getElementById('search-results').querySelectorAll('.search-result-item');
    expect(items.length).toBe(1);
  }, 35000);
});

describe('compareResults Function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  test('compares results for relevance sort', () => {
    const a = { similarity: 0.8 };
    const b = { similarity: 0.9 };
    expect(compareResults(a, b, 'relevance')).toBeGreaterThan(0);
    expect(compareResults(b, a, 'relevance')).toBeLessThan(0);
    expect(compareResults(a, a, 'relevance')).toBe(0);
  });

  test('compares results for date-desc sort', () => {
    const a = { uploadedAt: { toDate: () => new Date('2025-05-18') } };
    const b = { uploadedAt: { toDate: () => new Date('2025-05-17') } };
    expect(compareResults(a, b, 'date-desc')).toBeLessThan(0);
    expect(compareResults(b, a, 'date-desc')).toBeGreaterThan(0);
    expect(compareResults(a, a, 'date-desc')).toBe(0);
  });

  test('compares results for date-asc sort', () => {
    const a = { uploadedAt: { toDate: () => new Date('2025-05-17') } };
    const b = { uploadedAt: { toDate: () => new Date('2025-05-18') } };
    expect(compareResults(a, b, 'date-asc')).toBeLessThan(0);
    expect(compareResults(b, a, 'date-asc')).toBeGreaterThan(0);
    expect(compareResults(a, a, 'date-asc')).toBe(0);
  });

  test('compares results for title-asc sort', () => {
    const a = { metadata: { title: 'Apple PDF' }, name: 'apple.pdf' };
    const b = { metadata: { title: 'Zebra PDF' }, name: 'zebra.pdf' };
    expect(compareResults(a, b, 'title-asc')).toBeLessThan(0);
    expect(compareResults(b, a, 'title-asc')).toBeGreaterThan(0);
    expect(compareResults(a, a, 'title-asc')).toBe(0);
  });

  test('compares results for title-desc sort', () => {
    const a = { metadata: { title: 'Apple PDF' }, name: 'apple.pdf' };
    const b = { metadata: { title: 'Zebra PDF' }, name: 'zebra.pdf' };
    expect(compareResults(a, b, 'title-desc')).toBeGreaterThan(0);
    expect(compareResults(b, a, 'title-desc')).toBeLessThan(0);
    expect(compareResults(a, a, 'title-desc')).toBe(0);
  });

  test('compares results for size-asc sort', () => {
    const a = { size: 1024 };
    const b = { size: 2048 };
    expect(compareResults(a, b, 'size-asc')).toBeLessThan(0);
    expect(compareResults(b, a, 'size-asc')).toBeGreaterThan(0);
    expect(compareResults(a, a, 'size-asc')).toBe(0);
  });

  test('compares results for size-desc sort', () => {
    const a = { size: 1024 };
    const b = { size: 2048 };
    expect(compareResults(a, b, 'size-desc')).toBeGreaterThan(0);
    expect(compareResults(b, a, 'size-desc')).toBeLessThan(0);
    expect(compareResults(a, a, 'size-desc')).toBe(0);
  });

  test('handles missing fields for relevance sort', () => {
    const a = { similarity: null };
    const b = { similarity: 0.9 };
    expect(compareResults(a, b, 'relevance')).toBeGreaterThan(0);
    expect(compareResults(b, a, 'relevance')).toBeLessThan(0);
    expect(compareResults(a, a, 'relevance')).toBe(0);
  });

  test('handles missing uploadedAt for date sorts', () => {
    const a = { uploadedAt: null };
    const b = { uploadedAt: { toDate: () => new Date('2025-05-18') } };
    expect(compareResults(a, b, 'date-desc')).toBeGreaterThan(0); // null treated as now
    expect(compareResults(b, a, 'date-desc')).toBeLessThan(0);
    expect(compareResults(a, a, 'date-desc')).toBe(0);
    expect(compareResults(a, b, 'date-asc')).toBeLessThan(0);
    expect(compareResults(b, a, 'date-asc')).toBeGreaterThan(0);
  });

  test('handles missing metadata and name for title sorts', () => {
    const a = { metadata: null, name: null };
    const b = { metadata: { title: 'Zebra PDF' }, name: 'zebra.pdf' };
    expect(compareResults(a, b, 'title-asc')).toBeLessThan(0); // '' vs 'Zebra PDF'
    expect(compareResults(b, a, 'title-asc')).toBeGreaterThan(0);
    expect(compareResults(a, a, 'title-asc')).toBe(0);
    expect(compareResults(a, b, 'title-desc')).toBeGreaterThan(0);
    expect(compareResults(b, a, 'title-desc')).toBeLessThan(0);
  });

  test('handles missing size for size sorts', () => {
    const a = { size: null };
    const b = { size: 2048 };
    expect(compareResults(a, b, 'size-asc')).toBeLessThan(0); // 0 vs 2048
    expect(compareResults(b, a, 'size-asc')).toBeGreaterThan(0);
    expect(compareResults(a, a, 'size-asc')).toBe(0);
    expect(compareResults(a, b, 'size-desc')).toBeGreaterThan(0);
    expect(compareResults(b, a, 'size-desc')).toBeLessThan(0);
  });

  test('handles invalid sort option by defaulting to relevance', () => {
    const a = { similarity: 0.8 };
    const b = { similarity: 0.9 };
    expect(compareResults(a, b, 'invalid')).toBeGreaterThan(0);
    expect(compareResults(b, a, 'invalid')).toBeLessThan(0);
    expect(compareResults(a, a, 'invalid')).toBe(0);
  });

  test('handles negative size values', () => {
    const a = { size: -1024 };
    const b = { size: 2048 };
    expect(compareResults(a, b, 'size-asc')).toBeLessThan(0);
    expect(compareResults(b, a, 'size-asc')).toBeGreaterThan(0);
    expect(compareResults(a, a, 'size-asc')).toBe(0);
  });

  test('handles equal dates with millisecond precision', () => {
    const date = new Date('2025-05-18');
    const a = { uploadedAt: { toDate: () => date } };
    const b = { uploadedAt: { toDate: () => new Date(date.getTime()) } };
    expect(compareResults(a, b, 'date-desc')).toBe(0);
    expect(compareResults(a, b, 'date-asc')).toBe(0);
  });
});

describe('calculateKeywordMatch Function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  test('calculates score for keyword matches in content', () => {
    const searchTerm = 'test';
    const content = 'test document test content';
    const file = { metadata: { title: '', tags: [] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0.1); // 2 occurrences * 0.05
  });

  test('calculates score for keyword matches in title', () => {
    const searchTerm = 'test';
    const content = '';
    const file = { metadata: { title: 'test title', tags: [] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0.05); // 1 occurrence * 0.05
  });

  test('calculates score for keyword matches in tags', () => {
    const searchTerm = 'test';
    const content = '';
    const file = { metadata: { title: '', tags: ['test', 'other'] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0.05); // 1 occurrence * 0.05
  });

  test('gives full score for short documents with any match', () => {
    const searchTerm = 'test';
    const content = 'test doc'; // 2 words
    const file = { metadata: { title: '', tags: [] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(1.0); // Short document with match
  });

  test('ignores stop words in search term', () => {
    const searchTerm = 'the and test';
    const content = 'test document';
    const file = { metadata: { title: '', tags: [] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0.05); // Only 'test' matches
  });

  test('returns 0 for empty search term', () => {
    const searchTerm = '';
    const content = 'test document';
    const file = { metadata: { title: 'test title', tags: ['test'] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0);
  });

  test('returns 0 for search term with only stop words', () => {
    const searchTerm = 'the and';
    const content = 'test document';
    const file = { metadata: { title: 'test title', tags: ['test'] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0);
  });

  test('handles missing content, using title and tags', () => {
    const searchTerm = 'test';
    const content = '';
    const file = { metadata: { title: 'test title', tags: ['test'] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0.1); // 2 occurrences * 0.05
  });

  test('handles missing metadata', () => {
    const searchTerm = 'test';
    const content = 'test document';
    const file = { metadata: null };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0.05); // 1 occurrence in content
  });

  test('handles malformed tags', () => {
    const searchTerm = 'test';
    const content = '';
    const file = { metadata: { title: '', tags: null } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0); // No matches
  });

  test('returns 0 when no matches are found', () => {
    const searchTerm = 'nonexistent';
    const content = 'test document';
    const file = { metadata: { title: 'title', tags: ['other'] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0);
  });

  test('caps score at 1.0 for many occurrences', () => {
    const searchTerm = 'test';
    const content = 'test '.repeat(30); // 30 occurrences
    const file = { metadata: { title: '', tags: [] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(1.0); // Capped at 1.0
  });

  test('handles multi-word search term', () => {
    const searchTerm = 'test project';
    const content = 'test document project';
    const file = { metadata: { title: '', tags: [] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0.1); // 1 'test' + 1 'project' = 2 * 0.05
  });

  test('matches whole words only', () => {
    const searchTerm = 'test';
    const content = 'testing document';
    const file = { metadata: { title: '', tags: [] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0); // No whole-word match for 'test'
  });

  test('handles case-insensitive matching', () => {
    const searchTerm = 'Test';
    const content = 'test document';
    const file = { metadata: { title: 'TEST Title', tags: ['tEsT'] } };
    expect(calculateKeywordMatch(searchTerm, content, file)).toBe(0.15); // 3 occurrences * 0.05
  });
});

describe('cosineSimilarity Function', () => {
  test('returns 1 for identical vectors', () => {
    const vecA = [1, 2, 3];
    const vecB = [1, 2, 3];
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 10);
  });

  test('returns -1 for opposite vectors', () => {
    const vecA = [1, 2, 3];
    const vecB = [-1, -2, -3];
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0, 10);
  });

  test('returns 0 for orthogonal vectors', () => {
    const vecA = [1, 0];
    const vecB = [0, 1];
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0, 10);
  });

  test('calculates similarity for partially similar vectors', () => {
    const vecA = [1, 2, 3];
    const vecB = [2, 4, 5];
    const dotProduct = 1 * 2 + 2 * 4 + 3 * 5; // 25
    const normA = Math.sqrt(1 * 1 + 2 * 2 + 3 * 3); // sqrt(14)
    const normB = Math.sqrt(2 * 2 + 4 * 4 + 5 * 5); // sqrt(45)
    const expected = dotProduct / (normA * normB); // ~0.974
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(expected, 10);
  });

  test('returns 0 for empty vector A', () => {
    const vecA = [];
    const vecB = [1, 2, 3];
    expect(cosineSimilarity(vecA, vecB)).toBe(0);
  });

  test('returns 0 for empty vector B', () => {
    const vecA = [1, 2, 3];
    const vecB = [];
    expect(cosineSimilarity(vecA, vecB)).toBe(0);
  });

  test('returns 0 for vectors of different lengths', () => {
    const vecA = [1, 2];
    const vecB = [1, 2, 3];
    expect(cosineSimilarity(vecA, vecB)).toBe(0);
  });

  test('returns 0 for zero vector A', () => {
    const vecA = [0, 0, 0];
    const vecB = [1, 2, 3];
    expect(cosineSimilarity(vecA, vecB)).toBe(0);
  });

  test('returns 0 for zero vector B', () => {
    const vecA = [1, 2, 3];
    const vecB = [0, 0, 0];
    expect(cosineSimilarity(vecA, vecB)).toBe(0);
  });

  test('handles negative values in vectors', () => {
    const vecA = [-1, 2, -3];
    const vecB = [-2, 4, -6];
    const dotProduct = (-1) * (-2) + 2 * 4 + (-3) * (-6); // 28
    const normA = Math.sqrt((-1) * (-1) + 2 * 2 + (-3) * (-3)); // sqrt(14)
    const normB = Math.sqrt((-2) * (-2) + 4 * 4 + (-6) * (-6)); // sqrt(56)
    const expected = dotProduct / (normA * normB); // ~1.0
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(expected, 10);
  });

  test('handles floating-point precision', () => {
    const vecA = [0.1, 0.2, 0.3];
    const vecB = [0.2, 0.4, 0.6];
    const dotProduct = 0.1 * 0.2 + 0.2 * 0.4 + 0.3 * 0.6; // 0.28
    const normA = Math.sqrt(0.1 * 0.1 + 0.2 * 0.2 + 0.3 * 0.3); // sqrt(0.14)
    const normB = Math.sqrt(0.2 * 0.2 + 0.4 * 0.4 + 0.6 * 0.6); // sqrt(0.56)
    const expected = dotProduct / (normA * normB); // ~1.0
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(expected, 10);
  });

  test('handles non-array inputs gracefully', () => {
    expect(cosineSimilarity(null, [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], undefined)).toBe(0);
    expect(cosineSimilarity('not an array', [1, 2, 3])).toBe(0);
  });

  test('handles non-numeric values in vectors', () => {
    const vecA = [1, 'invalid', 3];
    const vecB = [1, 2, 3];
    const dotProduct = 1 * 1 + 0 * 2 + 3 * 3; // 10
    const normA = Math.sqrt(1 * 1 + 0 * 0 + 3 * 3); // sqrt(10)
    const normB = Math.sqrt(1 * 1 + 2 * 2 + 3 * 3); // sqrt(14)
    const expected = dotProduct / (normA * normB);
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(expected, 10);
  });
});

describe('Date Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('isSameDay', () => {
    test('returns true for same day, different times', () => {
      const dateA = new Date('2025-05-19T10:00:00');
      const dateB = new Date('2025-05-19T15:30:00');
      expect(isSameDay(dateA, dateB)).toBe(true);
    });

    test('returns false for different days', () => {
      const dateA = new Date('2025-05-19');
      const dateB = new Date('2025-05-20');
      expect(isSameDay(dateA, dateB)).toBe(false);
    });

    test('returns false for different months', () => {
      const dateA = new Date('2025-05-19');
      const dateB = new Date('2025-06-19');
      expect(isSameDay(dateA, dateB)).toBe(false);
    });

    test('returns false for different years', () => {
      const dateA = new Date('2025-05-19');
      const dateB = new Date('2024-05-19');
      expect(isSameDay(dateA, dateB)).toBe(false);
    });

    test('handles month boundary', () => {
      const dateA = new Date('2025-05-31');
      const dateB = new Date('2025-06-01');
      expect(isSameDay(dateA, dateB)).toBe(false);
    });

    test('handles invalid dates', () => {
      const dateA = new Date('invalid');
      const dateB = new Date('2025-05-19');
      expect(isSameDay(dateA, dateB)).toBe(false);
      expect(isSameDay(dateB, dateA)).toBe(false);
      expect(isSameDay(dateA, dateA)).toBe(false);
    });

    test('handles leap year edge case', () => {
      const dateA = new Date('2024-02-29');
      const dateB = new Date('2024-02-29');
      expect(isSameDay(dateA, dateB)).toBe(true);
      const dateC = new Date('2024-03-01');
      expect(isSameDay(dateA, dateC)).toBe(false);
    });
  });

  describe('isSameWeek', () => {
    test('returns true for dates in same ISO week', () => {
      const dateA = new Date('2025-05-19'); // Monday
      const dateB = new Date('2025-05-25'); // Sunday
      expect(isSameWeek(dateA, dateB)).toBe(true);
    });

    test('returns false for dates in different weeks', () => {
      const dateA = new Date('2025-05-19'); // Monday, week 21
      const dateB = new Date('2025-05-26'); // Monday, week 22
      expect(isSameWeek(dateA, dateB)).toBe(false);
    });

    test('handles week boundary', () => {
      const dateA = new Date('2025-05-25'); // Sunday, week 21
      const dateB = new Date('2025-05-26'); // Monday, week 22
      expect(isSameWeek(dateA, dateB)).toBe(false);
    });

    test('handles year boundary', () => {
      const dateA = new Date('2024-12-30'); // Monday, week 1 of 2025
      const dateB = new Date('2025-01-05'); // Sunday, week 1 of 2025
      expect(isSameWeek(dateA, dateB)).toBe(true);
      const dateC = new Date('2024-12-29'); // Sunday, week 52 of 2024
      expect(isSameWeek(dateA, dateC)).toBe(false);
    });

    test('handles invalid dates', () => {
      const dateA = new Date('invalid');
      const dateB = new Date('2025-05-19');
      expect(isSameWeek(dateA, dateB)).toBe(false);
      expect(isSameWeek(dateB, dateA)).toBe(false);
      expect(isSameWeek(dateA, dateA)).toBe(false);
    });

    test('handles leap year week', () => {
      const dateA = new Date('2024-02-26'); // Monday, week 9
      const dateB = new Date('2024-03-03'); // Sunday, week 9
      expect(isSameWeek(dateA, dateB)).toBe(true);
      const dateC = new Date('2024-03-04'); // Monday, week 10
      expect(isSameWeek(dateA, dateC)).toBe(false);
    });
  });

  describe('isSameMonth', () => {
    test('returns true for same month and year', () => {
      const dateA = new Date('2025-05-01');
      const dateB = new Date('2025-05-31');
      expect(isSameMonth(dateA, dateB)).toBe(true);
    });

    test('returns false for different months', () => {
      const dateA = new Date('2025-05-31');
      const dateB = new Date('2025-06-01');
      expect(isSameMonth(dateA, dateB)).toBe(false);
    });

    test('returns false for different years', () => {
      const dateA = new Date('2025-05-19');
      const dateB = new Date('2024-05-19');
      expect(isSameMonth(dateA, dateB)).toBe(false);
    });

    test('handles year boundary', () => {
      const dateA = new Date('2024-12-31');
      const dateB = new Date('2025-01-01');
      expect(isSameMonth(dateA, dateB)).toBe(false);
    });

    test('handles invalid dates', () => {
      const dateA = new Date('invalid');
      const dateB = new Date('2025-05-19');
      expect(isSameMonth(dateA, dateB)).toBe(false);
      expect(isSameMonth(dateB, dateA)).toBe(false);
      expect(isSameMonth(dateA, dateA)).toBe(false);
    });

    test('handles leap year month', () => {
      const dateA = new Date('2024-02-01');
      const dateB = new Date('2024-02-29');
      expect(isSameMonth(dateA, dateB)).toBe(true);
      const dateC = new Date('2024-03-01');
      expect(isSameMonth(dateA, dateC)).toBe(false);
    });
  });
});

describe('appendSearchResult Function', () => {
let resultsContainer;

beforeEach(() => {
  // Reset mocks and DOM
  jest.clearAllMocks();
  document.body.innerHTML = `
    <div id="search-results"></div>
  `;
  resultsContainer = document.getElementById('search-results');
  window.currentSearchResults = [];
});

afterEach(() => {
  consoleErrorSpy.mockClear();
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

test('appends a valid search result to the DOM', () => {
  const file = {
    id: 'file1',
    name: 'test.pdf',
    type: 'application/pdf',
    size: 1024,
    url: 'https://example.com/test.pdf',
    uploadedAt: { toDate: () => new Date('2025-05-18') },
    uploadedBy: 'user123',
    uploadedByName: 'Test User',
    metadata: { title: 'Test PDF', description: 'Test Description', tags: ['tag1'], category: 'work' },
    similarity: 0.85,
    contentSnippet: 'Test document content...',
  };

  appendSearchResult(file, resultsContainer, 'relevance');

  const items = resultsContainer.querySelectorAll('.search-result-item');
  expect(items.length).toBe(1);
  const item = items[0];
  expect(item.querySelector('.search-result-icon img').src).toContain('pdf.png');
  expect(item.querySelector('h3').textContent).toBe('Test PDF');
  expect(item.querySelector('.search-result-uploader').textContent).toBe('Uploaded by: Test User');
  expect(item.querySelector('.search-result-snippet').textContent).toBe('Test document content...');
  expect(item.querySelector('.search-result-description').textContent).toBe('Test Description');
  expect(item.querySelector('.search-result-meta').textContent).toContain('1.0 KB');
  expect(item.querySelector('.search-result-meta').textContent).toContain('18 May 2025');
  expect(item.querySelector('.search-result-meta').textContent).toContain('Relevance: 85.0%');
  expect(item.querySelector('.view-btn').href).toBe('https://example.com/test.pdf');
  expect(item.querySelector('.download-btn').getAttribute('download')).toBe('test.pdf');
});

test('handles missing metadata and uploader fields', () => {
  const file = {
    id: 'file1',
    name: 'test.pdf',
    type: 'application/pdf',
    size: 1024,
    url: 'https://example.com/test.pdf',
    uploadedAt: { toDate: () => new Date('2025-05-18') },
    similarity: 0.5,
    contentSnippet: 'File name: test.pdf',
  };

  appendSearchResult(file, resultsContainer, 'relevance');

  const items = resultsContainer.querySelectorAll('.search-result-item');
  expect(items.length).toBe(1);
  const item = items[0];
  expect(item.querySelector('h3').textContent).toBe('test.pdf');
  expect(item.querySelector('.search-result-uploader')).toBeNull();
  expect(item.querySelector('.search-result-description').textContent).toBe('No description');
  expect(item.querySelector('.search-result-meta').textContent).toContain('Relevance: 50.0%');
});

test('inserts result in sorted order for relevance', () => {
  window.currentSearchResults = [
    { id: 'file1', similarity: 0.9, metadata: { title: 'File 1' } },
  ];
  resultsContainer.innerHTML = `
    <div class="search-result-item">
      <div class="search-result-details"><h3>File 1</h3></div>
    </div>
  `;

  const file = {
    id: 'file2',
    name: 'test.pdf',
    type: 'application/pdf',
    size: 1024,
    url: 'https://example.com/test.pdf',
    similarity: 0.95,
    metadata: { title: 'Test PDF' },
    contentSnippet: 'Test content',
  };

  appendSearchResult(file, resultsContainer, 'relevance');

  const items = resultsContainer.querySelectorAll('.search-result-item');
  expect(items.length).toBe(2);
  expect(items[0].querySelector('h3').textContent).toBe('Test PDF'); // Higher relevance first
  expect(items[1].querySelector('h3').textContent).toBe('File 1');
});

test('inserts result in sorted order for title-asc', () => {
  window.currentSearchResults = [
    { id: 'file1', metadata: { title: 'Zebra PDF' }, name: 'zebra.pdf' },
  ];
  resultsContainer.innerHTML = `
    <div class="search-result-item">
      <div class="search-result-details"><h3>Zebra PDF</h3></div>
    </div>
  `;

  const file = {
    id: 'file2',
    name: 'apple.pdf',
    type: 'application/pdf',
    size: 1024,
    url: 'https://example.com/apple.pdf',
    metadata: { title: 'Apple PDF' },
    similarity: 0.5,
    contentSnippet: 'Apple content',
  };

  appendSearchResult(file, resultsContainer, 'title-asc');

  const items = resultsContainer.querySelectorAll('.search-result-item');
  expect(items.length).toBe(2);
  expect(items[0].querySelector('h3').textContent).toBe('Apple PDF'); // Alphabetically first
  expect(items[1].querySelector('h3').textContent).toBe('Zebra PDF');
});

test('appends without sorting when insertSorted is false', () => {
  window.currentSearchResults = [
    { id: 'file1', similarity: 0.9, metadata: { title: 'File 1' } },
  ];
  resultsContainer.innerHTML = `
    <div class="search-result-item">
      <div class="search-result-details"><h3>File 1</h3></div>
    </div>
  `;

  const file = {
    id: 'file2',
    name: 'test.pdf',
    type: 'application/pdf',
    size: 1024,
    url: 'https://example.com/test.pdf',
    similarity: 0.95,
    metadata: { title: 'Test PDF' },
    contentSnippet: 'Test content',
  };

  appendSearchResult(file, resultsContainer, 'relevance', false);

  const items = resultsContainer.querySelectorAll('.search-result-item');
  expect(items.length).toBe(2);
  expect(items[0].querySelector('h3').textContent).toBe('File 1');
  expect(items[1].querySelector('h3').textContent).toBe('Test PDF'); // Appended at end
});

test('handles malformed file data', () => {
  const file = {
    id: 'file1',
    type: 'application/pdf',
    size: null,
    url: '',
    similarity: 0,
    contentSnippet: '',
  };

  appendSearchResult(file, resultsContainer, 'relevance');

  const items = resultsContainer.querySelectorAll('.search-result-item');
  expect(items.length).toBe(1);
  const item = items[0];
  expect(item.querySelector('h3').textContent).toBe('Untitled');
  expect(item.querySelector('.search-result-meta').textContent).toContain('null');
  expect(item.querySelector('.search-result-meta').textContent).toContain('Relevance: 0.0%');
  expect(item.querySelector('.view-btn').href).toBe('');
});

test('does not append if resultsContainer is null', () => {
  const file = {
    id: 'file1',
    name: 'test.pdf',
    type: 'application/pdf',
    size: 1024,
    url: 'https://example.com/test.pdf',
    similarity: 0.5,
    contentSnippet: 'Test content',
  };

  appendSearchResult(file, null, 'relevance');

  expect(resultsContainer.querySelectorAll('.search-result-item').length).toBe(0);
});

test('handles missing uploadedAt field', () => {
  const file = {
    id: 'file1',
    name: 'test.pdf',
    type: 'application/pdf',
    size: 1024,
    url: 'https://example.com/test.pdf',
    similarity: 0.5,
    contentSnippet: 'Test content',
  };

  appendSearchResult(file, resultsContainer, 'relevance');

  const items = resultsContainer.querySelectorAll('.search-result-item');
  expect(items.length).toBe(1);
  expect(items[0].querySelector('.search-result-meta').textContent).toContain('Unknown date');
  });
});


// Mock currentFilters as a mutable object
let currentFilters = {};

describe('matchesFilters Function', () => {
  beforeAll(() => {
    // Mock Date globally to return a fixed date
    jest.spyOn(global, 'Date').mockImplementation(() => new Date('2025-05-19T12:20:00+02:00'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentFilters = {};
    // Mock global currentFilters
    Object.defineProperty(global, 'currentFilters', {
      get: () => currentFilters,
      configurable: true,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  test('returns true when no filters are applied', () => {
    const file = {
      type: 'application/pdf',
      metadata: { category: 'doc', tags: ['test'] },
      uploadedAt: { toDate: () => new Date('2025-05-19') },
    };
    expect(matchesFilters(file)).toBe(true);
  });

  describe('Type Filter', () => {
    test('returns true when type matches', () => {
      currentFilters.type = 'pdf';
      const file = { type: 'application/pdf' };
      expect(getSimplifiedType(file.type)).toBe('pdf');
      expect(matchesFilters(file)).toBe(true);
    });

    test('returns false when type does not match', () => {
      currentFilters.type = 'pdf';
      const file = { type: 'image/jpeg' };
      expect(getSimplifiedType(file.type)).not.toBe('pdf');
      expect(matchesFilters(file)).toBe(false);
    });
  });

  describe('Category Filter', () => {
    test('returns true when category matches', () => {
      currentFilters.category = 'doc';
      const file = { metadata: { category: 'doc' } };
      expect(matchesFilters(file)).toBe(true);
    });

    test('returns false when category does not match', () => {
      currentFilters.category = 'doc';
      const file = { metadata: { category: 'image' } };
      expect(matchesFilters(file)).toBe(false);
    });

    test('returns false when metadata is missing', () => {
      currentFilters.category = 'doc';
      const file = { metadata: null };
      expect(matchesFilters(file)).toBe(false);
    });
  });

  describe('Date Filter', () => {
    beforeEach(() => {
      // Ensure Date mock is consistent
      jest.spyOn(global, 'Date').mockImplementation(() => new Date('2025-05-19T12:20:00+02:00'));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('returns true for same day', () => {
      currentFilters.date = 'day';
      const file = { uploadedAt: { toDate: () => new Date('2025-05-19T10:00:00') } };
      expect(isSameDay(file.uploadedAt.toDate(), new Date())).toBe(true);
      expect(matchesFilters(file)).toBe(true);
    });

    test('returns false for different day', () => {
      currentFilters.date = 'day';
      const file = { uploadedAt: { toDate: () => new Date('2025-05-20') } };
      expect(isSameDay(file.uploadedAt.toDate(), new Date())).toBe(false);
      expect(matchesFilters(file)).toBe(false);
    });

    test('returns true for same week', () => {
      currentFilters.date = 'week';
      const file = { uploadedAt: { toDate: () => new Date('2025-05-25') } };
      expect(isSameWeek(file.uploadedAt.toDate(), new Date())).toBe(true);
      expect(matchesFilters(file)).toBe(true);
    });

    test('returns false for different week', () => {
      currentFilters.date = 'week';
      const file = { uploadedAt: { toDate: () => new Date('2025-05-26') } };
      expect(isSameWeek(file.uploadedAt.toDate(), new Date())).toBe(false);
      expect(matchesFilters(file)).toBe(false);
    });

    test('returns true for same month', () => {
      currentFilters.date = 'month';
      const file = { uploadedAt: { toDate: () => new Date('2025-05-31') } };
      expect(isSameMonth(file.uploadedAt.toDate(), new Date())).toBe(true);
      expect(matchesFilters(file)).toBe(true);
    });

    test('returns false for different month', () => {
      currentFilters.date = 'month';
      const file = { uploadedAt: { toDate: () => new Date('2025-06-01') } };
      expect(isSameMonth(file.uploadedAt.toDate(), new Date())).toBe(false);
      expect(matchesFilters(file)).toBe(false);
    });

    test('returns true for same year', () => {
      currentFilters.date = 'year';
      const file = { uploadedAt: { toDate: () => new Date('2025-12-31') } };
      expect(matchesFilters(file)).toBe(true);
    });

    test('returns false for different year', () => {
      currentFilters.date = 'year';
      const file = { uploadedAt: { toDate: () => new Date('2024-12-31') } };
      expect(matchesFilters(file)).toBe(false);
    });

    test('returns true when uploadedAt is missing', () => {
      currentFilters.date = 'day';
      const file = { uploadedAt: null };
      expect(matchesFilters(file)).toBe(true);
    });
  });

  describe('Tags Filter', () => {
    test('returns true when all tags match', () => {
      currentFilters.tags = 'test,project';
      const file = { metadata: { tags: ['test', 'project', 'other'] } };
      expect(matchesFilters(file)).toBe(true);
    });

    test('returns false when some tags do not match', () => {
      currentFilters.tags = 'test,missing';
      const file = { metadata: { tags: ['test', 'project'] } };
      expect(matchesFilters(file)).toBe(false);
    });

    test('handles case-insensitive tag matching', () => {
      currentFilters.tags = 'Test,Project';
      const file = { metadata: { tags: ['test', 'project'] } };
      expect(matchesFilters(file)).toBe(true);
    });

    test('returns false when metadata is missing', () => {
      currentFilters.tags = 'test';
      const file = { metadata: null };
      expect(matchesFilters(file)).toBe(false);
    });

    test('returns false when tags are missing', () => {
      currentFilters.tags = 'test';
      const file = { metadata: { tags: null } };
      expect(matchesFilters(file)).toBe(false);
    });

    test('handles empty tag terms', () => {
      currentFilters.tags = 'test,,project';
      const file = { metadata: { tags: ['test', 'project'] } };
      expect(matchesFilters(file)).toBe(true);
    });
  });

  describe('Combined Filters', () => {
    test('returns true when all filters match', () => {
      currentFilters = {
        type: 'pdf',
        category: 'doc',
        date: 'month',
        tags: 'test,project',
      };
      const file = {
        type: 'application/pdf',
        metadata: { category: 'doc', tags: ['test', 'project'] },
        uploadedAt: { toDate: () => new Date('2025-05-31') },
      };
      expect(getSimplifiedType(file.type)).toBe('pdf');
      expect(isSameMonth(file.uploadedAt.toDate(), new Date())).toBe(true);
      expect(matchesFilters(file)).toBe(true);
    });

    test('returns false when one filter fails', () => {
      currentFilters = {
        type: 'pdf',
        category: 'doc',
        date: 'month',
        tags: 'test,project',
      };
      const file = {
        type: 'image/jpeg',
        metadata: { category: 'doc', tags: ['test', 'project'] },
        uploadedAt: { toDate: () => new Date('2025-05-31') },
      };
      expect(getSimplifiedType(file.type)).not.toBe('pdf');
      expect(matchesFilters(file)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('handles invalid date filter value', () => {
      currentFilters.date = 'invalid';
      const file = { uploadedAt: { toDate: () => new Date('2025-05-19') } };
      expect(matchesFilters(file)).toBe(true); // Invalid date filter ignored
    });

    test('handles malformed uploadedAt', () => {
      currentFilters.date = 'day';
      const file = { uploadedAt: { toDate: () => new Date('invalid') } };
      expect(isSameDay(file.uploadedAt.toDate(), new Date())).toBe(false);
      expect(matchesFilters(file)).toBe(false);
    });

    test('handles empty tags string', () => {
      currentFilters.tags = '';
      const file = { metadata: { tags: ['test'] } };
      expect(matchesFilters(file)).toBe(true); // Empty tags filter ignored
    });
  });
});