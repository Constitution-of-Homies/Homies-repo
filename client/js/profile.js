
const editBtn = document.getElementById('edit-profile-btn');
const drawer = document.getElementById('edit-drawer');
const cancelBtn = document.getElementById('cancel-btn');
const backdrop = drawer.querySelector('.drawer-backdrop');

editBtn.addEventListener('click', () => {
drawer.classList.remove('hidden');
setTimeout(() => drawer.classList.add('open'), 10); // small delay for transition
});

function closeDrawer() {
drawer.classList.remove('open');
setTimeout(() => drawer.classList.add('hidden'), 300); // match CSS transition time
}

cancelBtn.addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);

