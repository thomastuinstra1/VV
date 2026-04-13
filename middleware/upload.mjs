import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const fileFilter = (req, file, cb) => {
  const toegestaan = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  toegestaan.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Alleen afbeeldingen zijn toegestaan'), false);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
});