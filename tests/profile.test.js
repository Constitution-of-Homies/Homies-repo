import { jest } from '@jest/globals';
import { updateProfileSection, setupEditProfile } from '../client/js/profile.js';
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

  test('updateProfileSection does nothing if user or userData is missing', () => {
    updateProfileSection(null, {});
    updateProfileSection({}, null);
    expect(document.querySelector('.profile-image').src).toBe('');
    expect(document.getElementById('profile-name').textContent).toBe('');
  });

  test('updateProfileSection updates DOM elements correctly', () => {
    const user = { uid: 'user123', photoURL: 'https://user.com/photo.jpg' };
    const userData = { username: 'Test User' };
    updateProfileSection(user, userData);
    expect(document.querySelector('.profile-image').src).toBe('https://user.com/photo.jpg');
    expect(document.getElementById('profile-name').textContent).toBe('Test User');
  });

  test('setupEditProfile logs error and returns if no user provided', () => {
    setupEditProfile(null, {});
    expect(consoleErrorSpy).toHaveBeenCalledWith('No user provided');
  });

  test('setupEditProfile handles missing DOM elements', () => {
    // Temporarily remove an element
    const saveBtn = document.getElementById('save-btn');
    saveBtn.remove();
    
    const user = { uid: 'user123', email: 'test@example.com' };
    setupEditProfile(user, {});
    
    expect(consoleErrorSpy).toHaveBeenCalledWith('Required DOM elements missing');
    
    // Restore element
    document.getElementById('edit-drawer').appendChild(saveBtn);
  });

  test('edit drawer opens and populates form with user data', async () => {
    const user = { uid: 'user123', email: 'test@example.com', displayName: 'Display Name' };
    const userData = { username: 'Test User' };
    setupEditProfile(user, userData);

    document.getElementById('edit-profile-btn').click();
    expect(document.getElementById('edit-drawer').classList.contains('hidden')).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.getElementById('edit-drawer').classList.contains('open')).toBe(true);
    expect(document.getElementById('name').value).toBe('Test User');
    expect(document.getElementById('email').value).toBe('test@example.com');
  });

  test('drawer closes on cancel button click', async () => {
    const user = { uid: 'user123', email: 'test@example.com' };
    setupEditProfile(user, {});
    
    document.getElementById('edit-profile-btn').click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    document.getElementById('cancel-btn').click();
    
    expect(document.getElementById('edit-drawer').classList.contains('open')).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(document.getElementById('edit-drawer').classList.contains('hidden')).toBe(true);
  });

  test('validates empty name input', async () => {
    const user = { uid: 'user123', email: 'test@example.com' };
    setupEditProfile(user, {});
    
    document.getElementById('edit-profile-btn').click();
    document.getElementById('name').value = '';
    document.getElementById('email').value = 'new@example.com';
    document.getElementById('save-btn').click();
    
    await Promise.resolve();
    expect(window.alert).toHaveBeenCalledWith('Name is required');
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test('validates invalid email format', async () => {
    const user = { uid: 'user123', email: 'test@example.com' };
    setupEditProfile(user, {});
    
    document.getElementById('edit-profile-btn').click();
    document.getElementById('name').value = 'New Name';
    document.getElementById('email').value = 'invalid-email';
    document.getElementById('save-btn').click();
    
    await Promise.resolve();
    expect(window.alert).toHaveBeenCalledWith('Invalid email format');
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test('saves profile with timestamp and shows success message', async () => {
    const user = { uid: 'user123', email: 'test@example.com', displayName: 'Display Name' };
    const userData = { username: 'Test User' };
    setupEditProfile(user, userData);
    
    document.getElementById('edit-profile-btn').click();
    document.getElementById('name').value = 'New Name';
    document.getElementById('email').value = 'new@example.com';
    document.getElementById('save-btn').click();
    
    await Promise.resolve();
    expect(updateDoc).toHaveBeenCalledWith(
      { collection: 'users', id: 'user123' },
      expect.objectContaining({
        displayName: 'New Name',
        email: 'new@example.com',
        updatedAt: expect.any(String)
      })
    );
    expect(document.getElementById('profile-name').textContent).toBe('New Name');
    expect(window.alert).toHaveBeenCalledWith('Profile updated successfully');
    expect(document.getElementById('edit-drawer').classList.contains('hidden')).toBe(true);
  });

  test('handles profile update error with detailed message', async () => {
    updateDoc.mockRejectedValueOnce(new Error('Update failed'));
    const user = { uid: 'user123', email: 'test@example.com' };
    setupEditProfile(user, {});
    
    document.getElementById('edit-profile-btn').click();
    document.getElementById('name').value = 'New Name';
    document.getElementById('email').value = 'new@example.com';
    document.getElementById('save-btn').click();
    
    await Promise.resolve();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating profile:', expect.any(Error));
    expect(window.alert).toHaveBeenCalledWith('Failed to update profile: Update failed');
    expect(document.getElementById('edit-drawer').classList.contains('hidden')).toBe(false);
  });

  test('trims input values before saving', async () => {
    const user = { uid: 'user123', email: 'test@example.com' };
    setupEditProfile(user, {});
    
    document.getElementById('edit-profile-btn').click();
    document.getElementById('name').value = '  New Name  ';
    document.getElementById('email').value = '  new@example.com  ';
    document.getElementById('save-btn').click();
    
    await Promise.resolve();
    expect(updateDoc).toHaveBeenCalledWith(
      { collection: 'users', id: 'user123' },
      expect.objectContaining({
        displayName: 'New Name',
        email: 'new@example.com'
      })
    );
  });
});