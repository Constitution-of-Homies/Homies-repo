document.querySelector('.profile-item').addEventListener('mouseenter', function() {
    this.setAttribute('aria-expanded', 'true');
});
document.querySelector('.profile-item').addEventListener('mouseleave', function() {
    this.setAttribute('aria-expanded', 'false');
});