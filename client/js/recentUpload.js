import { 
    collection, 
    query, 
    where, 
    getDocs,
    doc,
    getDoc,
    updateDoc,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { db } from "./firebase.js";


// Format date
function formatDate(date) {
    if (!date) return 'Unknown date';
    return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getSimplifiedType(fileType) {
    if (!fileType) return 'default';
    const type = fileType.toLowerCase();
    if (type.includes('image')) return 'image';
    if (type.includes('video')) return 'video';
    if (type.includes('audio')) return 'audio';
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'spreadsheet';
    if (type.includes('presentation') || type.includes('powerpoint')) return 'presentation';
    if (type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('7z')) return 'archive';
    if (type.includes('text')) return 'text';
    if (type.includes('javascript') || type.includes('python') || type.includes('java') || type.includes('html') || type.includes('css')) return 'code';
    return type.split('/')[0] || 'default';
}


function getFileIcon(type) {
    const fileIcons = {
        image: '<img src="images/icons/image.png" alt="Image Icon" class="file-icon">',
        video: '<img src="images/icons/video.png" alt="Video Icon" class="file-icon">',
        audio: '<img src="images/icons/audio.png" alt="Audio Icon" class="file-icon">',
        document: '<img src="images/icons/document.png" alt="Document Icon" class="file-icon">',
        spreadsheet: '<img src="images/icons/spreadsheet.png" alt="Spreadsheet Icon" class="file-icon">',
        presentation: '<img src="images/icons/presentation.png" alt="Presentation Icon" class="file-icon">',
        archive: '<img src="images/icons/archive.png" alt="Archive Icon" class="file-icon">',
        code: '<img src="images/icons/code.png" alt="Code Icon" class="file-icon">',
        pdf: '<img src="images/icons/pdf.png" alt="PDF Icon" class="file-icon">',
        text: '<img src="images/icons/text.png" alt="Text Icon" class="file-icon">',
        folder: '<img src="images/icons/folder.png" alt="Folder Icon" class="file-icon">',
        default: '<img src="images/icons/text.png" alt="Default Icon" class="file-icon">'
    };
    return fileIcons[type] || fileIcons.default;
}

// Display recent uploads
async function displayRecentUploads(userId) {
    const recentUploadsContainer = document.getElementById('recentUploadsContainer');
    try {
         const uploadsRef = collection(db, "users", userId, "uploads");
         const q = query(
            uploadsRef, 
            orderBy("uploadedAt", "desc"),
            limit(10)
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            recentUploadsContainer.innerHTML = '<p>No uploads yet</p>';
            return;
        }
        
        let uploadsHTML = '';
        querySnapshot.forEach((doc) => {
            const upload = doc.data();
            uploadsHTML += `
                <section class="upload-item">
                    <section class="upload-info">
                        <img src="${getFileIcon(upload.type)}" alt="${upload.type}" class="file-icon">
                        <p class="file-name">${upload.name || "Untitled"}</p>
                    </section>
                    <section class="upload-stats">
                        ${formatDate(new Date(upload.uploadedAt))}<br>
                        ${upload.views || 0} views · ${upload.downloads || 0} downloads
                    </section>
                </section>
            `;
        });
        
        recentUploadsContainer.innerHTML = uploadsHTML;
    } catch (error) {
        console.error('Error fetching uploads:', error);
        recentUploadsContainer.innerHTML = '<p>Error loading uploads</p>';
    }
}

export { getSimplifiedType, getFileIcon, displayRecentUploads }