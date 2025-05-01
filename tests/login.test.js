import {
    jest,
    describe,
    beforeEach,
    test,
    expect
  } from '@jest/globals';
  import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signInWithPopup,
    doc,
    getDoc,
    setDoc,
    auth,
    db,
    GoogleAuthProvider
  } from '../client/js/firebase.js';
  
  // Helper function to wait for async operations
  const waitFor = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Mock window.location
  const mockWindowLocation = {
    href: '',
    assign: jest.fn(),
    replace: jest.fn()
  };
  
  beforeEach(async () => {
    // Reset DOM first
    document.body.innerHTML = `
      <input id="email" />
      <input id="password" />
      <button id="login-btn"></button>
      <a id="forgot-password"></a>
      <button id="google-login-btn"></button>
    `;
  
    // Reset all mocks
    jest.clearAllMocks();
    auth.currentUser = null;
    
    // Mock window.location
    delete window.location;
    window.location = { ...mockWindowLocation };
    
    // Mock window.alert
    window.alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
  
    // Dynamically import login module AFTER DOM setup
    await import('../client/js/login.js');
  });
  
  describe('Login Functionality', () => {
    describe('Email/Password Login', () => {
      test('displays error for invalid credentials', async () => {
        // Mock Firebase error response
        signInWithEmailAndPassword.mockRejectedValue({ 
          code: 'auth/wrong-password',
          message: 'Invalid password'
        });
  
        // Set form values
        document.getElementById('email').value = 'test@example.com';
        document.getElementById('password').value = 'wrongpass';
  
        // Trigger login attempt
        document.getElementById('login-btn').click();
        
        // Wait for async operations
        await waitFor(50);
  
        // Verify error handling
        expect(window.alert).toHaveBeenCalledWith(
          'Login failed. Incorrect password.'
        );
      });
  
      test('successful login redirects to admin page', async () => {
        const mockUser = { uid: '123', email: 'test@example.com' };
        signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
        getDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
  
        document.getElementById('email').value = 'test@example.com';
        document.getElementById('password').value = 'password';
  
        document.getElementById('login-btn').click();
        await waitFor(50);
  
        expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
          auth,
          'test@example.com',
          'password'
        );
        expect(window.location.href).toBe('./admin-page.html');
      });
    });
  
    describe('Password Reset', () => {
      test('successful password reset email', async () => {
        sendPasswordResetEmail.mockResolvedValue();
        document.getElementById('email').value = 'valid@example.com';
  
        document.getElementById('forgot-password').click();
        await waitFor(50);
  
        expect(sendPasswordResetEmail).toHaveBeenCalledWith(
          auth,
          'valid@example.com'
        );
        expect(window.alert).toHaveBeenCalledWith(
          'Password reset email sent! Please check your inbox.'
        );
      });
    });
  
    describe('Google Login', () => {
      test('successful Google login creates user document', async () => {
        const mockUser = {
          uid: 'google-123',
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: 'http://example.com/photo.jpg'
        };
    // Mock provider and sign-in flow
    const mockProvider = new GoogleAuthProvider();
    signInWithPopup.mockResolvedValue({ 
      user: mockUser,
      providerId: 'google.com' 
    });

    // Trigger the button click
    document.getElementById('google-login-btn').click();
    
    // Wait for full async flow (auth + Firestore)
    await waitFor(150);

    // Verify auth call
    expect(signInWithPopup).toHaveBeenCalledWith(
      auth,
      expect.any(GoogleAuthProvider)
    );

    // Verify Firestore operations
    expect(doc).toHaveBeenCalledWith(db, 'users', 'google-123');
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: 'test@example.com',
        username: 'Test User',
        provider: 'google'
      }),
      { merge: true }
    );
        expect(window.location.href).toBe('admin-page.html');
      });
    });
  });