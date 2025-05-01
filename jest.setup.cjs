// CommonJS format
require('@testing-library/jest-dom');

// Mock window.location
delete window.location;
window.location = {
  href: '',
  assign: jest.fn(),
  replace: jest.fn()
};

// Mock alert
beforeEach(() => {
  window.alert = jest.fn();
});