import { TextEncoder, TextDecoder } from 'util';
import {
  capitalizeString,
  generateRandomNumber,
  isValidEmail,
  truncateText,
  debounce,
  deepClone,
  formatDate,
  arrayUnique,
  fetchWithTimeout,
  memoize
} from '../client/js/util.js';

// Polyfill TextEncoder and TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock fetch
global.fetch = jest.fn();

describe('Utility Functions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('capitalizeString', () => {
    test('should capitalize first letter and lowercase rest', () => {
      expect(capitalizeString('hello')).toBe('Hello');
      expect(capitalizeString('HELLO')).toBe('Hello');
    });

    test('should return empty string for empty or non-string input', () => {
      expect(capitalizeString('')).toBe('');
      expect(capitalizeString(null)).toBe('');
      expect(capitalizeString(123)).toBe('');
    });
  });

  describe('generateRandomNumber', () => {
    test('should generate number within range', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      expect(generateRandomNumber(1, 5)).toBe(3);
      Math.random.mockRestore();
    });

    test('should throw error for invalid inputs', () => {
      expect(() => generateRandomNumber(5, 1)).toThrow('Invalid min or max values');
      expect(() => generateRandomNumber(1.5, 5)).toThrow('Invalid min or max values');
      expect(() => generateRandomNumber(1, '5')).toThrow('Invalid min or max values');
    });
  });

  describe('isValidEmail', () => {
    test('should validate email correctly', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid.email@')).toBe(false);
      expect(isValidEmail('no.at.symbol')).toBe(false);
    });

    test('should return false for non-string input', () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(123)).toBe(false);
    });
  });

  describe('truncateText', () => {
    test('should truncate text longer than maxLength', () => {
      expect(truncateText('Hello World', 8)).toBe('Hello...');
      expect(truncateText('Hello', 3)).toBe('...');
    });

    test('should return text if shorter than or equal to maxLength', () => {
      expect(truncateText('Hello', 5)).toBe('Hello');
      expect(truncateText('Hi', 10)).toBe('Hi');
    });

    test('should return input for negative maxLength or non-string', () => {
      expect(truncateText('Hello', -1)).toBe('Hello');
      expect(truncateText(null, 5)).toBe(null);
      expect(truncateText(123, 5)).toBe(123);
    });
  });

  describe('debounce', () => {
    test('should execute function after delay', () => {
      const mockFn = jest.fn();
      const debounced = debounce(mockFn, 100);

      debounced('test');
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledWith('test');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should only execute last call within delay', () => {
      const mockFn = jest.fn();
      const debounced = debounce(mockFn, 100);

      debounced('first');
      debounced('second');
      debounced('third');

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledWith('third');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should return original function for invalid inputs', () => {
      const mockFn = jest.fn();
      expect(debounce(mockFn, -1)).toBe(mockFn);
      expect(debounce('not a function', 100)).toBe('not a function');
    });
  });

  describe('deepClone', () => {
    test('should clone objects and arrays', () => {
      const obj = { a: 1, b: { c: 2 }, d: [1, 2] };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
      expect(cloned.d).not.toBe(obj.d);
    });

    test('should return primitives unchanged', () => {
      expect(deepClone(null)).toBe(null);
      expect(deepClone(123)).toBe(123);
      expect(deepClone('text')).toBe('text');
    });
  });

  describe('formatDate', () => {
    test('should format date correctly', () => {
      const date = new Date('2025-05-19');
      expect(formatDate(date, 'YYYY-MM-DD')).toBe('2025-05-19');
      expect(formatDate(date, 'DD/MM/YYYY')).toBe('19/05/2025');
    });

    test('should throw for invalid date or format', () => {
      expect(() => formatDate(new Date('invalid'), 'YYYY-MM-DD')).toThrow('Invalid date');
      expect(() => formatDate(new Date(), 'INVALID')).toThrow('Unsupported format');
    });
  });

  describe('arrayUnique', () => {
    test('should remove duplicates from array', () => {
      expect(arrayUnique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
      expect(arrayUnique(['a', 'b', 'a'])).toEqual(['a', 'b']);
      expect(arrayUnique([])).toEqual([]);
    });

    test('should return non-array input unchanged', () => {
      expect(arrayUnique('text')).toBe('text');
      expect(arrayUnique(null)).toBe(null);
    });
  });

  describe('fetchWithTimeout', () => {
    test('should fetch data successfully', async () => {
      const mockData = { success: true };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockData),
      });

      const result = await fetchWithTimeout('https://example.com', 1000);
      expect(fetch).toHaveBeenCalledWith('https://example.com', { signal: expect.any(AbortSignal) });
      expect(result).toEqual(mockData);
    });

    test('should throw on timeout', async () => {
      fetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
      await expect(fetchWithTimeout('https://example.com', 100)).rejects.toThrow('AbortError');
      jest.advanceTimersByTime(100);
    });

    test('should throw on HTTP error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      await expect(fetchWithTimeout('https://example.com', 1000)).rejects.toThrow('HTTP error! status: 404');
    });

    test('should throw for invalid URL', async () => {
      await expect(fetchWithTimeout('', 1000)).rejects.toThrow('Invalid URL');
      await expect(fetchWithTimeout('   ', 1000)).rejects.toThrow('Invalid URL');
    });
  });

  describe('memoize', () => {
    test('should cache function results', () => {
      const mockFn = jest.fn(x => x * 2);
      const memoized = memoize(mockFn);

      expect(memoized(5)).toBe(10);
      expect(memoized(5)).toBe(10);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(memoized(10)).toBe(20);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should return original input for non-function', () => {
      expect(memoize('not a function')).toBe('not a function');
    });
  });
});