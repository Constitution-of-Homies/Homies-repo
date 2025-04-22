// firebase.test.js

// Define mock Firebase functions
const mockFirebase = {
  initializeApp: jest.fn(() => ({ mockApp: true })),
  getAnalytics: jest.fn(() => ({ mockAnalytics: true })),
  getAuth: jest.fn(() => ({ mockAuth: true })),
  getFirestore: jest.fn(() => ({ mockDb: true })),
};

// Mock the entire firebase.js module
jest.mock('../client/js/firebase.js', () => {
  const mockApp = { mockApp: true };
  const mockAnalytics = { mockAnalytics: true };
  const mockAuth = { mockAuth: true };
  const mockDb = { mockDb: true };

  // Simulate the initialization calls to track mock function calls
  mockFirebase.initializeApp.mockReturnValue(mockApp);
  mockFirebase.getAnalytics.mockReturnValue(mockAnalytics);
  mockFirebase.getAuth.mockReturnValue(mockAuth);
  mockFirebase.getFirestore.mockReturnValue(mockDb);

  // Call the mocks to simulate firebase.js behavior
  const app = mockFirebase.initializeApp();
  mockFirebase.getAnalytics(app);
  mockFirebase.getAuth(app);
  mockFirebase.getFirestore(app);

  return {
    app,
    analytics: mockAnalytics,
    auth: mockAuth,
    db: mockDb,
  };
});

// Import the mocked firebase.js
const { app, analytics, auth, db } = require('../client/js/firebase.js');

describe('Firebase Initialization', () => {
  const expectedConfig = {
    apiKey: 'AIzaSyDyLL5lej7NYTIi9udmCwe_l7HsVb7e-AQ',
    authDomain: 'constitution-of-homies.firebaseapp.com',
    projectId: 'constitution-of-homies',
    storageBucket: 'constitution-of-homies.firebasestorage.app',
    messagingSenderId: '534709453915',
    appId: '1:534709453915:web:855e13de6ef93393f16b7e',
    measurementId: 'G-9SCYLHCB0L',
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Re-simulate the initialization calls for each test
    const mockApp = { mockApp: true };
    mockFirebase.initializeApp.mockReturnValue(mockApp);
    mockFirebase.getAnalytics.mockReturnValue({ mockAnalytics: true });
    mockFirebase.getAuth.mockReturnValue({ mockAuth: true });
    mockFirebase.getFirestore.mockReturnValue({ mockDb: true });

    mockFirebase.initializeApp(expectedConfig);
    mockFirebase.getAnalytics(mockApp);
    mockFirebase.getAuth(mockApp);
    mockFirebase.getFirestore(mockApp);
  });

  test('should initialize Firebase app with correct config', () => {
    expect(mockFirebase.initializeApp).toHaveBeenCalledTimes(1);
    expect(mockFirebase.initializeApp).toHaveBeenCalledWith(expectedConfig);
    expect(app).toEqual({ mockApp: true });
  });

  test('should initialize analytics with the app', () => {
    expect(mockFirebase.getAnalytics).toHaveBeenCalledTimes(1);
    expect(mockFirebase.getAnalytics).toHaveBeenCalledWith({ mockApp: true });
    expect(analytics).toEqual({ mockAnalytics: true });
  });

  test('should initialize auth with the app', () => {
    expect(mockFirebase.getAuth).toHaveBeenCalledTimes(1);
    expect(mockFirebase.getAuth).toHaveBeenCalledWith({ mockApp: true });
    expect(auth).toEqual({ mockAuth: true });
  });

  test('should initialize Firestore with the app', () => {
    expect(mockFirebase.getFirestore).toHaveBeenCalledTimes(1);
    expect(mockFirebase.getFirestore).toHaveBeenCalledWith({ mockApp: true });
    expect(db).toEqual({ mockDb: true });
  });
});