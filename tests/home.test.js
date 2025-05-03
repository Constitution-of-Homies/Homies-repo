// tests/home.test.js
import { jest } from '@jest/globals';

// Mock Firebase app
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js', () => ({
  initializeApp: jest.fn().mockReturnValue({ mockApp: true }),
}), { virtual: true });

// Mock Firebase Auth
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js', () => ({
  getAuth: jest.fn().mockReturnValue({ mockAuth: true }),
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn().mockResolvedValue(),
}), { virtual: true });

// Mock Firebase Firestore
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
  getFirestore: jest.fn().mockReturnValue({ mockDb: true }),
  doc: jest.fn(),
  getDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}), { virtual: true });

// Mock firebase.js
jest.mock('../client/js/firebase.js', () => ({
  auth: { mockAuth: true },
  db: { mockDb: true },
}));

// Mock window.location
const mockLocation = {
  href: '',
  reload: jest.fn(),
};
Object.defineProperty(global, 'location', { value: mockLocation, writable: true });

// Mock window.alert
jest.spyOn(window, 'alert').mockImplementation(() => {});

// Mock DOM
beforeAll(() => {
  document.body.innerHTML = `
    <div class="profile-item" aria-expanded="false">
      <img src="./images/icons/user.png" class="nav-icon" alt="Profile">
      <p class="nav-text">Profile</p>
    </div>
    <ul class="profile-options"></ul>
    <ul>
      <li>Item 1</li>
      <li>Dashboard</li>
      <li>Item 3</li>
    </ul>
    <button class="filter-button"></button>
    <div class="filter-section">
      <select id="filter-type"><option value=""></option><option value="pdf">PDF</option></select>
      <select id="filter-category"><option value=""></option><option value="docs">Docs</option></select>
      <select id="filter-date"><option value=""></option><option value="day">Today</option></select>
      <input id="filter-tags" type="text">
    </div>
    <div class="search-container">
      <input class="search-input" type="text">
      <button class="search-button">Search</button>
      <button class="clear-search-btn">Clear</button>
    </div>
    <div class="search-results-container" style="display: none;">
      <div id="search-results"></div>
      <div class="pagination-container" style="display: none;"></div>
    </div>
  `;
  // Mock console.error and console.log
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('Home Module', () => {
  let onAuthStateChanged, getDoc, getDocs, query, where, collection, doc, signOut;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.resetModules();

    // Reapply console mocks
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Extract mocks
    ({ onAuthStateChanged, signOut } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js'));
    ({ doc, getDoc, collection, query, where, getDocs } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js'));

    // Reset DOM
    document.body.innerHTML = document.body.innerHTML; // Force full DOM reset
    document.querySelector('.profile-item').setAttribute('aria-expanded', 'false');
    document.querySelector('.profile-options').innerHTML = '';
    document.querySelector('.nav-text').textContent = 'Profile'; // Explicitly reset profile text
    document.querySelector('.profile-item img').src = './images/icons/user.png'; // Explicitly reset profile icon
    document.querySelector('.profile-item img').classList.add('nav-icon');
    document.querySelector('.profile-item img').classList.remove('user-avatar');
    document.querySelector('.filter-section').classList.remove('active');
    document.querySelector('.search-container').style.borderRadius = '4px';
    document.querySelector('.search-input').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-tags').value = '';
    document.querySelector('.search-results-container').style.display = 'none';
    document.getElementById('search-results').innerHTML = '';
    document.querySelector('.pagination-container').style.display = 'none';
    mockLocation.href = '';
    mockLocation.reload.mockReset();
    window.currentSearchResults = [];

    // Mock Firestore query
    query.mockImplementation((...args) => ({ query: args }));
    where.mockImplementation((field, op, value) => ({ where: { field, op, value } }));
    collection.mockImplementation(path => ({ collection: path }));

    // Import home.js and trigger DOMContentLoaded
    await import('../client/js/home.js');
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 100)); // Ensure DOMContentLoaded completes
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Minimal cleanup to preserve event listeners
    document.querySelector('.profile-options').innerHTML = '';
  });

  test('updates profile UI for logged-in user', async () => {
    const user = { uid: 'user123', displayName: 'Test User', photoURL: 'https://example.com/avatar.jpg' };
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ username: 'TestUser', photoURL: 'https://example.com/avatar.jpg' }),
    });
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    await new Promise(resolve => setTimeout(resolve, 300));
    const profileText = document.querySelector('.profile-item .nav-text');
    const profileIcon = document.querySelector('.profile-item img');
    const profileOptions = document.querySelector('.profile-options');
    expect(profileText.textContent).toBe('TestUser');
    expect(profileIcon.src).toBe('https://example.com/avatar.jpg');
    expect(profileIcon.classList.contains('user-avatar')).toBe(true);
    expect(profileIcon.classList.contains('nav-icon')).toBe(false);
    expect(profileOptions.innerHTML).toContain('Logout');
  });

  test('updates UI for logged-out user', async () => {
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(null);
    await new Promise(resolve => setTimeout(resolve, 300));
    const profileText = document.querySelector('.profile-item .nav-text');
    const profileIcon = document.querySelector('.profile-item img');
    const profileOptions = document.querySelector('.profile-options');
    expect(profileText.textContent).toBe('Profile');
    expect(profileIcon.src).toContain('user.png');
    expect(profileIcon.classList.contains('user-avatar')).toBe(false);
    expect(profileIcon.classList.contains('nav-icon')).toBe(true);
    expect(profileOptions.innerHTML).toContain('Login');
    expect(profileOptions.innerHTML).toContain('Sign Up');
  });

  test('redirects to profile for logged-in user on dashboard click', async () => {
    const user = { uid: 'user123' };
    getDoc.mockResolvedValue({ exists: () => false });
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    await new Promise(resolve => setTimeout(resolve, 300));
    const dashboardItem = document.querySelector('li:nth-child(2)');
    dashboardItem.click();
    expect(mockLocation.href).toBe('profile.html');
  });

  test('redirects to login for logged-out user on dashboard click', async () => {
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(null);
    await new Promise(resolve => setTimeout(resolve, 300));
    const dashboardItem = document.querySelector('li:nth-child(2)');
    dashboardItem.click();
    expect(mockLocation.href).toBe('login.html');
  });

  test('logs out user on logout button click', async () => {
    const user = { uid: 'user123' };
    getDoc.mockResolvedValue({ exists: () => false });
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);
    await new Promise(resolve => setTimeout(resolve, 300));
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.click();
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(signOut).toHaveBeenCalled();
      expect(mockLocation.reload).toHaveBeenCalled();
    } else {
      throw new Error('Logout button not found');
    }
  });

  test('toggles filter section on filter button click', async () => {
    const filterButton = document.querySelector('.filter-button');
    filterButton.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(document.querySelector('.filter-section').classList.contains('active')).toBe(true);
    expect(document.querySelector('.search-container').style.borderRadius).toBe('4px 4px 0 0');
    filterButton.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(document.querySelector('.filter-section').classList.contains('active')).toBe(false);
    expect(document.querySelector('.search-container').style.borderRadius).toBe('4px');
  });

  test('displays search results with pagination', async () => {
    const mockFiles = [
      {
        id: 'file1',
        data: () => ({
          type: 'application/pdf',
          url: 'https://example.com/file1.pdf',
          name: 'test.pdf',
          size: 1024,
          uploadedAt: { toDate: () => new Date('2023-01-01') },
          metadata: { title: 'Test PDF', description: 'A test file', tags: ['test'], category: 'docs' },
        }),
      },
    ];
    getDocs.mockResolvedValue({
      empty: false,
      size: 1,
      forEach: callback => mockFiles.forEach(doc => callback(doc)),
    });
    document.querySelector('.search-input').value = 'Test';
    const searchButton = document.querySelector('.search-button');
    searchButton.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    const resultsContainer = document.getElementById('search-results');
    const searchContainer = document.querySelector('.search-results-container');
    const paginationContainer = document.querySelector('.pagination-container');
    expect(resultsContainer.querySelectorAll('.search-result-item').length).toBe(1);
    expect(resultsContainer.innerHTML).toContain('Test PDF');
    expect(searchContainer.style.display).toBe('block');
    expect(paginationContainer.style.display).toBe('flex');
  });

  test('displays no results message for empty search', async () => {
    getDocs.mockResolvedValue({
      empty: false,
      size: 0,
      forEach: jest.fn(),
    });
    document.querySelector('.search-input').value = 'nonexistent';
    const searchButton = document.querySelector('.search-button');
    searchButton.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    const resultsContainer = document.getElementById('search-results');
    expect(resultsContainer.innerHTML).toContain('No results found');
    expect(document.querySelector('.search-results-container').style.display).toBe('block');
  });

  test('clears search results on clear button click', async () => {
    const mockFiles = [
      {
        id: 'file1',
        data: () => ({
          type: 'application/pdf',
          url: 'https://example.com/file1.pdf',
          name: 'test.pdf',
          metadata: { title: 'Test PDF' },
        }),
      },
    ];
    getDocs.mockResolvedValue({
      empty: false,
      size: 1,
      forEach: callback => mockFiles.forEach(doc => callback(doc)),
    });
    document.querySelector('.search-input').value = 'Test';
    const searchButton = document.querySelector('.search-button');
    searchButton.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    const clearBtn = document.querySelector('.clear-search-btn');
    clearBtn.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(document.querySelector('.search-input').value).toBe('');
    expect(document.getElementById('filter-type').value).toBe('');
    expect(document.getElementById('filter-category').value).toBe('');
    expect(document.getElementById('filter-date').value).toBe('');
    expect(document.getElementById('filter-tags').value).toBe('');
    expect(document.querySelector('.search-results-container').style.display).toBe('none');
    expect(document.getElementById('search-results').innerHTML).toBe('');
    expect(window.currentSearchResults).toEqual([]);
  });

  test('filters search results by type', async () => {
    const mockFiles = [
      {
        id: 'file1',
        data: () => ({
          type: 'application/pdf',
          url: 'https://example.com/file1.pdf',
          name: 'test.pdf',
          metadata: { title: 'Test PDF', category: 'docs' },
        }),
      },
      {
        id: 'file2',
        data: () => ({
          type: 'image/png',
          url: 'https://example.com/file2.png',
          name: 'image.png',
          metadata: { title: 'Test Image', category: 'docs' },
        }),
      },
    ];
    getDocs.mockResolvedValue({
      empty: false,
      size: 2,
      forEach: callback => mockFiles.forEach(doc => callback(doc)),
    });
    document.querySelector('.search-input').value = 'Test';
    document.getElementById('filter-type').value = 'pdf';
    const searchButton = document.querySelector('.search-button');
    searchButton.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    const resultsContainer = document.getElementById('search-results');
    expect(resultsContainer.querySelectorAll('.search-result-item').length).toBe(1);
    expect(resultsContainer.innerHTML).toContain('Test PDF');
    expect(resultsContainer.innerHTML).not.toContain('Test Image');
  });

  test('handles search error', async () => {
    getDocs.mockRejectedValue(new Error('Firestore error'));
    document.querySelector('.search-input').value = 'Test';
    const searchButton = document.querySelector('.search-button');
    searchButton.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(window.alert).toHaveBeenCalledWith('Error performing search');
  });

  test('toggles profile dropdown on mouse events', async () => {
    const profileItem = document.querySelector('.profile-item');
    profileItem.dispatchEvent(new Event('mouseenter', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(profileItem.getAttribute('aria-expanded')).toBe('true');
    profileItem.dispatchEvent(new Event('mouseleave', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(profileItem.getAttribute('aria-expanded')).toBe('false');
  });

  test('simplifies file type correctly', async () => {
    const mockFiles = [
      {
        id: 'file1',
        data: () => ({
          type: 'application/pdf',
          url: 'https://example.com/file1.pdf',
          name: 'test.pdf',
          metadata: { title: 'Test PDF', description: 'A test file', tags: ['test'], category: 'docs' },
        }),
      },
    ];
    getDocs.mockResolvedValue({
      empty: false,
      size: 1,
      forEach: callback => mockFiles.forEach(doc => callback(doc)),
    });
    document.querySelector('.search-input').value = 'Test';
    document.getElementById('filter-type').value = 'pdf';
    const searchButton = document.querySelector('.search-button');
    searchButton.dispatchEvent(new Event('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    const resultsContainer = document.getElementById('search-results');
    expect(resultsContainer.innerHTML).toContain('📕'); // PDF icon
  });

  test('formats file size correctly', async () => {
    const { formatFileSize } = await import('../client/js/home.js');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(2097152)).toBe('2.0 MB');
    expect(formatFileSize(2147483648)).toBe('2.0 GB');
    expect(formatFileSize('invalid')).toBe('Unknown size');
  });

  test('formats date correctly', async () => {
    const { formatDate } = await import('../client/js/home.js');
    const date = new Date('2023-01-01');
    expect(formatDate(date)).toBe('1 Jan 2023');
    expect(formatDate(null)).toBe('Unknown date');
  });
});