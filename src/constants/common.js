const NodeEnv = {
	Development: 'development',
	Production: 'production',
};

// Default JSON/urlencoded body limit. Kept small: no JSON API here needs more
// than a few KB (image uploads go through multipart/multer, which has its own
// fileSize limit and bypasses these parsers). A large global limit just gives an
// attacker cheap memory/CPU amplification on every JSON endpoint.
const BodyLimit = 1024 * 256; // 256 KB

// Larger limit scoped to the admin event-scraper "paste content to parse" flow,
// where a full event page's text can legitimately exceed the default.
const LargeBodyLimit = 1024 * 1024 * 20; // 20 MB

export { NodeEnv, BodyLimit, LargeBodyLimit };