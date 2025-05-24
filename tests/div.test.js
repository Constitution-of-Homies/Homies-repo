const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

describe('HTML structure validation', () => {
  let htmlFiles = [];

  // Find all HTML files in the project
  beforeAll(async () => {
    htmlFiles = await glob('client/**/*.html', {
      ignore: ['node_modules/**', 'dist/**', '**/vendor/**']
    });
  });

  test('should not contain any div or span elements', () => {
    htmlFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for div elements
      const divMatches = content.match(/<div[^>]*>/g);
      if (divMatches) {
        console.warn(`Found ${divMatches.length} <div> elements in ${file}`);
      }
      
      // Check for span elements
      const spanMatches = content.match(/<span[^>]*>/g);
      if (spanMatches) {
        console.warn(`Found ${spanMatches.length} <span> elements in ${file}`);
      }

      // Assert that no divs or spans were found
      expect(divMatches).toBeNull();
      expect(spanMatches).toBeNull();
    });
  });
});