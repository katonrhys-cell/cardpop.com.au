export const checkConnection = () => {
  return navigator.onLine;
};

export const getConnectionQuality = () => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return 'unknown';
  return connection.effectiveType; // 'slow-2g', '2g', '3g', or '4g'
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const retryRequest = async (requestFn, maxRetries = 3, baseDelay = 1000) => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await requestFn();
    } catch (error) {
      retries++;
      if (retries >= maxRetries) throw error;
      const waitTime = baseDelay * Math.pow(2, retries - 1); // 1s, 2s, 4s
      console.warn(`Request failed, retrying in ${waitTime}ms... (${retries}/${maxRetries})`);
      await delay(waitTime);
    }
  }
};

const requestQueue = [];
let isProcessingQueue = false;

export const queueRequest = (requestFn) => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ requestFn, resolve, reject });
    processQueue();
  });
};

const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  if (!checkConnection()) {
    // Wait for online event
    window.addEventListener('online', processQueue, { once: true });
    return;
  }

  isProcessingQueue = true;
  while (requestQueue.length > 0) {
    const { requestFn, resolve, reject } = requestQueue.shift();
    try {
      const result = await retryRequest(requestFn);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }
  isProcessingQueue = false;
};