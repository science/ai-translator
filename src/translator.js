import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

export function createTranslator(options = {}) {
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

  const client = new OpenAI(clientConfig);

  async function translateChunk(chunk, targetLanguage = 'Japanese') {
    const systemPrompt = `You are a professional translator. Translate the following English text to ${targetLanguage} while preserving markdown formatting.`;

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
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
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error('Invalid response from OpenAI API');
      }

      return response.choices[0].message.content;
    } catch (error) {
      throw error;
    }
  }

  return {
    client,
    translateChunk
  };
}
