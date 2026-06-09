import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';

// Magic-byte MIME types we actually accept for card images
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const uploadFiles = ({
	maxCount = 5,
	maxSizeMB = 10,
	allowedMimeTypes,
	fieldName,
}) => {
	const allowed = new Set(allowedMimeTypes ?? [...IMAGE_MIME_TYPES]);

	const upload = multer({
		storage: multer.memoryStorage(),
		limits: {
			fileSize: maxSizeMB * 1024 * 1024,
		},
		// First gate: reject obviously wrong Content-Type before reading the full body.
		// Magic-byte validation below is the real check.
		fileFilter: (req, file, cb) => {
			if (allowed.has(file.mimetype)) {
				cb(null, true);
			} else {
				cb(new Error(`Invalid file type. Allowed: ${[...allowed].join(', ')}.`));
			}
		},
	});

	const multerMiddleware = upload.array(fieldName, maxCount);

	// Second gate: validate actual file content via magic bytes after multer reads the buffer.
	return (req, res, next) => {
		multerMiddleware(req, res, async (err) => {
			if (err) return next(err);
			if (!req.files?.length) return next();

			try {
				for (const file of req.files) {
					const detected = await fileTypeFromBuffer(file.buffer);
					if (!detected || !allowed.has(detected.mime)) {
						return res.status(400).json({
							error: `File "${file.originalname}" is not a valid image (detected: ${detected?.mime ?? 'unknown'}).`,
						});
					}
					// Overwrite with the real MIME type so downstream code can trust it
					file.mimetype = detected.mime;
					file.detectedExt = detected.ext;
				}
				next();
			} catch (validationErr) {
				next(validationErr);
			}
		});
	};
};
