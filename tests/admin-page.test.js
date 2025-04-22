// admin-page.test.js
import { jest } from '@jest/globals';

// Mock firebase.js
jest.mock('../client/js/firebase.js', () => ({
  auth: { mockAuth: true },
  db: { mockDb: true },
}));

// Mock Firebase Auth CDN imports
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js', () => ({
  onAuthStateChanged: jest.fn(),
  browserLocalPersistence: { persistence: 'local' },
  setPersistence: jest.fn().mockResolvedValue(),
  signOut: jest.fn().mockResolvedValue(),
}), { virtual: true });

// Mock Firebase Firestore CDN imports
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
}), { virtual: true });

// Mock DOM elements and console.error
beforeAll(() => {
  document.body.innerHTML = `
    <div id="user-name"></div>
    <div id="user-email"></div>
    <img id="user-avatar" style="display: none;" />
    <button id="sign-out-btn"></button>
    <div id="uploads-card">
      <h2></h2>
      <p></p>
    </div>
  `;
  // Mock console.error globally
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// Mock window.location
const mockLocation = { href: '' };
delete global.window.location;
global.window.location = mockLocation;

// Mock window.alert
jest.spyOn(window, 'alert').mockImplementation(() => {});

describe('Admin Page', () => {
  let mockAuth, mockDb;
  let onAuthStateChanged, setPersistence, signOut;
  let doc, getDoc, collection, query, where, limit, getDocs;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules(); // Reset module cache to ensure fresh import
    // Reapply console.error mock to prevent any resets
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Extract mocked Firebase functions
    mockAuth = require('../client/js/firebase.js').auth;
    mockDb = require('../client/js/firebase.js').db;
    ({ onAuthStateChanged, setPersistence, signOut } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js'));
    ({ doc, getDoc, collection, query, where, limit, getDocs } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js'));

    // Reset DOM
    document.getElementById('user-name').textContent = '';
    document.getElementById('user-email').textContent = '';
    document.getElementById('user-avatar').src = '';
    document.getElementById('user-avatar').style.display = 'none';
    document.getElementById('uploads-card').querySelector('h2').textContent = '';
    document.getElementById('uploads-card').querySelector('p').textContent = '';

    // Reset window.location
    mockLocation.href = '';

    // Import admin-page.js after mocks and DOM setup
    await import('../client/js/admin-page.js');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sets auth persistence on load', async () => {
    expect(setPersistence).toHaveBeenCalledTimes(1);
    expect(setPersistence).toHaveBeenCalledWith({ mockAuth: true }, { persistence: 'local' });
  });

  test('redirects to login.html if no user is authenticated', () => {
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(null); // Simulate no user
    expect(mockLocation.href).toBe('login.html');
  });

  test('displays user data and loads uploads for authenticated user', async () => {
    const user = {
      uid: 'user123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/avatar.jpg',
    };
    const userData = {
      username: 'Custom User',
      photoURL: 'https://example.com/custom-avatar.jpg',
    };

    // Mock Firestore getDoc
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => userData,
    });
    doc.mockReturnValue({ id: 'user123' });

    // Mock Firestore query for uploads
    const mockQuerySnapshot = {
      empty: false,
      size: 3,
      docs: [],
    };
    getDocs.mockResolvedValue(mockQuerySnapshot);
    const mockCollectionRef = { collection: 'searchIndex' };
    collection.mockReturnValue(mockCollectionRef);
    const mockWhereRef = { where: true };
    where.mockReturnValue(mockWhereRef);
    const mockLimitRef = { limit: 5 };
    limit.mockReturnValue(mockLimitRef);
    query.mockReturnValue({ query: true });

    // Trigger auth state change
    const callback = onAuthStateChanged.mock.calls[0][1];
    await callback(user);

    // Verify UI updates
    expect(document.getElementById('user-name').textContent).toBe('Welcome, Custom User');
    expect(document.getElementById('user-email').textContent).toBe('test@example.com');
    expect(document.getElementById('user-avatar').src).toBe('https://example.com/custom-avatar.jpg');
    expect(document.getElementById('user-avatar').style.display).toBe('block');

    // Verify uploads query
    expect(collection).toHaveBeenCalledWith(mockDb, 'searchIndex');
    expect(where).toHaveBeenCalledWith('userId', '==', 'user123');
    expect(limit).toHaveBeenCalledWith(5);
    expect(query).toHaveBeenCalledWith(mockCollectionRef, mockWhereRef, mockLimitRef);
    expect(getDocs).toHaveBeenCalledWith({ query: true });

    // Verify uploads card update
    expect(document.getElementById('uploads-card').querySelector('h2').textContent).toBe('My Uploads');
    expect(document.getElementById('uploads-card').querySelector('p').textContent).toBe('View and manage your 3 uploaded files.');
  });

  test('falls back to basic user data on Firestore error', async () => {
    const user = {
      uid: 'user123',
      email: 'test@example.com',
      displayName: 'Test User',
    };

    // Mock Firestore error
    getDoc.mockRejectedValue(new Error('Firestore error'));
    doc.mockReturnValue({ id: 'user123' });

    // Trigger auth state change
    const callback = onAuthStateChanged.mock.calls[0][1];
    await callback(user);

    // Verify UI updates
    expect(document.getElementById('user-name').textContent).toBe('Welcome, Test User');
    expect(document.getElementById('user-email').textContent).toBe('test@example.com');
    expect(document.getElementById('user-avatar').style.display).toBe('none');
  });

  test('signs out and redirects to index.html on button click', async () => {
    signOut.mockResolvedValue();
    const signOutButton = document.getElementById('sign-out-btn');
    const clickEvent = new Event('click', { bubbles: true });
    signOutButton.dispatchEvent(clickEvent);

    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async signOut
    expect(signOut).toHaveBeenCalledWith(mockAuth);
    expect(mockLocation.href).toBe('index.html');
  });

  test('handles sign-out error gracefully', async () => {
    signOut.mockRejectedValueOnce(new Error('Sign-out error'));
    const signOutButton = document.getElementById('sign-out-btn');
    const clickEvent = new Event('click', { bubbles: true });
    signOutButton.dispatchEvent(clickEvent);

    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async signOut
    expect(signOut).toHaveBeenCalledWith(mockAuth);
    expect(window.alert).toHaveBeenCalledWith('Error signing out. Please try again.');
    expect(mockLocation.href).toBe('index.html'); // No redirect on error
  });

  test('handles empty uploads query', async () => {
    const user = { uid: 'user123', email: 'test@example.com' };
    getDoc.mockResolvedValue({ exists: () => false });
    doc.mockReturnValue({ id: 'user123' });

    // Mock empty query
    const mockQuerySnapshot = { empty: true, size: 0 };
    getDocs.mockResolvedValue(mockQuerySnapshot);
    const mockCollectionRef = { collection: 'searchIndex' };
    collection.mockReturnValue(mockCollectionRef);
    const mockWhereRef = { where: true };
    where.mockReturnValue(mockWhereRef);
    const mockLimitRef = { limit: 5 };
    limit.mockReturnValue(mockLimitRef);
    query.mockReturnValue({ query: true });

    // Trigger auth state change
    const callback = onAuthStateChanged.mock.calls[0][1];
    await callback(user);

    // Verify uploads card is unchanged
    expect(document.getElementById('uploads-card').querySelector('h2').textContent).toBe('');
    expect(document.getElementById('uploads-card').querySelector('p').textContent).toBe('');
  });

  test('handles uploads query error gracefully', async () => {
    const user = { uid: 'user123', email: 'test@example.com' };
    getDoc.mockResolvedValue({ exists: () => false });
    doc.mockReturnValue({ id: 'user123' });

    // Mock query error
    getDocs.mockRejectedValue(new Error('Query error'));
    const mockCollectionRef = { collection: 'searchIndex' };
    collection.mockReturnValue(mockCollectionRef);
    const mockWhereRef = { where: true };
    where.mockReturnValue(mockWhereRef);
    const mockLimitRef = { limit: 5 };
    limit.mockReturnValue(mockLimitRef);
    query.mockReturnValue({ query: true });

    // Trigger auth state change
    const callback = onAuthStateChanged.mock.calls[0][1];
    await callback(user);

    // Verify uploads card is unchanged
    expect(document.getElementById('uploads-card').querySelector('h2').textContent).toBe('');
    expect(document.getElementById('uploads-card').querySelector('p').textContent).toBe('');
  });
});