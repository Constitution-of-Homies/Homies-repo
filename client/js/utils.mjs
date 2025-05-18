// utils.mjs
export function formatFileSize(bytes) {
    if (typeof bytes !== 'number') return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(1)} GB`;
}
  
export function detectFileType(file) {
    const type = file.type ? file.type.toLowerCase() : '';
    if (type.includes('image')) return 'image';
    if (type.includes('video')) return 'video';
    if (type.includes('audio')) return 'audio';
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'spreadsheet';
    if (type.includes('presentation') || type.includes('powerpoint')) return 'presentation';
    if (type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('7z')) return 'archive';
    if (type.includes('javascript') || type.includes('python') || type.includes('java') || type.includes('html') || type.includes('css')) return 'code';
    if (file.name) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
        if (['doc', 'docx', 'odt'].includes(ext)) return 'document';
        if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
        if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
        if (['pdf'].includes(ext)) return 'pdf';
        if (['txt'].includes(ext)) return 'text';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
        if (['ppt', 'pptx'].includes(ext)) return 'presentation';
        if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return 'archive';
        if (['js', 'py', 'java', 'html', 'css', 'json'].includes(ext)) return 'code';
    }
    return type.split('/')[0] || 'default';
}
  
export function getFileIcon(type) {
    const fileIcons = {
        image: '🖼️',
        video: '🎬',
        audio: '🎵',
        text: '📄',
        document: '📄',
        spreadsheet: '📊',
        presentation: '📑',
        archive: '🗄️',
        code: '💻',
        pdf: '📕',
        folder: '📁',
        default: '📄'
    };
    return fileIcons[type] || fileIcons.unknown;
}