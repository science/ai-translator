import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

export function createRectifier(options = {}) {
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

  // Helper to check if model is GPT-5.1 family (supports "none", not "minimal")
  function isGpt51Model(modelName) {
    return /gpt-5\.1/.test(modelName);
  }

  // Helper to get valid reasoning_effort for the model
  // GPT-5.1: supports none, low, medium, high (default: none)
  // GPT-5/5-mini/5-nano: supports minimal, low, medium, high (default: medium)
  function getValidReasoningEffort(modelName, requestedEffort) {
    const isGpt51 = isGpt51Model(modelName);

    if (isGpt51) {
      // GPT-5.1 defaults to "none" and doesn't support "minimal"
      if (!requestedEffort) return 'none';
      if (requestedEffort === 'minimal') return 'none';
      return requestedEffort;
    } else {
      // GPT-5/5-mini/5-nano default to "medium" and don't support "none"
      if (!requestedEffort) return 'medium';
      if (requestedEffort === 'none') return 'minimal';
      return requestedEffort;
    }
  }

  const reasoningEffort = getValidReasoningEffort(model, options.reasoningEffort);

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

  async function rectifyChunk(chunk) {
    const systemPrompt = `You are a professional text rectifier specializing in fixing OCR and PDF-to-markdown conversion errors.

Your task is to correct English text that has been poorly converted from PDF to markdown format, while preserving the original meaning and markdown structure.

Rectification Guidelines:
1. Fix OCR errors:
   - Correct missing or wrong first letters (e.g., "ontents" → "Contents", "tae" → "The", "Joreface" → "Preface")
   - Fix broken spacing (e.g., "Ww hile" → "While")
   - Correct obvious typos and character recognition errors

2. Remove PDF artifacts and gibberish:
   - Delete page numbers that appear mid-text
   - Remove footer markers (e.g., "Preface xxi") that break paragraph flow
   - Delete random character strings that are clearly OCR noise (e.g., "26 Gimam & eo. @ 7 Wat")
   - Remove code block markers (\`\`\`) that are OCR artifacts, not actual code

3. Restore paragraph flow:
   - Remove page breaks and footer markers that split paragraphs
   - Rejoin text that should be continuous
   - Maintain proper paragraph separation where intended

4. Preserve markdown structure:
   - Keep all legitimate headers (# ## ###)
   - Preserve emphasis (bold, italics)
   - Maintain lists and formatting
   - Keep actual code blocks that are part of the content

5. Preserve legitimate content:
   - Do NOT remove, summarize, or condense actual content
   - Keep all proper nouns, citations, and references
   - Maintain the original meaning exactly
   - Preserve all chapter numbers, section markers, and page references that are part of the content structure

CRITICAL: Output Format:
- Return ONLY the corrected English text in your response
- Do NOT add labels like "[Original]", "[Corrected]", or any meta-commentary
- Do NOT explain what you fixed
- Output must be pure, clean markdown text
- Match the paragraph structure and formatting of the intended document

CRITICAL: Complete Rectification:
- Every visible error must be corrected
- No OCR artifacts should remain in the output
- The text should read naturally and correctly
- A reader should not be able to tell the text was ever corrupted`;

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
              content: typeof chunk === 'string' ? chunk : chunk.content
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

          if (options.verbose !== false) {
            console.error(`Rectification error (attempt ${attempt}/${maxAttempts}):`, {
              error: error.message,
              chunkPreview: getChunkPreview(typeof chunk === 'string' ? chunk : chunk.content),
              chunkLength: typeof chunk === 'string' ? chunk.length : chunk.content.length,
              retryingIn: `${backoffDelay}ms`
            });
          }

          await sleep(backoffDelay);
        } else {
          if (!shouldRetry && options.verbose !== false) {
            console.error('Non-retryable rectification error:', {
              error: error.message,
              status: error.status,
              chunkPreview: getChunkPreview(typeof chunk === 'string' ? chunk : chunk.content)
            });
          }
          throw error;
        }
      }
    }
  }

  return {
    client,
    rectifyChunk
  };
}
