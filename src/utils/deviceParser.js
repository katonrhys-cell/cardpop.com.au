import { UAParser } from 'ua-parser-js';

function parseUserAgent(userAgentString) {
  const parser = new UAParser(userAgentString);
  const result = parser.getResult();

  return {
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown',
    device: result.device.type || 'desktop',
  };
}

function getDeviceName(userAgentString) {
  const parsed = parseUserAgent(userAgentString);
  return `${parsed.browser} on ${parsed.os}`;
}

export { parseUserAgent, getDeviceName };