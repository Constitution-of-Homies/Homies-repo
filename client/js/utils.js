function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
  
function detectFileType(file) {
const type = file.type.split('/')[0];
const extension = file.name.split('.').pop().toLowerCase();

if (type === 'image') return 'image';
if (type === 'video') return 'video';
if (type === 'audio') return 'audio';

const documentTypes = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
if (documentTypes.includes(extension)) return 'document';

const spreadsheetTypes = ['xls', 'xlsx', 'csv'];
if (spreadsheetTypes.includes(extension)) return 'spreadsheet';

const presentationTypes = ['ppt', 'pptx'];
if (presentationTypes.includes(extension)) return 'presentation';

const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz'];
if (archiveTypes.includes(extension)) return 'archive';

const codeTypes = ['js', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php', 'json', 'xml'];
if (codeTypes.includes(extension)) return 'code';

return 'unknown';
}
  
function getFileIcon(type) {
const icons = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    document: '📄',
    spreadsheet: '📊',
    presentation: '📑',
    archive: '🗄️',
    code: '💻',
    unknown: '📁'
};
return icons[type] || icons.unknown;
}
  
module.exports = { formatFileSize, detectFileType, getFileIcon };
  