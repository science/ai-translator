import { jest } from '@jest/globals';
import { createTranslator } from '../../src/translator.js';
import { translateDocument } from '../../src/translationEngine.js';

describe('Context-Aware Translation Integration', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
  });

  describe('Full document translation with context', () => {
    test('should translate multi-chunk document with context chaining', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: '# Chapter 1\n\nThis is the first chapter.' },
        { index: 1, type: 'paragraph-section', content: 'The story continues here.' },
        { index: 2, type: 'paragraph-section', content: 'And finally, the conclusion.' }
      ];

      // Track contexts passed to mock
      const capturedContexts = [];

      mockClient.chat.completions.create.mockImplementation(async (params) => {
        // Extract context from the user message JSON
        const userMessage = params.messages.find(m => m.role === 'user');
        try {
          const parsed = JSON.parse(userMessage.content);
          capturedContexts.push(parsed.context);
        } catch {
          capturedContexts.push(null);
        }

        return {
          choices: [{ message: { content: JSON.stringify({ translation: '翻訳テスト' }) } }]
        };
      });

      const translator = createTranslator({ client: mockClient });
      await translateDocument(chunks, translator.translateChunk);

      // Verify context chaining
      expect(capturedContexts).toHaveLength(3);

      // First chunk has no previous
      expect(capturedContexts[0].previous_english).toBeNull();
      expect(capturedContexts[0].previous_japanese_translation).toBeNull();
      expect(capturedContexts[0].next_english).toBe('The story continues here.');

      // Second chunk has previous and next
      expect(capturedContexts[1].previous_english).toBe('# Chapter 1\n\nThis is the first chapter.');
      expect(capturedContexts[1].previous_japanese_translation).toBe('翻訳テスト');
      expect(capturedContexts[1].next_english).toBe('And finally, the conclusion.');

      // Third chunk has no next
      expect(capturedContexts[2].previous_english).toBe('The story continues here.');
      expect(capturedContexts[2].previous_japanese_translation).toBe('翻訳テスト');
      expect(capturedContexts[2].next_english).toBeNull();
    });
  });

  describe('Context bleed prevention', () => {
    test('should only include translated chunk_to_translate in output', async () => {
      const chunks = [
        { index: 0, type: 'header-section', content: 'First chunk to translate' },
        { index: 1, type: 'paragraph-section', content: 'Second chunk to translate' }
      ];

      mockClient.chat.completions.create.mockImplementation(async (params) => {
        const userMessage = params.messages.find(m => m.role === 'user');
        const parsed = JSON.parse(userMessage.content);

        // Return translation that only includes the chunk_to_translate
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                translation: `翻訳: ${parsed.chunk_to_translate}`
              })
            }
          }]
        };
      });

      const translator = createTranslator({ client: mockClient });
      const { translatedChunks } = await translateDocument(chunks, translator.translateChunk);

      // Verify no context bleed - translations should not contain context material
      expect(translatedChunks[0].translatedContent).toBe('翻訳: First chunk to translate');
      expect(translatedChunks[0].translatedContent).not.toContain('Second chunk');

      expect(translatedChunks[1].translatedContent).toBe('翻訳: Second chunk to translate');
      expect(translatedChunks[1].translatedContent).not.toContain('First chunk');
    });
  });

  describe('Context-aware opt-out', () => {
    test('should not include response_format when contextAware is false', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '翻訳テスト' } }]
      });

      const translator = createTranslator({ client: mockClient, contextAware: false });
      await translator.translateChunk('Test content', { previousEnglish: 'Previous' });

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];

      // Should not have response_format when contextAware is false
      expect(callArgs.response_format).toBeUndefined();

      // User message should be raw content, not JSON
      const userMessage = callArgs.messages.find(m => m.role === 'user');
      expect(userMessage.content).toBe('Test content');
    });

    test('should include response_format when contextAware is true (default)', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ translation: '翻訳テスト' }) } }]
      });

      const translator = createTranslator({ client: mockClient }); // contextAware defaults to true
      await translator.translateChunk('Test content', { previousEnglish: 'Previous' });

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];

      // Should have response_format
      expect(callArgs.response_format).toBeDefined();
      expect(callArgs.response_format.type).toBe('json_schema');

      // User message should be JSON
      const userMessage = callArgs.messages.find(m => m.role === 'user');
      const parsed = JSON.parse(userMessage.content);
      expect(parsed.chunk_to_translate).toBe('Test content');
    });
  });

  describe('System prompt verification', () => {
    test('should include context-aware instructions in system prompt', async () => {
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ translation: 'テスト' }) } }]
      });

      const translator = createTranslator({ client: mockClient });
      await translator.translateChunk('Test', { previousEnglish: 'Previous' });

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const systemPrompt = callArgs.messages.find(m => m.role === 'system').content;

      // Should include key context-aware instructions
      expect(systemPrompt).toContain('chunk_to_translate');
      expect(systemPrompt).toContain('context');
      expect(systemPrompt).toContain('REFERENCE ONLY');
      expect(systemPrompt).toContain('previous_japanese_translation');
    });
  });
});
