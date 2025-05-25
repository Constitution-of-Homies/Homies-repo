// tests/signup.test.js
import { jest } from '@jest/globals';

// Mock Firebase Auth
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  GoogleAuthProvider: jest.fn(() => ({ provider: 'google' })),
  signInWithPopup: jest.fn(),
  setPersistence: jest.fn(),
  browserLocalPersistence: { type: 'LOCAL' },
}), { virtual: true });

// Mock Firebase Firestore
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
  doc: jest.fn(() => ({ mockDoc: true })), // Return mocked document
  setDoc: jest.fn(),
}), { virtual: true });

// Mock firebase.js
jest.mock('../client/js/firebase.js', () => ({
  auth: { mockAuth: true },
  db: { mockDb: true },
}));

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(global, 'location', { value: mockLocation, writable: true });

// Mock window.alert
jest.spyOn(window, 'alert').mockImplementation(() => {});

// Mock DOM
beforeAll(() => {
  document.body.innerHTML = `
    <form>
      <input id="email" type="email" value="" />
      <input id="username" type="text" value="" />
      <input id="password" type="password" value="" />
      <input id="confirm-password" type="password" value="" />
      <button id="signup-btn">Sign Up</button>
      <button id="google-login-btn">Sign Up with Google</button>
    </form>
  `;
  // Mock console.log and console.error
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Signup Module', () => {
  let createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    setPersistence,
    doc,
    setDoc;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.resetModules();

    // Reapply console mocks
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Extract mocks
    ({
      createUserWithEmailAndPassword,
      GoogleAuthProvider,
      signInWithPopup,
      setPersistence,
    } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js'));
    ({ doc, setDoc } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js'));

    // Reset DOM
    document.getElementById('email').value = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('confirm-password').value = '';
    mockLocation.href = '';

    // Mock setPersistence
    setPersistence.mockResolvedValue();

    // Import signup.js and trigger initialization
    await import('../client/js/signup.js');
    await new Promise(resolve => setTimeout(resolve, 100)); // Ensure async init completes
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sets auth persistence on initialization', async () => {
    expect(setPersistence).toHaveBeenCalledWith({ mockAuth: true }, { type: 'LOCAL' });
  });

  test('signs up with email and password successfully', async () => {
    const user = { uid: 'user123', email: 'test@example.com' };
    createUserWithEmailAndPassword.mockResolvedValue({ user });
    setDoc.mockResolvedValue();

    document.getElementById('email').value = 'test@example.com';
    document.getElementById('username').value = 'TestUser';
    document.getElementById('password').value = 'password123';
    document.getElementById('confirm-password').value = 'password123';
    document.getElementById('signup-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      { mockAuth: true },
      'test@example.com',
      'password123'
    );
    expect(doc).toHaveBeenCalledWith({ mockDb: true }, 'users', 'user123');
    expect(setDoc).toHaveBeenCalledWith(
      { mockDoc: true },
      {
        email: 'test@example.com',
        username: 'testuser',
        createdAt: expect.any(Date),
        provider: 'email/password',
        role: 'admin',
        lastLogin: expect.any(Date),
      }
    );
    expect(console.log).toHaveBeenCalledWith('User signed up and profile created:', 'user123');
    expect(window.alert).toHaveBeenCalledWith('Signup successful!');
    expect(mockLocation.href).toBe('./index.html');
  });

  test('handles empty username during email signup', async () => {
    document.getElementById('email').value = 'test@example.com';
    document.getElementById('username').value = '';
    document.getElementById('password').value = 'password123';
    document.getElementById('confirm-password').value = 'password123';
    document.getElementById('signup-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('Please enter a username');
    expect(mockLocation.href).toBe('');
  });

  test('handles mismatched passwords during email signup', async () => {
    document.getElementById('email').value = 'test@example.com';
    document.getElementById('username').value = 'TestUser';
    document.getElementById('password').value = 'password123';
    document.getElementById('confirm-password').value = 'different123';
    document.getElementById('signup-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('Passwords do not match. Please make sure both passwords are identical.');
    expect(mockLocation.href).toBe('');
  });

  test('handles email-already-in-use error during email signup', async () => {
    createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use', message: 'Email in use' });

    document.getElementById('email').value = 'test@example.com';
    document.getElementById('username').value = 'TestUser';
    document.getElementById('password').value = 'password123';
    document.getElementById('confirm-password').value = 'password123';
    document.getElementById('signup-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      { mockAuth: true },
      'test@example.com',
      'password123'
    );
    expect(window.alert).toHaveBeenCalledWith('Signup failed. This email is already registered.');
    expect(mockLocation.href).toBe('');
  });

  test('handles invalid-email error during email signup', async () => {
    createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/invalid-email', message: 'Invalid email' });

    document.getElementById('email').value = 'invalid-email';
    document.getElementById('username').value = 'TestUser';
    document.getElementById('password').value = 'password123';
    document.getElementById('confirm-password').value = 'password123';
    document.getElementById('signup-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      { mockAuth: true },
      'invalid-email',
      'password123'
    );
    expect(window.alert).toHaveBeenCalledWith('Signup failed. Please enter a valid email address.');
    expect(mockLocation.href).toBe('');
  });

  test('handles weak-password error during email signup', async () => {
    createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/weak-password', message: 'Weak password' });

    document.getElementById('email').value = 'test@example.com';
    document.getElementById('username').value = 'TestUser';
    document.getElementById('password').value = 'weak';
    document.getElementById('confirm-password').value = 'weak';
    document.getElementById('signup-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      { mockAuth: true },
      'test@example.com',
      'weak'
    );
    expect(window.alert).toHaveBeenCalledWith('Signup failed. Password should be at least 6 characters.');
    expect(mockLocation.href).toBe('');
  });

  test('handles generic error during email signup', async () => {
    createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/unknown', message: 'Unknown error' });

    document.getElementById('email').value = 'test@example.com';
    document.getElementById('username').value = 'TestUser';
    document.getElementById('password').value = 'password123';
    document.getElementById('confirm-password').value = 'password123';
    document.getElementById('signup-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      { mockAuth: true },
      'test@example.com',
      'password123'
    );
    expect(window.alert).toHaveBeenCalledWith('Signup failed. Unknown error');
    expect(mockLocation.href).toBe('');
  });

  test('signs up with Google successfully', async () => {
    const user = {
      uid: 'user123',
      email: 'test@google.com',
      displayName: 'Test Google',
      photoURL: 'https://example.com/avatar.jpg',
    };
    signInWithPopup.mockResolvedValue({ user });
    setDoc.mockResolvedValue();

    document.getElementById('google-login-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(signInWithPopup).toHaveBeenCalledWith({ mockAuth: true }, { provider: 'google' });
    expect(doc).toHaveBeenCalledWith({ mockDb: true }, 'users', 'user123');
    expect(setDoc).toHaveBeenCalledWith(
      { mockDoc: true },
      {
        email: 'test@google.com',
        username: 'Test Google',
        photoURL: 'https://example.com/avatar.jpg',
        createdAt: expect.any(Date),
        provider: 'google',
        role: 'admin',
        lastLogin: expect.any(Date),
      },
      { merge: true }
    );
    expect(console.log).toHaveBeenCalledWith('Google login successful:', 'user123');
    expect(mockLocation.href).toBe('index.html');
  });

  test('handles popup-closed error during Google signup', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user', message: 'Popup closed' });

    document.getElementById('google-login-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(signInWithPopup).toHaveBeenCalledWith({ mockAuth: true }, { provider: 'google' });
    expect(window.alert).toHaveBeenCalledWith('Google login failed. You closed the sign-in window.');
    expect(mockLocation.href).toBe('');
  });

  test('handles cancelled-popup-request error during Google signup', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/cancelled-popup-request', message: 'Cancelled' });

    document.getElementById('google-login-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(signInWithPopup).toHaveBeenCalledWith({ mockAuth: true }, { provider: 'google' });
    expect(window.alert).toHaveBeenCalledWith('Google login failed. Sign-in was cancelled.');
    expect(mockLocation.href).toBe('');
  });

  test('handles generic error during Google signup', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/unknown', message: 'Unknown error' });

    document.getElementById('google-login-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(signInWithPopup).toHaveBeenCalledWith({ mockAuth: true }, { provider: 'google' });
    expect(window.alert).toHaveBeenCalledWith('Google login failed. Unknown error');
    expect(mockLocation.href).toBe('');
  });
});
