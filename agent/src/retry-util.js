/**
 * Retry Utilities
 * Provides exponential backoff and error classification
 */

/**
 * Check if an error is transient (retriable)
 */
export function isRetriableError(error) {
  // Network errors
  if (error.code === 'ECONNREFUSED') return true;
  if (error.code === 'ECONNRESET') return true;
  if (error.code === 'ETIMEDOUT') return true;
  if (error.code === 'ENOTFOUND') return true;
  if (error.code === 'ENETUNREACH') return true;

  // HTTP status codes that are retriable
  if (error.response) {
    const status = error.response.status;
    // 429 Too Many Requests
    if (status === 429) return true;
    // 500-599 Server errors (except 501 Not Implemented)
    if (status >= 500 && status < 600 && status !== 501) return true;
    // 408 Request Timeout
    if (status === 408) return true;
  }

  // Timeout errors
  if (error.message && error.message.includes('timeout')) return true;
  if (error.message && error.message.includes('timed out')) return true;

  // S3 specific errors
  if (error.message && error.message.includes('SlowDown')) return true;
  if (error.message && error.message.includes('ServiceUnavailable')) return true;

  return false;
}

/**
 * Calculate delay for exponential backoff
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds (default 1000)
 * @param {number} maxDelay - Maximum delay in milliseconds (default 30000)
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoffDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
  // Exponential backoff: baseDelay * 2^attempt
  const delay = baseDelay * Math.pow(2, attempt);

  // Add jitter (±20%) to avoid thundering herd
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  const delayWithJitter = delay + jitter;

  // Cap at maxDelay
  return Math.min(delayWithJitter, maxDelay);
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {object} options - Retry options
 * @param {number} options.maxAttempts - Maximum number of attempts (default 3)
 * @param {number} options.baseDelay - Base delay in ms (default 1000)
 * @param {number} options.maxDelay - Max delay in ms (default 30000)
 * @param {Function} options.onRetry - Callback when retrying (attempt, error, delay)
 * @param {Function} options.shouldRetry - Custom retry logic (error) => boolean
 * @returns {Promise<*>} Result of successful function call
 * @throws {Error} Last error if all attempts fail
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    onRetry = null,
    shouldRetry = isRetriableError,
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If this was the last attempt, throw
      if (attempt === maxAttempts - 1) {
        throw error;
      }

      // Check if error is retriable
      if (!shouldRetry(error)) {
        throw error;
      }

      // Calculate delay
      const delay = calculateBackoffDelay(attempt, baseDelay, maxDelay);

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but just in case
  throw lastError;
}

/**
 * Classify error for user-friendly messages
 * @param {Error} error - Error to classify
 * @returns {object} Classification with category and userMessage
 */
export function classifyError(error) {
  // Check for missing dependencies (preserve custom error message if set)
  if (error.code === 'ENOENT' && error.message) {
    if (error.message.includes('aws command not found')) {
      return {
        category: 'missing-dependency',
        userMessage: error.message,
        retriable: false,
      };
    }
    if (error.message.includes('rsync command not found')) {
      return {
        category: 'missing-dependency',
        userMessage: error.message,
        retriable: false,
      };
    }
  }

  // File system errors
  if (error.code === 'ENOENT') {
    return {
      category: 'filesystem',
      userMessage: 'File or directory not found',
      retriable: false,
    };
  }
  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return {
      category: 'filesystem',
      userMessage: 'Permission denied accessing file or directory',
      retriable: false,
    };
  }
  if (error.code === 'ENOSPC') {
    return {
      category: 'filesystem',
      userMessage: 'No space left on device',
      retriable: false,
    };
  }

  // Network errors
  if (error.code === 'ECONNREFUSED') {
    return {
      category: 'network',
      userMessage: 'Connection refused - server may be down',
      retriable: true,
    };
  }
  if (error.code === 'ENOTFOUND') {
    return {
      category: 'network',
      userMessage: 'DNS lookup failed - check your internet connection',
      retriable: true,
    };
  }
  if (error.code === 'ETIMEDOUT' || (error.message && error.message.includes('timeout'))) {
    return {
      category: 'network',
      userMessage: 'Request timed out - check your internet connection',
      retriable: true,
    };
  }

  // HTTP errors
  if (error.response) {
    const status = error.response.status;
    if (status === 401 || status === 403) {
      return {
        category: 'authentication',
        userMessage: 'Authentication failed - check your API key',
        retriable: false,
      };
    }
    if (status === 404) {
      return {
        category: 'notfound',
        userMessage: 'Resource not found on server',
        retriable: false,
      };
    }
    if (status === 413) {
      return {
        category: 'size',
        userMessage: 'Backup file too large',
        retriable: false,
      };
    }
    if (status >= 500) {
      return {
        category: 'server',
        userMessage: 'Server error - please try again later',
        retriable: true,
      };
    }
  }

  // Default
  return {
    category: 'unknown',
    userMessage: error.message || 'Unknown error occurred',
    retriable: isRetriableError(error),
  };
}
