// Timeout and Retry Function Script
/**
 * Makes a secure API request using ZAF's client.request with retry logic.
 * @param {object} client - The ZAF client object.
 * @param {string} url - The request URL.
 * @param {object} options - Request options, similar to fetch().
 * @param {number} retries - The number of retry attempts.
 * @param {number} timeout - The request timeout in milliseconds.
 * @param {boolean} testing - The request type or environment.
 * @returns {Promise<any>} A promise that resolves with the response data.
 */

//ENSURE TESTING = FALSE FOR PRODUCTION, THIS PARAM CONTROLS SECURE SETTINGS API REQUEST FOR DEV VS PRODUCTION
async function fetchWithTimeoutAndRetry(client, url, options = {}, retries = 2, timeout = 40000, testing = true) {
  
  if(testing){
    return await fetchWithTimeoutAndRetrytesting(url, options, retries, timeout);
  } else { 

    // Convert fetch-style options to ZAF's client.request options
    const zafOptions = {
        url: url,
        type: options.method || 'GET',
        headers: { ...options.headers }, // Create a copy of headers
        data: options.body,
        contentType: 'application/json',
        secure: true, // Use secure settings
        timeout: timeout
    };

    // Replace the hardcoded API key with a secure setting placeholder
    // This assumes your API key setting is named 'apiKey' in manifest.json
    if (zafOptions.headers && zafOptions.headers['x-api-key']) {
        zafOptions.headers['x-api-key'] = '{{setting.apiKey}}';
    }

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
        // client.request returns the parsed response body on success
        return await client.request(zafOptions);
        } catch (err) {
        // If it's the last attempt, re-throw the error to be handled by the caller
        if (attempt === retries - 1) throw err;
        cwr('recordError', err); 

        if (window.Sentry) {
            Sentry.captureException(err);
        }
        // Exponential backoff before retrying
        await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
        }
    }

  }
}


// Timeout and Rety Function Script
/*async function fetchWithTimeoutAndRetrytesting(url, options = {}, retries, timeout) {
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
      cwr('recordError', err);
      await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt))); // exponential backoff
    }
  }
}*/

async function fetchWithTimeoutAndRetrytesting(url, options = {}, retries, timeout) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(id);
      const responseText = await response.text();
      let json;
      try {
        json = responseText ? JSON.parse(responseText) : null;
      } catch (parseErr) {
        // simulate ZAF behavior where a non-JSON response would be an error
        const error = new Error("Response is not valid JSON");
        error.status = response.status;
        error.statusText = response.statusText;
        throw error;
      }

      if (!response.ok) {
        const error = new Error(
          `Fetch failed: ${response.status} ${response.statusText}`
        );
        error.status = response.status;
        error.statusText = response.statusText;
        error.response = json;
        throw error;
      }

      return json;

    } catch (err) {
      if (attempt === retries - 1) throw err;

      if (typeof cwr === "function") cwr("recordError", err);
      if (window.Sentry) Sentry.captureException(err);
      await new Promise((res) =>
        setTimeout(res, 1000 * Math.pow(2, attempt))
      );
    }
  }
}




export { fetchWithTimeoutAndRetry };