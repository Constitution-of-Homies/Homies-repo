// tests/analytics.test.js
import { jest } from '@jest/globals';

// Mock Firebase Firestore
const mockFirestore = {
  doc: jest.fn(() => ({ mockDoc: true, ref: { id: 'mockDoc' } })),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  increment: jest.fn(n => ({ increment: n })),
  serverTimestamp: jest.fn(() => ({ timestamp: true })),
  writeBatch: jest.fn(() => ({
    update: jest.fn(),
    commit: jest.fn(),
  })),
  onSnapshot: jest.fn(),
  collection: jest.fn(() => ({ collection: true })),
};
jest.mock('https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js', () => mockFirestore, { virtual: true });

// Mock firebase.js
const mockFirebase = {
  db: { mockDb: true },
  auth: {
    mockAuth: true,
    currentUser: null,
    onAuthStateChanged: jest.fn(),
  },
};
jest.mock('../client/js/firebase.js', () => mockFirebase);

// Mock window.location
const mockLocation = { href: '' };
delete global.window.location;
global.window.location = mockLocation;

// Mock DOM
beforeAll(() => {
  document.body.innerHTML = `
    <button id="back-btn">Back</button>
    <span id="total-uploads">0</span>
    <span id="total-views">0</span>
    <span id="total-downloads">0</span>
  `;
});

describe('Analytics Module', () => {
  let onAuthStateChanged, setDoc, updateDoc, onSnapshot, writeBatch, increment, serverTimestamp;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Extract mocks
    ({ onAuthStateChanged } = mockFirebase.auth);
    ({ setDoc, updateDoc, onSnapshot, writeBatch, increment, serverTimestamp } = mockFirestore);

    // Reset DOM
    document.getElementById('total-uploads').textContent = '0';
    document.getElementById('total-views').textContent = '0';
    document.getElementById('total-downloads').textContent = '0';
    mockLocation.href = '';

    // Mock Firestore responses
    setDoc.mockResolvedValue();
    updateDoc.mockResolvedValue();
    writeBatch.mockReturnValue({
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
    });
    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        exists: () => true,
        data: () => ({ uploads: 0, views: 0, downloads: 0 }),
      });
      return jest.fn(); // Mock unsubscribe
    });

    // Mock auth
    mockFirebase.auth.currentUser = null;
  });

  test('back button redirects to profile.html', async () => {
    await import('../client/js/analytics.js');
    const backBtn = document.getElementById('back-btn');
    backBtn.click();
    expect(mockLocation.href).toBe('profile.html');
  });

  test('initializes analytics for authenticated user', async () => {
    const user = { uid: 'user123' };
    onAuthStateChanged.mockImplementation(callback => {
      callback(user);
    });

    await import('../client/js/analytics.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();

    expect(setDoc).toHaveBeenCalledWith(
      { mockDoc: true, ref: { id: 'mockDoc' } },
      { uploads: 0, views: 0, downloads: 0 },
      { merge: true }
    );
    expect(onSnapshot).toHaveBeenCalled();
    expect(document.getElementById('total-uploads').textContent).toBe('0');
    expect(document.getElementById('total-views').textContent).toBe('0');
    expect(document.getElementById('total-downloads').textContent).toBe('0');
  });

  test('redirects to login for unauthenticated user', async () => {
    onAuthStateChanged.mockImplementation(callback => {
      callback(null);
    });

    await import('../client/js/analytics.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();

    expect(mockLocation.href).toBe('login.html');
    expect(setDoc).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  test('updates UI with analytics data from snapshot', async () => {
    const user = { uid: 'user123' };
    onAuthStateChanged.mockImplementation(callback => {
      callback(user);
    });

    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        exists: () => true,
        data: () => ({ uploads: 10, views: 20, downloads: 30 }),
      });
      return jest.fn();
    });

    await import('../client/js/analytics.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();

    expect(document.getElementById('total-uploads').textContent).toBe('10');
    expect(document.getElementById('total-views').textContent).toBe('20');
    expect(document.getElementById('total-downloads').textContent).toBe('30');
  });

  test('handles non-numeric analytics data gracefully', async () => {
    const user = { uid: 'user123' };
    onAuthStateChanged.mockImplementation(callback => {
      callback(user);
    });

    onSnapshot.mockImplementation((ref, callback) => {
      callback({
        exists: () => true,
        data: () => ({ uploads: 'invalid', views: null, downloads: undefined }),
      });
      return jest.fn();
    });

    await import('../client/js/analytics.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();

    expect(document.getElementById('total-uploads').textContent).toBe('0');
    expect(document.getElementById('total-views').textContent).toBe('0');
    expect(document.getElementById('total-downloads').textContent).toBe('0');
  });

  test('incrementViews updates document and user stats', async () => {
    const { incrementViews } = await import('../client/js/analytics.js');
    const userId = 'user123';
    const documentId = 'doc123';
    const batch = {
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
    };
    writeBatch.mockReturnValue(batch);

    await incrementViews(userId, documentId);

    expect(writeBatch).toHaveBeenCalled();
    expect(batch.update).toHaveBeenCalledWith(
      { mockDoc: true, ref: { id: 'mockDoc' } },
      {
        views: { increment: 1 },
        lastViewed: { timestamp: true },
      }
    );
    expect(batch.update).toHaveBeenCalledWith(
      { mockDoc: true, ref: { id: 'mockDoc' } },
      {
        views: { increment: 1 },
      }
    );
    expect(batch.commit).toHaveBeenCalled();
  });

  test('incrementDownloads updates document and user stats', async () => {
    const { incrementDownloads } = await import('../client/js/analytics.js');
    const userId = 'user123';
    const documentId = 'doc123';
    const batch = {
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
    };
    writeBatch.mockReturnValue(batch);

    await incrementDownloads(userId, documentId);

    expect(writeBatch).toHaveBeenCalled();
    expect(batch.update).toHaveBeenCalledWith(
      { mockDoc: true, ref: { id: 'mockDoc' } },
      {
        downloads: { increment: 1 },
        lastDownloaded: { timestamp: true },
      }
    );
    expect(batch.update).toHaveBeenCalledWith(
      { mockDoc: true, ref: { id: 'mockDoc' } },
      {
        downloads: { increment: 1 },
      }
    );
    expect(batch.commit).toHaveBeenCalled();
  });

  test('incrementUploads updates user stats', async () => {
    const { incrementUploads } = await import('../client/js/analytics.js');
    const userId = 'user123';

    await incrementUploads(userId);

    expect(updateDoc).toHaveBeenCalledWith(
      { mockDoc: true, ref: { id: 'mockDoc' } },
      {
        uploads: { increment: 1 },
      }
    );
  });

  test('incrementUploads creates new stats document if not found', async () => {
    const { incrementUploads } = await import('../client/js/analytics.js');
    const userId = 'user123';

    updateDoc.mockRejectedValueOnce({ code: 'not-found' });
    setDoc.mockResolvedValue();

    await incrementUploads(userId);

    expect(updateDoc).toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalledWith(
      { mockDoc: true, ref: { id: 'mockDoc' } },
      {
        uploads: 1,
        views: 0,
        downloads: 0,
      },
      { merge: true }
    );
  });

  test('handles errors in analytics initialization', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    onAuthStateChanged.mockImplementation(() => {
      throw new Error('Auth error');
    });

    await import('../client/js/analytics.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize analytics:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  test('handles errors in incrementViews', async () => {
    const { incrementViews } = await import('../client/js/analytics.js');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const batch = {
      update: jest.fn(),
      commit: jest.fn().mockRejectedValue(new Error('Batch error')),
    };
    writeBatch.mockReturnValue(batch);

    await incrementViews('user123', 'doc123');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error incrementing views:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  test('handles errors in incrementDownloads', async () => {
    const { incrementDownloads } = await import('../client/js/analytics.js');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const batch = {
      update: jest.fn(),
      commit: jest.fn().mockRejectedValue(new Error('Batch error')),
    };
    writeBatch.mockReturnValue(batch);

    await incrementDownloads('user123', 'doc123');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error incrementing downloads:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  test('handles errors in incrementUploads', async () => {
    const { incrementUploads } = await import('../client/js/analytics.js');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    updateDoc.mockRejectedValue(new Error('Update error'));

    await incrementUploads('user123');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error incrementing uploads:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
});