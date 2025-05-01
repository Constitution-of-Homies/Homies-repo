document.querySelector('.profile-item').addEventListener('mouseenter', function() {
    this.setAttribute('aria-expanded', 'true');
});
document.querySelector('.profile-item').addEventListener('mouseleave', function() {
    this.setAttribute('aria-expanded', 'false');
});

document.addEventListener('DOMContentLoaded', function() {
    const filterButton = document.querySelector('.filter-button');
    const filterSection = document.querySelector('.filter-section');
    
    filterButton.addEventListener('click', function() {
        filterSection.classList.toggle('active');
        
        // Toggle the search container border radius when filters are visible
        const searchContainer = document.querySelector('.search-container');
        if (filterSection.classList.contains('active')) {
            searchContainer.style.borderRadius = '4px 4px 0 0';
        } else {
            searchContainer.style.borderRadius = '4px';
        }
    });
});