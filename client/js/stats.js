import { db } from "./firebase.js";
import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Increment views or downloads for a file by its archiveItem ID
export async function incrementFileStat(fileId, field) {
    if (!fileId || !['views', 'downloads'].includes(field)) return;
    try {
        const fileRef = doc(db, "archiveItems", fileId);
        await updateDoc(fileRef, {
            [field]: increment(1)
        });
    } catch (error) {
        console.error(`Failed to increment ${field} for file ${fileId}:`, error);
    }
}