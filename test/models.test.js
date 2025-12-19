import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('models', () => {
  let MODELS, DEFAULT_MODEL, is5SeriesModel, isGpt52Model, getModelById, getReasoningEffortOptions;

  beforeAll(async () => {
    const models = await import(join(__dirname, '../src/models.js'));
    MODELS = models.MODELS;
    DEFAULT_MODEL = models.DEFAULT_MODEL;
    is5SeriesModel = models.is5SeriesModel;
    isGpt52Model = models.isGpt52Model;
    getModelById = models.getModelById;
    getReasoningEffortOptions = models.getReasoningEffortOptions;
  });

  describe('MODELS constant', () => {
    test('exports a non-empty array of models', () => {
      expect(Array.isArray(MODELS)).toBe(true);
      expect(MODELS.length).toBeGreaterThan(0);
    });

    test('each model has required properties: id, label, series', () => {
      for (const model of MODELS) {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('label');
        expect(model).toHaveProperty('series');
        expect(typeof model.id).toBe('string');
        expect(typeof model.label).toBe('string');
        expect(typeof model.series).toBe('number');
      }
    });

    test('includes gpt-5.2 model', () => {
      const gpt52 = MODELS.find(m => m.id === 'gpt-5.2');
      expect(gpt52).toBeDefined();
      expect(gpt52.series).toBe(5);
    });

    test('includes gpt-5-mini model', () => {
      const gpt5mini = MODELS.find(m => m.id === 'gpt-5-mini');
      expect(gpt5mini).toBeDefined();
      expect(gpt5mini.series).toBe(5);
    });

    test('includes gpt-4.1 model', () => {
      const gpt41 = MODELS.find(m => m.id === 'gpt-4.1');
      expect(gpt41).toBeDefined();
      expect(gpt41.series).toBe(4);
    });

    test('includes gpt-4.1-mini model', () => {
      const gpt41mini = MODELS.find(m => m.id === 'gpt-4.1-mini');
      expect(gpt41mini).toBeDefined();
      expect(gpt41mini.series).toBe(4);
    });

    test('does NOT include gpt-5.1 model (replaced by gpt-5.2)', () => {
      const gpt51 = MODELS.find(m => m.id === 'gpt-5.1');
      expect(gpt51).toBeUndefined();
    });

    test('gpt-5.2 has reasoning effort config with none as default', () => {
      const gpt52 = MODELS.find(m => m.id === 'gpt-5.2');
      expect(gpt52.defaultReasoningEffort).toBe('none');
      expect(gpt52.supportedReasoningEfforts).toContain('none');
      expect(gpt52.supportedReasoningEfforts).toContain('low');
      expect(gpt52.supportedReasoningEfforts).toContain('medium');
      expect(gpt52.supportedReasoningEfforts).toContain('high');
    });

    test('gpt-5-mini has reasoning effort config with medium as default', () => {
      const gpt5mini = MODELS.find(m => m.id === 'gpt-5-mini');
      expect(gpt5mini.defaultReasoningEffort).toBe('medium');
      expect(gpt5mini.supportedReasoningEfforts).toContain('minimal');
      expect(gpt5mini.supportedReasoningEfforts).toContain('low');
      expect(gpt5mini.supportedReasoningEfforts).toContain('medium');
      expect(gpt5mini.supportedReasoningEfforts).toContain('high');
    });

    test('gpt-4.1 has null reasoning effort (not supported)', () => {
      const gpt41 = MODELS.find(m => m.id === 'gpt-4.1');
      expect(gpt41.defaultReasoningEffort).toBeNull();
      expect(gpt41.supportedReasoningEfforts).toBeNull();
    });
  });

  describe('DEFAULT_MODEL', () => {
    test('is gpt-5-mini', () => {
      expect(DEFAULT_MODEL).toBe('gpt-5-mini');
    });

    test('exists in MODELS array', () => {
      const defaultExists = MODELS.some(m => m.id === DEFAULT_MODEL);
      expect(defaultExists).toBe(true);
    });
  });

  describe('is5SeriesModel', () => {
    test('returns true for gpt-5.2', () => {
      expect(is5SeriesModel('gpt-5.2')).toBe(true);
    });

    test('returns true for gpt-5-mini', () => {
      expect(is5SeriesModel('gpt-5-mini')).toBe(true);
    });

    test('returns true for gpt-5-nano', () => {
      expect(is5SeriesModel('gpt-5-nano')).toBe(true);
    });

    test('returns false for gpt-4.1', () => {
      expect(is5SeriesModel('gpt-4.1')).toBe(false);
    });

    test('returns false for gpt-4.1-mini', () => {
      expect(is5SeriesModel('gpt-4.1-mini')).toBe(false);
    });

    test('returns false for gpt-4o', () => {
      expect(is5SeriesModel('gpt-4o')).toBe(false);
    });
  });

  describe('isGpt52Model', () => {
    test('returns true for gpt-5.2', () => {
      expect(isGpt52Model('gpt-5.2')).toBe(true);
    });

    test('returns true for gpt-5.2-preview', () => {
      expect(isGpt52Model('gpt-5.2-preview')).toBe(true);
    });

    test('returns false for gpt-5-mini', () => {
      expect(isGpt52Model('gpt-5-mini')).toBe(false);
    });

    test('returns false for gpt-5.1', () => {
      expect(isGpt52Model('gpt-5.1')).toBe(false);
    });

    test('returns false for gpt-4.1', () => {
      expect(isGpt52Model('gpt-4.1')).toBe(false);
    });
  });

  describe('getModelById', () => {
    test('returns model object for valid id', () => {
      const model = getModelById('gpt-5.2');
      expect(model).toBeDefined();
      expect(model.id).toBe('gpt-5.2');
    });

    test('returns undefined for invalid id', () => {
      const model = getModelById('invalid-model');
      expect(model).toBeUndefined();
    });

    test('returns undefined for gpt-5.1 (removed model)', () => {
      const model = getModelById('gpt-5.1');
      expect(model).toBeUndefined();
    });
  });

  describe('getReasoningEffortOptions', () => {
    test('returns options with none for gpt-5.2', () => {
      const options = getReasoningEffortOptions('gpt-5.2');
      expect(options).toEqual([
        { value: 'none', label: 'None' },
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ]);
    });

    test('returns options with minimal for gpt-5-mini', () => {
      const options = getReasoningEffortOptions('gpt-5-mini');
      expect(options).toEqual([
        { value: 'minimal', label: 'Minimal' },
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ]);
    });

    test('returns null for gpt-4.1', () => {
      const options = getReasoningEffortOptions('gpt-4.1');
      expect(options).toBeNull();
    });

    test('returns null for unknown model', () => {
      const options = getReasoningEffortOptions('unknown');
      expect(options).toBeNull();
    });
  });
});
