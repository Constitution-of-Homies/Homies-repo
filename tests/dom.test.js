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

    test('has a title', () => {
        expect(document.title).toBe('Constitutional Archive Search Interface');
    });

    test('has a main heading', () => {
        const h1 = document.querySelector('h1');
        expect(h1).not.toBeNull();
    });

    test('has a navigation bar', () => {
        const nav = document.querySelector('nav');
        expect(nav).not.toBeNull();
    });
});