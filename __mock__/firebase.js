export const auth = {
    currentUser: null
  };
  
  export const getAuth = jest.fn(() => auth);
  export const signInWithEmailAndPassword = jest.fn();
  export const setPersistence = jest.fn();
  export const browserLocalPersistence = {};
  
  export const db = {
    collection: jest.fn()
  };
  
  export function initializeApp() {
    return {};
  }
  
  export function getFirestore() {
    return db;
  }

  