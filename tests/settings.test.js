const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { JSDOM } = require('jsdom');

// Mock Firebase auth
const mockSignOut = jest.fn();
jest.mock('../client/js/firebase.js', () => ({
  auth: {
    signOut: mockSignOut,
  },
}));

describe('Settings Page Functionality', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // Set up a mock DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <input type="checkbox" id="email-notify-toggle">
          <button id="back-btn"></button>
          <button id="signout-btn"></button>
        </body>
      </html>
    `);
    window = dom.window;
    document = window.document;

    // Set global document and window explicitly
    global.document = document;
    global.window = window;
    global.window.location = { href: '' };

    // Reset mocks
    mockSignOut.mockReset();

    // Clear any existing module cache to ensure fresh execution
    jest.resetModules();

    // Load the script
    require('../client/js/settings.js');
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.document;
    delete global.window;
  });

  test('should log "Notifications Enabled" when toggle is checked', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const toggle = document.getElementById('email-notify-toggle');

    toggle.checked = true;
    toggle.dispatchEvent(new window.Event('change'));

    expect(consoleLogSpy).toHaveBeenCalledWith('Notifications Enabled');
    consoleLogSpy.mockRestore();
  });

  test('should log "Notifications Disabled" when toggle is unchecked', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const toggle = document.getElementById('email-notify-toggle');

    toggle.checked = false;
    toggle.dispatchEvent(new window.Event('change'));

    expect(consoleLogSpy).toHaveBeenCalledWith('Notifications Disabled');
    consoleLogSpy.mockRestore();
  });

  test('should navigate to profile.html when back button is clicked', () => {
    const backBtn = document.getElementById('back-btn');
    backBtn.dispatchEvent(new window.Event('click'));

    expect(window.location.href).toBe('profile.html');
  });

  test('should call auth.signOut and navigate to index.html on successful sign out', async () => {
    mockSignOut.mockResolvedValueOnce(undefined);
    const signOutBtn = document.getElementById('signout-btn');

    await signOutBtn.dispatchEvent(new window.Event('click'));

    expect(mockSignOut).toHaveBeenCalled();
    expect(window.location.href).toBe('index.html');
  });

  test('should log error when sign out fails', async () => {
    const mockError = new Error('Sign out failed');
    mockSignOut.mockRejectedValueOnce(mockError);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const signOutBtn = document.getElementById('signout-btn');
    await signOutBtn.dispatchEvent(new window.Event('click'));

    expect(mockSignOut).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Sign out error:', mockError);
    expect(window.location.href).not.toBe('index.html');
    consoleErrorSpy.mockRestore();
  });

  test('should not throw error if signout-btn does not exist', () => {
    // Remove signout-btn from DOM
    const signOutBtn = document.getElementById('signout-btn');
    signOutBtn.remove();

    // Re-require the script to re-run with missing button
    jest.resetModules();
    expect(() => require('../client/js/settings.js')).not.toThrow();
  });
});