// For @testing-library/jest-dom
require('@testing-library/jest-dom');

// Mock window.location
delete window.location;
window.location = {
  href: jest.fn(),
  assign: jest.fn(),
  replace: jest.fn()
};

// Mock alert
window.alert = jest.fn();