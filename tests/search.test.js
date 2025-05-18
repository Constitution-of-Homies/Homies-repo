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
  getFirestore: jest.fn(),
  collection: jest.fn(() => ({ collection: true })),
  query: jest.fn(() => ({ query: true })),
  getDocs: jest.fn(),
  doc: jest.fn(() => ({ mockDoc: true })),
  getDoc: jest.fn(),
};
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(() => ({ collection: true })),
  query: jest.fn(() => ({ query: true })),
  getDocs: jest.fn(),
  doc: jest.fn(() => ({ mockDoc: true })),
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

// Mock window.alert
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
    </select>
    <select id="filter-category">
      <option value="">All Categories</option>
      <option value="work">Work</option>
    </select>
    <select id="filter-date">
      <option value="">Any Date</option>
      <option value="year">This Year</option>
      <option value="day">Today</option>
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

    // Mock Firestore responses
    getDoc.mockImplementation(() => Promise.resolve({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-18') }, // Exact match for filter-date: day
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
          content: 'This is a test document content',
          embeddings: [0.4, 0.5, 0.6],
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
    }));

    // Debug setup
    console.log('Mock setup: getDocs', getDocs.mock.calls, 'getDoc', getDoc.mock.calls);

    // Import search.js
    try {
      await import('../client/js/search.js');
      console.log('search.js imported successfully');
    } catch (error) {
      console.error('Error importing search.js:', error);
    }
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('performs search with keyword match and displays results', async () => {
    document.querySelector('.search-input').value = 'test';
    try {
      await performSearch();
      jest.advanceTimersByTime(25000);
      await Promise.resolve();
    } catch (error) {
      console.error('performSearch error:', error);
    }

    const resultsContainer = document.getElementById('search-results');
    console.log('Results container:', resultsContainer.innerHTML);
    expect(resultsContainer.querySelectorAll('.search-result-item').length).toBe(0);
    expect(resultsContainer.querySelector('.search-result-details h3').textContent).toBe('Test PDF');
    expect(resultsContainer.querySelector('.search-result-snippet').textContent).toBe('This is a test document content...');
    expect(resultsContainer.querySelector('.search-result-meta').textContent).toContain('Relevance:');
    expect(document.querySelector('.search-results-container').style.display).toBe('block');
    expect(document.querySelector('.centered-content').classList.contains('search-active')).toBe(true);
  }, 30000);

  test('performs NLP-based search when nlp-toggle is checked', async () => {
    document.querySelector('.search-input').value = 'test';
    document.getElementById('nlp-toggle').checked = true;
    try {
      await performSearch();
      jest.advanceTimersByTime(25000);
      await Promise.resolve();
    } catch (error) {
      console.error('NLP performSearch error:', error);
    }

    expect(mockFetch).toHaveBeenCalledWith(
      'https://scriptorium.azurewebsites.net/api/generateEmbeddings',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' }),
      })
    );
    const resultsContainer = document.getElementById('search-results');
    console.log('NLP results:', resultsContainer.innerHTML);
    expect(resultsContainer.querySelectorAll('.search-result-item').length).toBe(1);
  }, 30000);

  test('displays no results when search term has no matches', async () => {
    getDocs.mockResolvedValueOnce({
      empty: true,
      docs: [],
      forEach: (fn) => [],
      [Symbol.iterator]: function* () {},
    });
    document.querySelector('.search-input').value = 'nonexistent';
    try {
      await performSearch();
      jest.advanceTimersByTime(25000);
      await Promise.resolve();
    } catch (error) {
      console.error('No results performSearch error:', error);
    }

    const resultsContainer = document.getElementById('search-results');
    console.log('No results:', resultsContainer.innerHTML);
    expect(resultsContainer.innerHTML).toBe('<p>No results found with relevance above 0.</p>');
    expect(document.querySelector('.search-results-container').style.display).toBe('block');
  }, 30000);

  test('alerts when search term is empty', async () => {
    document.querySelector('.search-input').value = '';
    await performSearch();
    jest.advanceTimersByTime(25000);
    await Promise.resolve();

    expect(window.alert).toHaveBeenCalledWith('Please enter a search term.');
    expect(document.getElementById('search-results').innerHTML).toBe('');
  }, 30000);

  test('applies filters correctly', async () => {
    document.querySelector('.search-input').value = 'test';
    document.getElementById('filter-type').value = 'pdf';
    document.getElementById('filter-category').value = 'work';
    document.getElementById('filter-date').value = 'day';
    document.getElementById('filter-tags').value = 'tag1';
    try {
      await performSearch();
      jest.advanceTimersByTime(25000);
      await Promise.resolve();
    } catch (error) {
      console.error('Filters performSearch error:', error);
    }

    const resultsContainer = document.getElementById('search-results');
    console.log('Filtered results:', resultsContainer.innerHTML);
    expect(resultsContainer.querySelectorAll('.search-result-item').length).toBe(0);
  }, 30000);

  test('sorts results by date-desc when selected', async () => {
    document.querySelector('.search-input').value = 'test';
    document.getElementById('sort-option').value = 'date-desc';
    try {
      await performSearch();
      jest.advanceTimersByTime(25000);
      await Promise.resolve();
    } catch (error) {
      console.error('Sort performSearch error:', error);
    }

    const resultsContainer = document.getElementById('search-results');
    console.log('Sorted results:', resultsContainer.innerHTML);
    expect(resultsContainer.querySelectorAll('.search-result-item').length).toBe(1);
    expect(document.getElementById('sort-option').value).toBe('date-desc');
  }, 30000);

  test('handles search error gracefully', async () => {
    getDocs.mockRejectedValueOnce(new Error('Firestore error'));
    document.querySelector('.search-input').value = 'test';
    try {
      await performSearch();
      jest.advanceTimersByTime(25000);
      await Promise.resolve();
    } catch (error) {
      console.error('Error handling performSearch error:', error);
    }

    const resultsContainer = document.getElementById('search-results');
    console.log('Error results:', resultsContainer.innerHTML);
    expect(resultsContainer.innerHTML).toBe('<p>Error performing search</p>');
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Error performing search: Firestore error'));
  }, 30000);

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
    jest.advanceTimersByTime(1000);
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
  }, 30000);

  test('formatFileSize formats bytes correctly', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(2097152)).toBe('2.0 MB');
    expect(formatFileSize(2147483648)).toBe('2.0 GB');
    expect(formatFileSize('unknown')).toBe('unknown');
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
  });

  test('getFileIcon returns correct icon HTML', () => {
    expect(getFileIcon('pdf')).toContain('pdf.png');
    expect(getFileIcon('image')).toContain('image.png');
    expect(getFileIcon('unknown')).toContain('default.png');
  });

  // New Tests for Exported Functions
  test('performs search with multiple results', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'search1',
          exists: () => true,
          data: () => ({
            itemId: 'file1',
            content: 'This is a test document content',
            embeddings: [0.4, 0.5, 0.6],
          }),
        },
        {
          id: 'search2',
          exists: () => true,
          data: () => ({
            itemId: 'file2',
            content: 'Another test document',
            embeddings: [0.3, 0.4, 0.5],
          }),
        },
      ],
      forEach: function (fn) {
        this.docs.forEach(fn);
      },
      [Symbol.iterator]: function* () {
        for (const doc of this.docs) {
          yield doc;
        }
      },
    });
    getDoc.mockImplementation((_, id) => Promise.resolve({
      exists: () => true,
      id: id === 'file1' ? 'file1' : 'file2',
      data: () => ({
        name: id === 'file1' ? 'test1.pdf' : 'test2.pdf',
        type: 'application/pdf',
        size: id === 'file1' ? 1024 : 2048,
        url: `https://example.com/${id}.pdf`,
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        uploadedBy: 'user123',
        uploadedByName: 'Test User',
        metadata: {
          title: id === 'file1' ? 'Test PDF 1' : 'Test PDF 2',
          description: 'Test Description',
          tags: ['tag1'],
          category: 'work',
        },
      }),
    }));
    document.querySelector('.search-input').value = 'test';
    try {
      await performSearch();
      jest.advanceTimersByTime(25000);
      await Promise.resolve();
    } catch (error) {
      console.error('Multiple results performSearch error:', error);
    }

    const resultsContainer = document.getElementById('search-results');
    console.log('Multiple results:', resultsContainer.innerHTML);
    expect(resultsContainer.querySelectorAll('.search-result-item').length).toBe(2);
    expect(resultsContainer.querySelectorAll('.search-result-details h3')[0].textContent).toBe('Test PDF 1');
    expect(resultsContainer.querySelectorAll('.search-result-details h3')[1].textContent).toBe('Test PDF 2');
  }, 30000);

  test('handles missing metadata in search results', async () => {
    getDoc.mockImplementationOnce(() => Promise.resolve({
      exists: () => true,
      id: 'file1',
      data: () => ({
        name: 'test.pdf',
        type: 'application/pdf',
        size: 1024,
        url: 'https://example.com/test.pdf',
        uploadedAt: { toDate: () => new Date('2025-05-18') },
      }),
    }));
    document.querySelector('.search-input').value = 'test';
    try {
      await performSearch();
      jest.advanceTimersByTime(25000);
      await Promise.resolve();
    } catch (error) {
      console.error('Missing metadata performSearch error:', error);
    }

    const resultsContainer = document.getElementById('search-results');
    console.log('Missing metadata results:', resultsContainer.innerHTML);
    expect(resultsContainer.querySelectorAll('.search-result-item').length).toBe(1);
    expect(resultsContainer.querySelector('.search-result-details h3').textContent).toBe('test.pdf');
    expect(resultsContainer.querySelector('.search-result-description').textContent).toBe('No description');
  }, 30000);

  test('handles archive item not found', async () => {
    getDoc.mockImplementationOnce(() => Promise.resolve({
      exists: () => false,
    }));
    document.querySelector('.search-input').value = 'test';
    try {
      await performSearch();
      jest.advanceTimersByTime(25000);
      await Promise.resolve();
    } catch (error) {
      console.error('Archive not found performSearch error:', error);
    }

    const resultsContainer = document.getElementById('search-results');
    console.log('Archive not found results:', resultsContainer.innerHTML);
    expect(resultsContainer.innerHTML).toBe('<p>No results found with relevance above 0.</p>');
  }, 30000);

  test('sorts results by title-asc', async () => {
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'search1',
          exists: () => true,
          data: () => ({
            itemId: 'file1',
            content: 'Test document',
            embeddings: [0.4, 0.5, 0.6],
          }),
        },
        {
          id: 'search2',
          exists: () => true,
          data: () => ({
            itemId: 'file2',
            content: 'Another test',
            embeddings: [0.3, 0.4, 0.5],
          }),
        },
      ],
      forEach: function (fn) {
        this.docs.forEach(fn);
      },
      [Symbol.iterator]: function* () {
        for (const doc of this.docs) {
          yield doc;
        }
      },
    });
    getDoc.mockImplementation((_, id) => Promise.resolve({
      exists: () => true,
      id: id === 'file1' ? 'file1' : 'file2',
      data: () => ({
        name: id === 'file1' ? 'zebra.pdf' : 'apple.pdf',
        type: 'application/pdf',
        size: 1024,
        url: `https://example.com/${id}.pdf`,
        uploadedAt: { toDate: () => new Date('2025-05-18') },
        uploadedBy: 'user123',
        uploadedByName: 'Test User',
        metadata: {
          title: id === 'file1' ? 'Zebra PDF' : 'Apple PDF',
          description: 'Test Description',
          tags: ['tag1'],
          category: 'work',
        },
      }),
    }));
    document.querySelector('.search-input').value = 'test';
    document.getElementById('sort-option').value = 'title-asc';
    try {
      await performSearch();
      jest.advanceTimersByTime(25000);
      await Promise.resolve();
    } catch (error) {
      console.error('Title-asc performSearch error:', error);
    }

    const resultsContainer = document.getElementById('search-results');
    console.log('Title-asc results:', resultsContainer.innerHTML);
    expect(resultsContainer.querySelectorAll('.search-result-item').length).toBe(2);
    expect(resultsContainer.querySelectorAll('.search-result-details h3')[0].textContent).toBe('Apple PDF');
    expect(resultsContainer.querySelectorAll('.search-result-details h3')[1].textContent).toBe('Zebra PDF');
  }, 30000);

  test('formatFileSize handles edge cases', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(-100)).toBe('-100 B');
    expect(formatFileSize(1023)).toBe('1023 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(undefined)).toBe(undefined);
  });

  test('getSimplifiedType handles unknown MIME types', () => {
    expect(getSimplifiedType('application/unknown')).toBe('application');
    expect(getSimplifiedType('video/mp4')).toBe('video');
    expect(getSimplifiedType('audio/mpeg')).toBe('audio');
    expect(getSimplifiedType(null)).toBe('default');
  });
});