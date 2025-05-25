export function capitalizeString(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function generateRandomNumber(min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error('Invalid min or max values');
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function truncateText(text, maxLength) {
  if (typeof text !== 'string' || maxLength < 0) {
    return text;
  }
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

export function debounce(fn, delay) {
  if (typeof fn !== 'function' || delay < 0) {
    return fn;
  }
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

export function formatDate(date, format) {
  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error('Invalid date');
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (format === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }
  if (format === 'DD/MM/YYYY') {
    return `${day}/${month}/${year}`;
  }
  throw new Error('Unsupported format');
}

export function arrayUnique(arr) {
  if (!Array.isArray(arr)) {
    return arr;
  }
  return [...new Set(arr)];
}

export async function fetchWithTimeout(url, timeout = 5000) {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('Invalid URL');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export function memoize(fn) {
  if (typeof fn !== 'function') {
    return fn;
  }
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}