import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

export function createTranslator(options = {}) {
  let client;

  if (options.client) {
    client = options.client;
  } else {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    const clientConfig = {
      apiKey: apiKey,
    };

    if (options.timeout) {
      clientConfig.timeout = options.timeout;
    }

    if (options.maxRetries !== undefined) {
      clientConfig.maxRetries = options.maxRetries;
    }

    client = new OpenAI(clientConfig);
  }

  const model = options.model || 'gpt-4o';
  const verbosity = options.verbosity || 'low';
  const reasoningEffort = options.reasoningEffort || 'medium';

  function isRetryableError(error) {
    const retryableStatusCodes = [429, 500, 502, 503, 504];
    const retryableErrorCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];

    if (error.status && retryableStatusCodes.includes(error.status)) {
      return true;
    }

    if (error.code && retryableErrorCodes.includes(error.code)) {
      return true;
    }

    return false;
  }

  function getChunkPreview(chunk, maxLength = 50) {
    if (chunk.length <= maxLength) {
      return chunk;
    }
    return chunk.substring(0, maxLength - 3) + '...';
  }

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function translateChunk(chunk, targetLanguage = 'Japanese') {
    const systemPrompt = `You are a professional translator. Translate the following English text to ${targetLanguage} while preserving markdown formatting.`;
    const maxAttempts = (options.maxRetries !== undefined ? options.maxRetries : 2) + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const requestParams = {
          model: model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: chunk
            }
          ]
        };

        if (model.startsWith('gpt-5')) {
          requestParams.verbosity = verbosity;
          requestParams.reasoning_effort = reasoningEffort;
        }

        const response = await client.chat.completions.create(requestParams);

        if (!response.choices || response.choices.length === 0) {
          throw new Error('Invalid response from OpenAI API');
        }

        return response.choices[0].message.content;
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts;
        const shouldRetry = isRetryableError(error);

        if (!isLastAttempt && shouldRetry) {
          const backoffDelay = Math.pow(2, attempt - 1) * 1000;

          console.error(`Translation error (attempt ${attempt}/${maxAttempts}):`, {
            error: error.message,
            chunkPreview: getChunkPreview(chunk),
            chunkLength: chunk.length,
            retryingIn: `${backoffDelay}ms`
          });

          await sleep(backoffDelay);
        } else {
          if (!shouldRetry) {
            console.error('Non-retryable translation error:', {
              error: error.message,
              status: error.status,
              chunkPreview: getChunkPreview(chunk)
            });
          }
          throw error;
        }
      }
    }
  }

  return {
    client,
    translateChunk
  };
}
