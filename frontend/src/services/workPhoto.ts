const maxPhotoBytes = 1.5 * 1024 * 1024;

export async function prepareWorkPhoto(file: File): Promise<string> {
    if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) {
        throw new Error('Choose a photo smaller than 25 MB.');
    }
    const url = URL.createObjectURL(file);
    try {
        const photo = new Image();
        await new Promise<void>((resolve, reject) => {
            photo.onload = () => resolve();
            photo.onerror = () => reject(new Error('This photo format cannot be opened. Choose JPG or PNG, or take a new photo.'));
            photo.src = url;
        });
        const scale = Math.min(1, 1600 / Math.max(photo.naturalWidth, photo.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Unable to prepare this photo. Please try again.');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(photo, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.85, 0.7, 0.55, 0.4]) {
            const data = canvas.toDataURL('image/jpeg', quality);
            if (data.startsWith('data:image/jpeg;base64,') && (data.split(',')[1].length * 3 / 4) <= maxPhotoBytes) return data;
        }
        throw new Error('This photo is too large to upload. Please choose a smaller photo.');
    } finally { URL.revokeObjectURL(url); }
}
