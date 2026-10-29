const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');

fs.mkdirSync(config.uploadDir, { recursive: true });

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};
const ALLOWED = new Set(Object.keys(MIME_EXTENSIONS));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const ext = MIME_EXTENSIONS[file.mimetype];
    if (!ext) return cb(Object.assign(new Error('Unsupported image type.'), { status: 400 }));
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED.has(file.mimetype)) {
    return cb(Object.assign(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'), { status: 400 }));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.imgMaxMB * 1024 * 1024, files: 1 }
});

const SIGNATURES = {
  'image/jpeg': buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': buffer => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
  'image/gif': buffer => buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))
};

function validateImage(req, res, next) {
  if (!req.file) return next();

  const signature = Buffer.alloc(12);
  fs.open(req.file.path, 'r', (openError, fd) => {
    if (openError) return next(openError);
    fs.read(fd, signature, 0, signature.length, 0, readError => {
      fs.close(fd, closeError => {
        const error = readError || closeError;
        if (error) return next(error);
        if (!SIGNATURES[req.file.mimetype]?.(signature)) {
          return fs.unlink(req.file.path, () => {
            req.file = undefined;
            next(Object.assign(new Error('Uploaded file content does not match an allowed image type.'), { status: 400 }));
          });
        }
        next();
      });
    });
  });
}

upload.validateImage = validateImage;
module.exports = upload;