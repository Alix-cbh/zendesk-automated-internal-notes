// Timeout and Rety Function Script
async function fetchWithTimeoutAndRetry(url, options = {}, retries = 3, timeout = 40000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      if (!response.ok) throw new Error('Fetch failed');
      return response;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      Sentry.captureException(err);
      await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt))); // exponential backoff
    }
  }
}




export { fetchWithTimeoutAndRetry };