// tests/login.test.js
import { jest } from '@jest/globals';

// Mock Firebase Auth
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js', () => ({
  signInWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  onAuthStateChanged: jest.fn(),
  setPersistence: jest.fn(),
  browserLocalPersistence: { type: 'LOCAL' },
  GoogleAuthProvider: jest.fn(() => ({ provider: 'google' })),
  signInWithPopup: jest.fn(),
}), { virtual: true });

// Mock Firebase Firestore
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => ({
  doc: jest.fn(() => ({ mockDoc: true })), // Return mocked document
  getDoc: jest.fn(),
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
      <input id="password" type="password" value="" />
      <button id="login-btn">Login</button>
      <a id="forgot-password" href="#">Forgot Password?</a>
      <button id="google-login-btn">Login with Google</button>
    </form>
  `;
  // Mock console.log and console.error
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Login Module', () => {
  let signInWithEmailAndPassword,
    sendPasswordResetEmail,
    onAuthStateChanged,
    setPersistence,
    signInWithPopup,
    GoogleAuthProvider,
    doc,
    getDoc,
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
      signInWithEmailAndPassword,
      sendPasswordResetEmail,
      onAuthStateChanged,
      setPersistence,
      GoogleAuthProvider,
      signInWithPopup,
    } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js'));
    ({ doc, getDoc, setDoc } = require('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js'));

    // Reset DOM
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    mockLocation.href = '';

    // Mock setPersistence
    setPersistence.mockResolvedValue();

    // Import login.js and trigger initialization
    await import('../client/js/login.js');
    await new Promise(resolve => setTimeout(resolve, 100)); // Ensure async init completes
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sets auth persistence on initialization', async () => {
    expect(setPersistence).toHaveBeenCalledWith({ mockAuth: true }, { type: 'LOCAL' });
  });

  test('logs in with email and password successfully', async () => {
    const user = { uid: 'user123', email: 'test@example.com', displayName: 'Test User' };
    signInWithEmailAndPassword.mockResolvedValue({ user });
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ username: 'TestUser' }),
    });

    document.getElementById('email').value = 'test@example.com';
    document.getElementById('password').value = 'password123';
    document.getElementById('login-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      { mockAuth: true },
      'test@example.com',
      'password123'
    );
    expect(getDoc).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('User signed in:', user);
    expect(console.log).toHaveBeenCalledWith('User data:', { username: 'TestUser' });
    expect(mockLocation.href).toBe('./index.html');
  });

  test('handles user-not-found error during email login', async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/user-not-found', message: 'User not found' });

    document.getElementById('email').value = 'nonexistent@example.com';
    document.getElementById('password').value = 'password123';
    document.getElementById('login-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      { mockAuth: true },
      'nonexistent@example.com',
      'password123'
    );
    expect(window.alert).toHaveBeenCalledWith('Login failed. No account found with this email.');
    expect(mockLocation.href).toBe('');
  });

  test('handles wrong-password error during email login', async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password', message: 'Wrong password' });

    document.getElementById('email').value = 'test@example.com';
    document.getElementById('password').value = 'wrongpassword';
    document.getElementById('login-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      { mockAuth: true },
      'test@example.com',
      'wrongpassword'
    );
    expect(window.alert).toHaveBeenCalledWith('Login failed. Incorrect password.');
    expect(mockLocation.href).toBe('');
  });

  test('handles generic error during email login', async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/unknown', message: 'Unknown error' });

    document.getElementById('email').value = 'test@example.com';
    document.getElementById('password').value = 'password123';
    document.getElementById('login-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      { mockAuth: true },
      'test@example.com',
      'password123'
    );
    expect(window.alert).toHaveBeenCalledWith('Login failed. Unknown error');
    expect(mockLocation.href).toBe('');
  });

  test('sends password reset email successfully', async () => {
    sendPasswordResetEmail.mockResolvedValue();

    document.getElementById('email').value = 'test@example.com';
    document.getElementById('forgot-password').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(sendPasswordResetEmail).toHaveBeenCalledWith({ mockAuth: true }, 'test@example.com');
    expect(console.log).toHaveBeenCalledWith('Password reset email sent!');
    expect(window.alert).toHaveBeenCalledWith('Password reset email sent! Please check your inbox.');
  });

  test('handles empty email for password reset', async () => {
    document.getElementById('email').value = '';
    document.getElementById('forgot-password').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('Please enter your email address');
  });

  test('handles user-not-found error for password reset', async () => {
    sendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found', message: 'User not found' });

    document.getElementById('email').value = 'nonexistent@example.com';
    document.getElementById('forgot-password').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(sendPasswordResetEmail).toHaveBeenCalledWith({ mockAuth: true }, 'nonexistent@example.com');
    expect(window.alert).toHaveBeenCalledWith('Failed to send reset email. No account found with this email.');
  });

  test('handles generic error for password reset', async () => {
    sendPasswordResetEmail.mockRejectedValue({ code: 'auth/unknown', message: 'Unknown error' });

    document.getElementById('email').value = 'test@example.com';
    document.getElementById('forgot-password').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(sendPasswordResetEmail).toHaveBeenCalledWith({ mockAuth: true }, 'test@example.com');
    expect(window.alert).toHaveBeenCalledWith('Failed to send reset email. Unknown error');
  });

  test('logs in with Google successfully', async () => {
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

  test('handles popup-closed error during Google login', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user', message: 'Popup closed' });

    document.getElementById('google-login-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(signInWithPopup).toHaveBeenCalledWith({ mockAuth: true }, { provider: 'google' });
    expect(window.alert).toHaveBeenCalledWith('Google login failed. You closed the sign-in window.');
    expect(mockLocation.href).toBe('');
  });

  test('handles generic error during Google login', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/unknown', message: 'Unknown error' });

    document.getElementById('google-login-btn').click();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(signInWithPopup).toHaveBeenCalledWith({ mockAuth: true }, { provider: 'google' });
    expect(window.alert).toHaveBeenCalledWith('Google login failed. Unknown error');
    expect(mockLocation.href).toBe('');
  });

  test('handles auth state change for logged-in user', async () => {
    const user = { uid: 'user123' };
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(user);

    expect(console.log).toHaveBeenCalledWith('User is logged in:', 'user123');
  });

  test('handles auth state change for logged-out user', async () => {
    const callback = onAuthStateChanged.mock.calls[0][1];
    callback(null);

    expect(console.log).toHaveBeenCalledWith('User is logged out');
  });
});