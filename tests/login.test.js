// Mock Firebase Auth (ESM-compatible)
jest.mock('firebase/auth', () => ({
    getAuth: jest.fn(() => ({
      currentUser: null,
      signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: { uid: '123' } })),
      sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
      setPersistence: jest.fn(() => Promise.resolve()),
    })),
    browserLocalPersistence: {},
  }));
  
  // Mock the entire Firebase module
  jest.mock('../client/js/firebase.js', () => ({
    auth: { currentUser: null },
    db: {},
  }));
  
  describe('Login Page', () => {
    beforeAll(async () => {
      // Load login.js (now transformed by Babel)
      require('../client/js/login.js');
      window.alert = jest.fn();
    });
  
    beforeEach(() => {
      document.body.innerHTML = `
        <form>
          <input id="email" value="test@example.com" />
          <input id="password" value="password123" />
          <button id="login-btn"></button>
          <button id="forgot-password"></button>
        </form>
      `;
    });
  
    test('successful login', async () => {
      const { signInWithEmailAndPassword } = require('firebase/auth');
      document.getElementById('login-btn').click();
      await Promise.resolve(); // Allow async operations to complete
      
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.any(Object),
        'test@example.com',
        'password123'
      );
    });
  });