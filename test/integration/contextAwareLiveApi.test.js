import { jest } from '@jest/globals';
import { createTranslator } from '../../src/translator.js';
import { translateDocument } from '../../src/translationEngine.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * E2E tests that verify context-aware translation is actually working on the wire.
 * These tests use gpt-5-mini for cost efficiency.
 */
describe('Context-Aware Translation Live API E2E', () => {
  // Skip if no API key
  const hasApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '';
  const describeOrSkip = hasApiKey ? describe : describe.skip;

  describeOrSkip('Live API verification', () => {
    let capturedRequests = [];

    beforeEach(() => {
      capturedRequests = [];
    });

    test('should send JSON context structure to OpenAI when contextAware=true', async () => {
      // Create a real OpenAI client with interception
      const realClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Wrap the completions.create method to capture requests
      const originalCreate = realClient.chat.completions.create.bind(realClient.chat.completions);
      realClient.chat.completions.create = async (params) => {
        capturedRequests.push(JSON.parse(JSON.stringify(params)));
        return originalCreate(params);
      };

      const translator = createTranslator({
        client: realClient,
        model: 'gpt-5-mini',
        contextAware: true
      });

      // Translate 2 chunks to verify context chaining
      const chunks = [
        { index: 0, type: 'header-section', content: 'Chapter One. This is the beginning of our story.' },
        { index: 1, type: 'paragraph-section', content: 'The story continues with more interesting events.' }
      ];

      const { translatedChunks } = await translateDocument(chunks, translator.translateChunk);

      // Verify we made 2 API calls
      expect(capturedRequests).toHaveLength(2);

      // Verify FIRST request has context-aware structure
      const firstRequest = capturedRequests[0];
      expect(firstRequest.response_format).toBeDefined();
      expect(firstRequest.response_format.type).toBe('json_schema');

      const firstUserMessage = firstRequest.messages.find(m => m.role === 'user');
      const firstParsed = JSON.parse(firstUserMessage.content);

      // First chunk should have context structure with null previous
      expect(firstParsed).toHaveProperty('context');
      expect(firstParsed).toHaveProperty('chunk_to_translate');
      expect(firstParsed.context.previous_english).toBeNull();
      expect(firstParsed.context.previous_japanese_translation).toBeNull();
      expect(firstParsed.context.next_english).toBe('The story continues with more interesting events.');
      expect(firstParsed.chunk_to_translate).toBe('Chapter One. This is the beginning of our story.');

      // Verify SECOND request has previous context filled in
      const secondRequest = capturedRequests[1];
      const secondUserMessage = secondRequest.messages.find(m => m.role === 'user');
      const secondParsed = JSON.parse(secondUserMessage.content);

      expect(secondParsed.context.previous_english).toBe('Chapter One. This is the beginning of our story.');
      expect(secondParsed.context.previous_japanese_translation).toBeTruthy(); // Should have the first translation
      expect(secondParsed.context.next_english).toBeNull();
      expect(secondParsed.chunk_to_translate).toBe('The story continues with more interesting events.');

      // Verify translations were returned
      expect(translatedChunks).toHaveLength(2);
      expect(translatedChunks[0].translatedContent).toBeTruthy();
      expect(translatedChunks[1].translatedContent).toBeTruthy();
    }, 60000); // 60 second timeout for API calls

    test('should NOT send JSON context structure when contextAware=false', async () => {
      const realClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const originalCreate = realClient.chat.completions.create.bind(realClient.chat.completions);
      realClient.chat.completions.create = async (params) => {
        capturedRequests.push(JSON.parse(JSON.stringify(params)));
        return originalCreate(params);
      };

      const translator = createTranslator({
        client: realClient,
        model: 'gpt-5-mini',
        contextAware: false
      });

      const chunks = [
        { index: 0, type: 'header-section', content: 'Test content for legacy mode.' }
      ];

      await translateDocument(chunks, translator.translateChunk);

      expect(capturedRequests).toHaveLength(1);

      const request = capturedRequests[0];

      // Should NOT have response_format when contextAware is false
      expect(request.response_format).toBeUndefined();

      // User message should be raw text, not JSON
      const userMessage = request.messages.find(m => m.role === 'user');
      expect(userMessage.content).toBe('Test content for legacy mode.');

      // Verify it's NOT parseable as our context JSON
      expect(() => {
        const parsed = JSON.parse(userMessage.content);
        expect(parsed.chunk_to_translate).toBeUndefined();
      }).toThrow();
    }, 60000);

    test('context-aware should be enabled by default', async () => {
      const realClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const originalCreate = realClient.chat.completions.create.bind(realClient.chat.completions);
      realClient.chat.completions.create = async (params) => {
        capturedRequests.push(JSON.parse(JSON.stringify(params)));
        return originalCreate(params);
      };

      // Create translator WITHOUT specifying contextAware (should default to true)
      const translator = createTranslator({
        client: realClient,
        model: 'gpt-5-mini'
      });

      const chunks = [
        { index: 0, type: 'paragraph-section', content: 'Default mode test.' }
      ];

      await translateDocument(chunks, translator.translateChunk);

      expect(capturedRequests).toHaveLength(1);

      const request = capturedRequests[0];

      // Should have response_format (indicating context-aware mode)
      expect(request.response_format).toBeDefined();
      expect(request.response_format.type).toBe('json_schema');

      // User message should be JSON with context structure
      const userMessage = request.messages.find(m => m.role === 'user');
      const parsed = JSON.parse(userMessage.content);
      expect(parsed).toHaveProperty('context');
      expect(parsed).toHaveProperty('chunk_to_translate');
    }, 60000);
  });
});
