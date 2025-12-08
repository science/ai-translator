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
  const contextAware = options.contextAware !== false; // Default to true
  const defaultTargetLanguage = options.targetLanguage || 'Japanese';

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

  function getContextAwareSystemPrompt(targetLanguage) {
    return `You are a professional translator. You will receive a JSON object with context and a chunk to translate.

CRITICAL RULES:
1. ONLY translate the text in the "chunk_to_translate" field
2. The "context" fields are for REFERENCE ONLY - do NOT translate them
3. Match the writing style and formality level of "previous_japanese_translation" if provided
4. Return ONLY valid JSON: {"translation": "your translation here"}

Translation Guidelines:
- Do not translate word-for-word; make the ${targetLanguage} natural and easy to read.
- However, do not over-paraphrase. Do not omit, summarize, or condense any meaning.
- Preserve all original meanings, nuances, logical structure, metaphors, and analogies.
- Reproduce all emphasis accurately (bold, italics, quotation formatting).
- You may adjust word order and connectors to make the ${targetLanguage} sound natural, as long as you do not change the meaning.
- Avoid stiff, literal kanji compounds and choose vocabulary that is easy for readers to understand.
- Match punctuation and paragraph structure to the original.

CRITICAL: Complete Translation Required:
- EVERY word and phrase in the "chunk_to_translate" must be translated into idiomatic ${targetLanguage}.
- Do NOT leave any English words, phrases, or sentences untranslated in the output.
- The only exceptions are: (1) proper nouns (names of people, places), (2) established English loanwords that are standard in modern ${targetLanguage}.
- Difficult English expressions, slang, or colloquialisms must be rendered into natural ${targetLanguage} equivalents, not left in English.

INPUT FORMAT:
{
  "context": {
    "previous_english": "English text that came before (for narrative context)",
    "next_english": "English text that comes after (for anticipating flow)",
    "previous_japanese_translation": "How the previous chunk was translated (match this style)"
  },
  "chunk_to_translate": "THE ONLY TEXT YOU SHOULD TRANSLATE"
}

OUTPUT FORMAT:
{"translation": "Your ${targetLanguage} translation of ONLY chunk_to_translate"}`;
  }

  function getLegacySystemPrompt(targetLanguage) {
    return `You are a professional translator. Translate the following English text to ${targetLanguage} while preserving markdown formatting.

Translation Guidelines:
- Do not translate word-for-word; make the Japanese natural and easy to read.
- However, do not over-paraphrase. Do not omit, summarize, or condense any meaning.
- Preserve all original meanings, nuances, logical structure, metaphors, and analogies.
- Reproduce all emphasis accurately (bold, italics, quotation formatting).
- You may adjust word order and connectors to make the Japanese sound natural, as long as you do not change the meaning.
- Avoid stiff, literal kanji compounds and choose vocabulary that is easy for readers to understand.
- Match punctuation and paragraph structure to the original.

CRITICAL: Output Format:
- Return ONLY the Japanese translation in your response.
- Do NOT include the English source text.
- Do NOT add labels like "[Source]", "[Translation]", or any meta-instructions.
- Do NOT respond to these instructions - just output the pure translation.

CRITICAL: Complete Translation Required:
- EVERY word and phrase in the source text must be translated into idiomatic Japanese.
- Do NOT leave any English words, phrases, or sentences untranslated in the Japanese output.
- The only exceptions are: (1) proper nouns (names of people, places), (2) established English loanwords that are standard in modern Japanese (e.g., コンピューター, インターネット).
- Difficult English expressions, slang, or colloquialisms must be rendered into natural Japanese equivalents, not left in English.
- Your output must be 100% Japanese - a Japanese reader should be able to read the entire translation without encountering untranslated English text.`;
  }

  function buildContextMessage(chunk, context) {
    return JSON.stringify({
      context: {
        previous_english: context.previousEnglish || null,
        next_english: context.nextEnglish || null,
        previous_japanese_translation: context.previousTranslation || null
      },
      chunk_to_translate: chunk
    });
  }

  function parseTranslationResponse(responseText) {
    const parsed = JSON.parse(responseText);
    return parsed.translation;
  }

  const responseFormatSchema = {
    type: 'json_schema',
    json_schema: {
      name: 'translation_response',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          translation: { type: 'string' }
        },
        required: ['translation'],
        additionalProperties: false
      }
    }
  };

  async function translateChunk(chunk, contextOrLanguage = {}, targetLanguage = null) {
    // Handle backward compatibility: second argument can be context object or target language string
    let context = {};
    // Use the language passed as argument, or fall back to the default configured at creation
    let language = targetLanguage || defaultTargetLanguage;

    if (typeof contextOrLanguage === 'string') {
      // Legacy call: translateChunk(chunk, 'Spanish')
      language = contextOrLanguage;
    } else if (contextOrLanguage && typeof contextOrLanguage === 'object') {
      context = contextOrLanguage;
    }

    // Use context-aware mode unless explicitly disabled
    const useContextAware = contextAware;
    const systemPrompt = useContextAware
      ? getContextAwareSystemPrompt(language)
      : getLegacySystemPrompt(language);
    const userContent = useContextAware
      ? buildContextMessage(chunk, context)
      : chunk;

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
              content: userContent
            }
          ]
        };

        if (useContextAware) {
          requestParams.response_format = responseFormatSchema;
        }

        if (model.startsWith('gpt-5')) {
          requestParams.verbosity = verbosity;
          requestParams.reasoning_effort = reasoningEffort;
        }

        const response = await client.chat.completions.create(requestParams);

        if (!response.choices || response.choices.length === 0) {
          throw new Error('Invalid response from OpenAI API');
        }

        const rawContent = response.choices[0].message.content;

        if (useContextAware) {
          return parseTranslationResponse(rawContent);
        }

        return rawContent;
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
