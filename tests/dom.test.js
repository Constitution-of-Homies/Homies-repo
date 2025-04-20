describe('HTML Structure', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
          </ul>
        </nav>
      `;
    });
  
    test('has a navigation bar', () => {
      const nav = document.querySelector('nav');
      expect(nav).not.toBeNull();
    });
});