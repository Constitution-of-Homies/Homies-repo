// tests/profile.test.js
import { jest } from '@jest/globals';
import '../client/js/profile.js'; // Import to trigger DOMContentLoaded
import { auth } from '../client/js/firebase.js';

// Mock Firebase Auth
const mockAuth = {
  getAuth: jest.fn(() => ({ mockAuth: true })),
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
};
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js', () => ({
  onAuthStateChanged: (auth, callback) => mockAuth.onAuthStateChanged(callback),
}), { virtual: true });

// Mock Firebase Firestore
const mockFirestore = {
  doc: jest.fn((db, collection, id) => ({ collection, id })),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
};
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
  doc: jest.fn((db, collection, id) => ({ collection, id })),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
}), { virtual: true });

// Mock firebase.js
jest.mock('../client/js/firebase.js', () => ({
  auth: { mockAuth: true },
  db: { mockDb: true },
}));

// Mock window.location
const mockLocation = { href: '' };
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock window.alert
jest.spyOn(window, 'alert').mockImplementation(() => {});

// Mock console.error
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock DOM
beforeAll(() => {
  document.body.innerHTML = `
    <img class="profile-image" src="" />
    <div id="profile-name"></div>
    <button id="edit-profile-btn"></button>
    <div id="edit-drawer" class="hidden">
      <div class="drawer-backdrop"></div>
      <input id="name" value="" />
      <input id="email" value="" />
      <button id="cancel-btn"></button>
      <button id="save-btn"></button>
    </div>
    <button id="sign-out-btn"></button>
  `;
});

describe('Profile Module', () => {
  let getDoc, updateDoc;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
    ({ getDoc, updateDoc } = mockFirestore);

    // Reset DOM
    document.querySelector('.profile-image').src = '';
    document.getElementById('profile-name').textContent = '';
    document.getElementById('name').value = '';
    document.getElementById('email').value = '';
    document.getElementById('edit-drawer').classList.add('hidden');
    document.getElementById('edit-drawer').classList.remove('open');

    // Default Firestore mocks
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        username: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
      }),
    });
    updateDoc.mockResolvedValue();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  test('redirects to login when user is not logged in', async () => {
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(null));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    expect(mockLocation.href).toBe('login.html');
  }, 10000);

  test('loads user data and updates profile section when logged in', async () => {
    const user = { uid: 'user123', email: 'test@example.com', displayName: 'Display Name' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    expect(getDoc).toHaveBeenCalledWith({ collection: 'users', id: 'user123' });
    expect(document.querySelector('.profile-image').src).toBe('https://example.com/photo.jpg');
    expect(document.getElementById('profile-name').textContent).toBe('Test User');
    expect(mockLocation.href).not.toBe('login.html');
  }, 10000);

  test('handles missing user data', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => null,
    });
    const user = { uid: 'user123', email: 'test@example.com', displayName: 'Display Name' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    expect(document.querySelector('.profile-image').src).toBe('');
    expect(document.getElementById('profile-name').textContent).toBe('Display Name');
  }, 10000);

  test('uses user photoURL when userData photoURL is absent', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ username: 'Test User' }),
    });
    const user = { uid: 'user123', email: 'test@example.com', photoURL: 'https://user.com/photo.jpg' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    expect(document.querySelector('.profile-image').src).toBe('https://user.com/photo.jpg');
  }, 10000);

  test('falls back to "User" when no username or displayName', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ photoURL: 'https://example.com/photo.jpg' }),
    });
    const user = { uid: 'user123', email: 'test@example.com' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    expect(document.getElementById('profile-name').textContent).toBe('User');
  }, 10000);

  test('redirects to login on Firestore error', async () => {
    getDoc.mockRejectedValueOnce(new Error('Firestore error'));
    const user = { uid: 'user123', email: 'test@example.com' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading user data:', expect.any(Error));
    expect(mockLocation.href).toBe('login.html');
  }, 10000);

  test('opens edit drawer and populates form', async () => {
    const user = { uid: 'user123', email: 'test@example.com', displayName: 'Display Name' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    document.getElementById('edit-profile-btn').click();

    expect(document.getElementById('edit-drawer').classList.contains('hidden')).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20)); // Wait for transition
    expect(document.getElementById('edit-drawer').classList.contains('open')).toBe(true);
    expect(document.getElementById('name').value).toBe('Test User');
    expect(document.getElementById('email').value).toBe('test@example.com');
  }, 10000);

  test('closes drawer on cancel button click', async () => {
    const user = { uid: 'user123', email: 'test@example.com' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    document.getElementById('edit-profile-btn').click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    document.getElementById('cancel-btn').click();

    expect(document.getElementById('edit-drawer').classList.contains('open')).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(document.getElementById('edit-drawer').classList.contains('hidden')).toBe(true);
  }, 10000);

  test('closes drawer on backdrop click', async () => {
    const user = { uid: 'user123', email: 'test@example.com' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    document.getElementById('edit-profile-btn').click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    document.querySelector('.drawer-backdrop').click();

    expect(document.getElementById('edit-drawer').classList.contains('open')).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(document.getElementById('edit-drawer').classList.contains('hidden')).toBe(true);
  }, 10000);

  test('saves profile updates and updates UI', async () => {
    const user = { uid: 'user123', email: 'test@example.com', displayName: 'Display Name' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    document.getElementById('edit-profile-btn').click();
    document.getElementById('name').value = 'New Name';
    document.getElementById('email').value = 'new@example.com';
    document.getElementById('save-btn').click();

    await Promise.resolve();
    expect(updateDoc).toHaveBeenCalledWith(
      { collection: 'users', id: 'user123' },
      { displayName: 'New Name', email: 'new@example.com' }
    );
    expect(document.getElementById('profile-name').textContent).toBe('New Name');
    expect(document.getElementById('edit-drawer').classList.contains('hidden')).toBe(true);
  }, 10000);

  test('handles profile update error', async () => {
    updateDoc.mockRejectedValueOnce(new Error('Update error'));
    const user = { uid: 'user123', email: 'test@example.com' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    document.getElementById('edit-profile-btn').click();
    document.getElementById('name').value = 'New Name';
    document.getElementById('save-btn').click();

    await Promise.resolve();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating profile:', expect.any(Error));
    expect(window.alert).toHaveBeenCalledWith('Failed to update profile');
    expect(document.getElementById('edit-drawer').classList.contains('hidden')).toBe(false);
  }, 10000);

  test('handles sign out', async () => {
    mockAuth.signOut.mockResolvedValueOnce();
    document.getElementById('sign-out-btn').click();

    await Promise.resolve();
    expect(mockAuth.signOut).toHaveBeenCalled();
    expect(mockLocation.href).toBe('index.html');
  }, 10000);

  test('handles sign out error', async () => {
    mockAuth.signOut.mockRejectedValueOnce(new Error('Sign out error'));
    document.getElementById('sign-out-btn').click();

    await Promise.resolve();
    expect(mockAuth.signOut).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Sign out error:', expect.any(Error));
    expect(mockLocation.href).toBe('index.html');
  }, 10000);

  test('populates form with user data when userData is empty', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => null,
    });
    const user = { uid: 'user123', email: 'test@example.com', displayName: 'Display Name' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    document.getElementById('edit-profile-btn').click();

    expect(document.getElementById('name').value).toBe('Display Name');
    expect(document.getElementById('email').value).toBe('test@example.com');
  }, 10000);

  test('handles missing user email in form', async () => {
    const user = { uid: 'user123', displayName: 'Display Name' };
    mockAuth.onAuthStateChanged.mockImplementation((callback) => callback(user));
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();
    document.getElementById('edit-profile-btn').click();

    expect(document.getElementById('name').value).toBe('Test User');
    expect(document.getElementById('email').value).toBe('');
  }, 10000);
});