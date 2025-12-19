import { describe, it, expect } from 'vitest';
import {
  MODELS,
  DEFAULT_MODEL,
  is5SeriesModel,
  isGpt52Model,
  getModelById,
  getReasoningEffortOptions,
  getValidReasoningEffort,
  type Model,
  type ReasoningEffortOption
} from '$lib/models';

describe('models', () => {
  describe('MODELS constant', () => {
    it('exports a non-empty array of models', () => {
      expect(Array.isArray(MODELS)).toBe(true);
      expect(MODELS.length).toBeGreaterThan(0);
    });

    it('each model has required properties: id, label, series', () => {
      for (const model of MODELS) {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('label');
        expect(model).toHaveProperty('series');
        expect(typeof model.id).toBe('string');
        expect(typeof model.label).toBe('string');
        expect(typeof model.series).toBe('number');
      }
    });

    it('includes gpt-5.2 model', () => {
      const gpt52 = MODELS.find(m => m.id === 'gpt-5.2');
      expect(gpt52).toBeDefined();
      expect(gpt52?.series).toBe(5);
    });

    it('includes gpt-5-mini model', () => {
      const gpt5mini = MODELS.find(m => m.id === 'gpt-5-mini');
      expect(gpt5mini).toBeDefined();
      expect(gpt5mini?.series).toBe(5);
    });

    it('includes gpt-4.1 model', () => {
      const gpt41 = MODELS.find(m => m.id === 'gpt-4.1');
      expect(gpt41).toBeDefined();
      expect(gpt41?.series).toBe(4);
    });

    it('includes gpt-4.1-mini model', () => {
      const gpt41mini = MODELS.find(m => m.id === 'gpt-4.1-mini');
      expect(gpt41mini).toBeDefined();
      expect(gpt41mini?.series).toBe(4);
    });

    it('does NOT include gpt-5.1 model (replaced by gpt-5.2)', () => {
      const gpt51 = MODELS.find(m => m.id === 'gpt-5.1');
      expect(gpt51).toBeUndefined();
    });

    it('gpt-5.2 has reasoning effort config with none as default', () => {
      const gpt52 = MODELS.find(m => m.id === 'gpt-5.2');
      expect(gpt52?.defaultReasoningEffort).toBe('none');
      expect(gpt52?.supportedReasoningEfforts).toContain('none');
      expect(gpt52?.supportedReasoningEfforts).toContain('low');
      expect(gpt52?.supportedReasoningEfforts).toContain('medium');
      expect(gpt52?.supportedReasoningEfforts).toContain('high');
    });

    it('gpt-5-mini has reasoning effort config with medium as default', () => {
      const gpt5mini = MODELS.find(m => m.id === 'gpt-5-mini');
      expect(gpt5mini?.defaultReasoningEffort).toBe('medium');
      expect(gpt5mini?.supportedReasoningEfforts).toContain('minimal');
      expect(gpt5mini?.supportedReasoningEfforts).toContain('low');
      expect(gpt5mini?.supportedReasoningEfforts).toContain('medium');
      expect(gpt5mini?.supportedReasoningEfforts).toContain('high');
    });

    it('gpt-4.1 has null reasoning effort (not supported)', () => {
      const gpt41 = MODELS.find(m => m.id === 'gpt-4.1');
      expect(gpt41?.defaultReasoningEffort).toBeNull();
      expect(gpt41?.supportedReasoningEfforts).toBeNull();
    });
  });

  describe('DEFAULT_MODEL', () => {
    it('is gpt-5-mini', () => {
      expect(DEFAULT_MODEL).toBe('gpt-5-mini');
    });

    it('exists in MODELS array', () => {
      const defaultExists = MODELS.some(m => m.id === DEFAULT_MODEL);
      expect(defaultExists).toBe(true);
    });
  });

  describe('is5SeriesModel', () => {
    it('returns true for gpt-5.2', () => {
      expect(is5SeriesModel('gpt-5.2')).toBe(true);
    });

    it('returns true for gpt-5-mini', () => {
      expect(is5SeriesModel('gpt-5-mini')).toBe(true);
    });

    it('returns true for gpt-5-nano', () => {
      expect(is5SeriesModel('gpt-5-nano')).toBe(true);
    });

    it('returns false for gpt-4.1', () => {
      expect(is5SeriesModel('gpt-4.1')).toBe(false);
    });

    it('returns false for gpt-4.1-mini', () => {
      expect(is5SeriesModel('gpt-4.1-mini')).toBe(false);
    });

    it('returns false for gpt-4o', () => {
      expect(is5SeriesModel('gpt-4o')).toBe(false);
    });
  });

  describe('isGpt52Model', () => {
    it('returns true for gpt-5.2', () => {
      expect(isGpt52Model('gpt-5.2')).toBe(true);
    });

    it('returns true for gpt-5.2-preview', () => {
      expect(isGpt52Model('gpt-5.2-preview')).toBe(true);
    });

    it('returns false for gpt-5-mini', () => {
      expect(isGpt52Model('gpt-5-mini')).toBe(false);
    });

    it('returns false for gpt-5.1', () => {
      expect(isGpt52Model('gpt-5.1')).toBe(false);
    });

    it('returns false for gpt-4.1', () => {
      expect(isGpt52Model('gpt-4.1')).toBe(false);
    });
  });

  describe('getModelById', () => {
    it('returns model object for valid id', () => {
      const model = getModelById('gpt-5.2');
      expect(model).toBeDefined();
      expect(model?.id).toBe('gpt-5.2');
    });

    it('returns undefined for invalid id', () => {
      const model = getModelById('invalid-model');
      expect(model).toBeUndefined();
    });

    it('returns undefined for gpt-5.1 (removed model)', () => {
      const model = getModelById('gpt-5.1');
      expect(model).toBeUndefined();
    });
  });

  describe('getReasoningEffortOptions', () => {
    it('returns options with none for gpt-5.2', () => {
      const options = getReasoningEffortOptions('gpt-5.2');
      expect(options).toEqual([
        { value: 'none', label: 'None' },
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ]);
    });

    it('returns options with minimal for gpt-5-mini', () => {
      const options = getReasoningEffortOptions('gpt-5-mini');
      expect(options).toEqual([
        { value: 'minimal', label: 'Minimal' },
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ]);
    });

    it('returns null for gpt-4.1', () => {
      const options = getReasoningEffortOptions('gpt-4.1');
      expect(options).toBeNull();
    });

    it('returns null for unknown model', () => {
      const options = getReasoningEffortOptions('unknown');
      expect(options).toBeNull();
    });
  });

  describe('getValidReasoningEffort', () => {
    it('returns null for non-5-series models', () => {
      expect(getValidReasoningEffort('gpt-4.1', 'medium')).toBeNull();
    });

    it('returns none as default for gpt-5.2', () => {
      expect(getValidReasoningEffort('gpt-5.2', undefined)).toBe('none');
    });

    it('converts minimal to none for gpt-5.2', () => {
      expect(getValidReasoningEffort('gpt-5.2', 'minimal')).toBe('none');
    });

    it('returns medium as default for gpt-5-mini', () => {
      expect(getValidReasoningEffort('gpt-5-mini', undefined)).toBe('medium');
    });

    it('converts none to minimal for gpt-5-mini', () => {
      expect(getValidReasoningEffort('gpt-5-mini', 'none')).toBe('minimal');
    });

    it('passes through valid values unchanged', () => {
      expect(getValidReasoningEffort('gpt-5.2', 'high')).toBe('high');
      expect(getValidReasoningEffort('gpt-5-mini', 'low')).toBe('low');
    });
  });

  describe('TypeScript types', () => {
    it('Model type is correctly defined', () => {
      const model: Model = MODELS[0];
      expect(model.id).toBeDefined();
      expect(model.label).toBeDefined();
      expect(model.series).toBeDefined();
    });

    it('ReasoningEffortOption type is correctly defined', () => {
      const options = getReasoningEffortOptions('gpt-5.2');
      if (options) {
        const option: ReasoningEffortOption = options[0];
        expect(option.value).toBeDefined();
        expect(option.label).toBeDefined();
      }
    });
  });
});
