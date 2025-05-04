// dom elements

const backBtn = document.getElementById("back-btn");

backBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href="profile.html";
})