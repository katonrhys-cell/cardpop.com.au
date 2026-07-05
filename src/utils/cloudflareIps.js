import ipaddr from 'ipaddr.js';

// Cloudflare's published edge IP ranges — https://www.cloudflare.com/ips-v4
// and https://www.cloudflare.com/ips-v6. These change rarely (years apart);
// if Cloudflare announces new ranges, refresh this list from those URLs.
// Used by the `trust proxy` function in src/app.js so that when traffic
// arrives via the Cloudflare proxy (client → Cloudflare → Vercel), Express
// walks past the Cloudflare hop in X-Forwarded-For and req.ip resolves to
// the real visitor instead of a Cloudflare edge address. Without this,
// every IP-keyed control (rate limits, login lockout, audit logs) keys on
// a handful of shared Cloudflare IPs — lumping legitimate users together
// and letting attackers dilute limits across edges.
const CLOUDFLARE_CIDRS = [
	// IPv4
	'173.245.48.0/20',
	'103.21.244.0/22',
	'103.22.200.0/22',
	'103.31.4.0/22',
	'141.101.64.0/18',
	'108.162.192.0/18',
	'190.93.240.0/20',
	'188.114.96.0/20',
	'197.234.240.0/22',
	'198.41.128.0/17',
	'162.158.0.0/15',
	'104.16.0.0/13',
	'104.24.0.0/14',
	'172.64.0.0/13',
	'131.0.72.0/22',
	// IPv6
	'2400:cb00::/32',
	'2606:4700::/32',
	'2803:f800::/32',
	'2405:b500::/32',
	'2405:8100::/32',
	'2a06:98c0::/29',
	'2c0f:f248::/32',
];

const PARSED_RANGES = CLOUDFLARE_CIDRS.map((cidr) => ipaddr.parseCIDR(cidr));

/**
 * Whether an IP address belongs to Cloudflare's published edge ranges.
 * Handles IPv4, IPv6, and IPv4-mapped IPv6 (::ffff:1.2.3.4). Returns false
 * for anything unparseable — never throws, so it's safe inside the
 * trust-proxy hot path.
 *
 * @param {string} ip
 * @returns {boolean}
 */
export function isCloudflareIp(ip) {
	if (!ip || typeof ip !== 'string') return false;
	let addr;
	try {
		addr = ipaddr.parse(ip.trim());
	} catch {
		return false;
	}
	if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
		addr = addr.toIPv4Address();
	}
	return PARSED_RANGES.some(
		([range, bits]) => addr.kind() === range.kind() && addr.match(range, bits)
	);
}

export default isCloudflareIp;
