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

async function displayRecentUploads(userId) {
    try {
        const recentUploadsContainer = document.getElementById('recentUploadsContainer');
        if (!recentUploadsContainer) {
            console.error('Recent uploads container not found');
            return;
        }

        // Get all user uploads (without ordering)
        const q = query(
            collection(db, "archiveItems"),
            where("uploadedBy", "==", userId)
        );

        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            recentUploadsContainer.innerHTML = '<p class="empty-message">No recent uploads found</p>';
            return;
        }

        // Convert to array and sort by date in memory
        const uploads = [];
        querySnapshot.forEach((doc) => {
            uploads.push({
                id: doc.id,
                ...doc.data(),
                uploadedAt: doc.data().uploadedAt?.toDate() || new Date(0)
            });
        });

        // Sort by date (newest first)
        uploads.sort((a, b) => b.uploadedAt - a.uploadedAt);
        
        // Take top 6
        const recentUploads = uploads.slice(0, 3);

        let html = '<div class="recent-uploads-grid">';
        
        recentUploads.forEach((file) => {
            const fileType = getSimplifiedType(file.type);
            const fileIcon = getFileIcon(fileType);
            const fileName = file.metadata?.title || file.name || 'Untitled';
            const uploadDate = formatDate(file.uploadedAt);
            const views = file.views || 0;
            const downloads = file.downloads || 0;
            
            html += `
                <div class="recent-upload-item">
                    ${fileIcon}
                    <div class="recent-upload-content">
                        <h3 class="recent-upload-title">${fileName}</h3>
                        ${file.description ? `<p class="recent-upload-description">${file.description}</p>` : ''}
                        <div class="recent-upload-meta">
                            <div class="meta-item">
                                <img src="images/icons/view.png" alt="Views" class="meta-icon">
                                <span class="meta-value">${views}</span>
                            </div>
                            <div class="meta-item">
                                <img src="images/icons/download.png" alt="Downloads" class="meta-icon">
                                <span class="meta-value">${downloads}</span>
                            </div>
                            <div class="meta-item upload-date">
                                <img src="images/icons/calendar.png" alt="Date" class="meta-icon">
                                <span class="meta-value">${uploadDate}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        recentUploadsContainer.innerHTML = html;
    } catch (error) {
        console.error("Error loading recent uploads:", error);
        const recentUploadsContainer = document.getElementById('recentUploadsContainer');
        if (recentUploadsContainer) {
            recentUploadsContainer.innerHTML = '<p class="error-message">Error loading recent uploads</p>';
        }
    }
}

export { getSimplifiedType, getFileIcon, displayRecentUploads };