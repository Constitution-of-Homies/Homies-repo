import { db, auth } from "./firebase.js";
import { 
    collection,
    query,
    where,
    onSnapshot,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// DOM elements
const backBtn = document.getElementById("back-btn");
const totalUploads = document.getElementById("total-uploads");
const totalViews = document.getElementById("total-views");
const totalDownloads = document.getElementById("total-downloads");
const viewsMetric = document.getElementById("views-metric");
const downloadsMetric = document.getElementById("downloads-metric");
const detailsModal = document.getElementById("details-modal");
const modalTitle = document.getElementById("modal-title");
const documentList = document.getElementById("document-list");
const closeBtn = document.querySelector(".close-btn");

// Chart instances
let uploadsChart, viewsChart, downloadsChart;

// Initialize charts
function initializeCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    };

    // Uploads Chart (Bar chart)
    const uploadsCtx = document.getElementById('uploadsChart').getContext('2d');
    uploadsChart = new Chart(uploadsCtx, {
        type: 'bar',
        data: {
            labels: ['Last 7 Days', 'Last 30 Days', 'All Time'],
            datasets: [{
                label: 'Uploads',
                data: [0, 0, 0],
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: chartOptions
    });

    // Views Chart (Line chart)
    const viewsCtx = document.getElementById('viewsChart').getContext('2d');
    viewsChart = new Chart(viewsCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Views',
                data: [0, 0, 0, 0, 0, 0],
                fill: false,
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderColor: 'rgba(75, 192, 192, 1)',
                tension: 0.1,
                borderWidth: 2
            }]
        },
        options: chartOptions
    });

    // Downloads Chart (Doughnut chart)
    const downloadsCtx = document.getElementById('downloadsChart').getContext('2d');
    downloadsChart = new Chart(downloadsCtx, {
        type: 'doughnut',
        data: {
            labels: ['Documents', 'Images', 'Videos', 'Others'],
            datasets: [{
                label: 'Downloads by Type',
                data: [0, 0, 0, 0],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                    'rgba(255, 159, 64, 0.7)',
                    'rgba(201, 203, 207, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(201, 203, 207, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            ...chartOptions,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });
}

// Store user's documents data
let userDocuments = [];

// Back functionality
backBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "profile.html";
});

// Modal functionality
closeBtn.addEventListener("click", () => {
    detailsModal.style.display = "none";
});

detailsModal.addEventListener("click", (e) => {
    if (e.target === detailsModal) {
        detailsModal.style.display = "none";
    }
});

// Function to show document details
function showDocumentDetails(type) {
    modalTitle.textContent = `Documents by ${type}`;
    documentList.innerHTML = "";

    const sortedDocuments = [...userDocuments]
        .filter(doc => doc[type] > 0)
        .sort((a, b) => b[type] - a[type]);

    if (sortedDocuments.length === 0) {
        documentList.innerHTML = `<p>No documents with ${type} found.</p>`;
        detailsModal.style.display = "flex";
        return;
    }

    sortedDocuments.forEach(doc => {
        const docElement = document.createElement("div");
        docElement.className = "document-item";
        docElement.innerHTML = `
            <span class="document-name">${doc.name}</span>
            <span class="document-count">${doc[type]} ${type}</span>
        `;
        documentList.appendChild(docElement);
    });

    detailsModal.style.display = "flex";
}

// Function to update charts with sample data (replace with real data)
function updateCharts() {
    // Sample data - replace with your actual data calculations
    const now = new Date();
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
    
    // Calculate uploads in different time periods
    const uploadsLast7Days = userDocuments.filter(doc => 
        new Date(doc.uploadedAt) > sevenDaysAgo).length;
    const uploadsLast30Days = userDocuments.filter(doc => 
        new Date(doc.uploadedAt) > thirtyDaysAgo).length;
    
    // Update uploads chart
    uploadsChart.data.datasets[0].data = [
        uploadsLast7Days,
        uploadsLast30Days,
        userDocuments.length
    ];
    uploadsChart.update();
    
    // Update views chart (sample monthly data)
    viewsChart.data.datasets[0].data = [
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 120),
        Math.floor(Math.random() * 150),
        Math.floor(Math.random() * 180),
        Math.floor(Math.random() * 200),
        totalViews.textContent
    ];
    viewsChart.update();
    
    // Update downloads by type (sample data)
    const docTypes = {
        documents: 0,
        images: 0,
        videos: 0,
        others: 0
    };
    
    userDocuments.forEach(doc => {
        if (doc.type.includes('pdf') || doc.type.includes('document')) {
            docTypes.documents += doc.downloads || 0;
        } else if (doc.type.includes('image')) {
            docTypes.images += doc.downloads || 0;
        } else if (doc.type.includes('video')) {
            docTypes.videos += doc.downloads || 0;
        } else {
            docTypes.others += doc.downloads || 0;
        }
    });
    
    downloadsChart.data.datasets[0].data = [
        docTypes.documents,
        docTypes.images,
        docTypes.videos,
        docTypes.others
    ];
    downloadsChart.update();
}

// Function to fetch and display analytics
async function setupAnalytics(userId) {
    // Initialize charts
    initializeCharts();
    
    // Reference to the user's archive items
    const archiveItemsRef = collection(db, "archiveItems");
    const userItemsQuery = query(archiveItemsRef, where("uploadedBy", "==", userId));

    // Set up real-time listener
    onSnapshot(userItemsQuery, (snapshot) => {
        userDocuments = [];
        let uploadCount = 0;
        let totalViewsCount = 0;
        let totalDownloadsCount = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            userDocuments.push({
                id: doc.id,
                name: data.name,
                type: data.type,
                views: data.views || 0,
                downloads: data.downloads || 0,
                url: data.url,
                uploadedAt: data.uploadedAt?.toDate()?.toISOString() || new Date().toISOString()
            });

            uploadCount++;
            totalViewsCount += data.views || 0;
            totalDownloadsCount += data.downloads || 0;
        });

        totalUploads.textContent = uploadCount;
        totalViews.textContent = totalViewsCount;
        totalDownloads.textContent = totalDownloadsCount;
        
        // Update charts with the new data
        updateCharts();
    }, (error) => {
        console.error("Error listening to analytics updates:", error);
        totalUploads.textContent = "0";
        totalViews.textContent = "0";
        totalDownloads.textContent = "0";
    });

    // Add click handlers for metrics
    viewsMetric.addEventListener("click", () => showDocumentDetails("views"));
    downloadsMetric.addEventListener("click", () => showDocumentDetails("downloads"));
}

function getCurrentUserId() {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged((user) => {
            if (user) {
                resolve(user.uid);
            } else {
                reject("No user logged in");
                window.location.href = "login.html";
            }
        });
    });
}

// Initialize the analytics when the page loads
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const userId = await getCurrentUserId();
        setupAnalytics(userId);
    } catch (error) {
        console.error("Failed to initialize analytics:", error);
    }
});