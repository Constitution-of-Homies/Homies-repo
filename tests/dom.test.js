const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('HTML Structure', () => {
    let dom;
    let document;

    beforeAll(() => {
        const html = fs.readFileSync(path.resolve(__dirname, '../client/index.html'), 'utf8');
        dom = new JSDOM(html);
        document = dom.window.document;
    });

    test('has a navigation bar', () => {
        const nav = document.querySelector('nav');
        expect(nav).not.toBeNull();
    });
});