/**
 * Extract and normalize client IP address from request
 * Handles both IPv4 and IPv6 addresses, including IPv4-mapped IPv6 addresses
 * 
 * @param {Object} req - Express request object
 * @returns {string} Normalized IP address suitable for rate limiting keys
 */
function ipKeyGenerator(req) {
  // Try to get IP from x-forwarded-for header first (for proxied requests)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ip = forwardedFor.split(',')[0].trim();
    return normalizeIp(ip);
  }

  // Fall back to req.ip (Express sets this from various sources)
  if (req.ip) {
    return normalizeIp(req.ip);
  }

  // Fall back to connection remote address
  if (req.connection && req.connection.remoteAddress) {
    return normalizeIp(req.connection.remoteAddress);
  }

  // Fall back to socket remote address
  if (req.socket && req.socket.remoteAddress) {
    return normalizeIp(req.socket.remoteAddress);
  }

  // Last resort: return a default identifier
  return 'unknown';
}

/**
 * Normalize IP address by removing IPv4-mapped IPv6 prefix
 * IPv4-mapped IPv6 addresses look like: ::ffff:192.168.1.1
 * We want to extract the IPv4 address for consistency
 * 
 * @param {string} ip - IP address to normalize
 * @returns {string} Normalized IP address
 */
function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') {
    return 'unknown';
  }

  const trimmedIp = ip.trim();

  // Handle IPv4-mapped IPv6 addresses (::ffff:192.168.1.1)
  if (trimmedIp.toLowerCase().startsWith('::ffff:')) {
    const ipv4 = trimmedIp.substring(7); // Remove '::ffff:' prefix
    return ipv4;
  }

  // Handle IPv6 addresses with zone ID (fe80::1%eth0)
  if (trimmedIp.includes('%')) {
    return trimmedIp.split('%')[0];
  }

  return trimmedIp;
}

export default ipKeyGenerator;