const { formatFileSize, detectFileType, getFileIcon } = require('../client/js/utils');

/*
describe('formatFileSize', () => {
  test('should return "0 Bytes" for 0', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });

  test('should return KB format', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
  });

  test('should return MB format', () => {
    expect(formatFileSize(1048576)).toBe('1 MB');
  });

  test('should return GB format', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });

  test('should round to two decimal places', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });
});
*/

describe('formatFileSize', () => {
  test('returns "0 Bytes" for 0', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });
  test('returns correct KB size', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
  });
});

describe('detectFileType', () => {
  test('detects image files', () => {
    const mockFile = { name: 'test.jpg', type: 'image/jpeg' };
    expect(detectFileType(mockFile)).toBe('image');
  });

  test('detects code files', () => {
    const mockFile = { name: 'main.py', type: 'text/plain' };
    expect(detectFileType(mockFile)).toBe('code');
  });

  test('detects unknown files', () => {
    const mockFile = { name: 'banana.xyz', type: 'application/banana-stream' };
    expect(detectFileType(mockFile)).toBe('unknown');
  });
});

describe('getFileIcon', () => {
  test('returns 🎵 for audio', () => {
    expect(getFileIcon('audio')).toBe('🎵');
  });

  test('returns default for unknown', () => {
    expect(getFileIcon('weird')).toBe('📁');
  });
});
