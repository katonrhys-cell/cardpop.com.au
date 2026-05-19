const SESSION_KEY = 'cardpop_session_state';

export const saveSession = (data) => {
  try {
    const existing = restoreSession() || {};
    const updated = { ...existing, ...data, timestamp: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save session to localStorage', error);
  }
};

export const restoreSession = () => {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    // Optional: Validate data age (e.g., expire after 24h)
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      clearSession();
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to restore session from localStorage', error);
    return null;
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn('Failed to clear session from localStorage', error);
  }
};