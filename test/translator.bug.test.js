import { jest } from '@jest/globals';
import { createTranslator } from '../src/translator.js';

describe('Translator Bug: English text in Japanese output', () => {
  let mockCreate;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    mockCreate = jest.fn();
  });

  test('should return ONLY Japanese translation, not source + translation', async () => {
    const mockResponse = `# 著者より

**私**たち一人ひとりが持ち、分かち合う人生の体験は...`;

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: mockResponse } }]
    });

    const translator = createTranslator();
    translator.client.chat.completions.create = mockCreate;

    const result = await translator.translateChunk('# Author\'s Note\n\n**T**he life experiences...');

    const englishHeaderPattern = /^#\s+Author's Note/m;
    const japaneseHeaderPattern = /^#\s+著者より/m;

    expect(result).toMatch(japaneseHeaderPattern);
    expect(result).not.toMatch(englishHeaderPattern);
  });

  test('should not contain [Source] or [Translation] markers', async () => {
    const mockResponse = `翌朝、私は飛行機に乗らなきゃいけない...`;

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: mockResponse } }]
    });

    const translator = createTranslator();
    translator.client.chat.completions.create = mockCreate;

    const result = await translator.translateChunk('The next morning, I have a plane to catch...');

    expect(result).not.toContain('[Source]');
    expect(result).not.toContain('[Translation]');
    expect(result).toContain('翌朝');
  });

  test('should not start with meta-instructions in Japanese', async () => {
    const mockResponse = `# 著者より

**私**たち一人ひとりが持ち、分かち合う人生の体験は...`;

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: mockResponse } }]
    });

    const translator = createTranslator();
    translator.client.chat.completions.create = mockCreate;

    const result = await translator.translateChunk('# Author\'s Note\n\n**T**he life experiences...');

    expect(result).not.toContain('英語の原文をお送りください');
    expect(result).not.toContain('指示どおり');
  });
});
