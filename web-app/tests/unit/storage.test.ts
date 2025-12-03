import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to mock the idb module before importing storage
vi.mock('idb', () => {
	let mockStore: Map<string, unknown> = new Map();

	return {
		openDB: vi.fn(() => Promise.resolve({
			put: vi.fn((store: string, doc: unknown) => {
				mockStore.set((doc as { id: string }).id, doc);
				return Promise.resolve();
			}),
			getAll: vi.fn(() => Promise.resolve(Array.from(mockStore.values()))),
			get: vi.fn((store: string, id: string) => Promise.resolve(mockStore.get(id))),
			delete: vi.fn((store: string, id: string) => {
				mockStore.delete(id);
				return Promise.resolve();
			}),
			clear: vi.fn(() => {
				mockStore.clear();
				return Promise.resolve();
			})
		})),
		// Export a way to reset the mock store between tests
		__resetMockStore: () => { mockStore = new Map(); },
		__getMockStore: () => mockStore
	};
});

import {
	saveDocument,
	getAllDocuments,
	clearAllDocuments,
	getDocumentsStorageUsed,
	type StoredDocument
} from '$lib/storage';
import { openDB, __resetMockStore } from 'idb';

describe('Storage - getDocumentsStorageUsed', () => {
	beforeEach(() => {
		// Reset mock store before each test
		(__resetMockStore as () => void)();
	});

	it('returns 0 when no documents exist', async () => {
		const usage = await getDocumentsStorageUsed();
		expect(usage).toBe(0);
	});

	it('returns sum of document sizes for text documents', async () => {
		const doc1: StoredDocument = {
			id: 'doc1',
			name: 'test1.md',
			type: 'markdown',
			content: 'Hello world',
			size: 1000,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		};

		const doc2: StoredDocument = {
			id: 'doc2',
			name: 'test2.txt',
			type: 'text',
			content: 'More content',
			size: 2500,
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		};

		await saveDocument(doc1);
		await saveDocument(doc2);

		const usage = await getDocumentsStorageUsed();
		expect(usage).toBe(3500); // 1000 + 2500
	});

	it('returns sum of document sizes for PDF documents with Blob content', async () => {
		const pdfBlob = new Blob(['PDF content here'], { type: 'application/pdf' });

		const doc: StoredDocument = {
			id: 'pdf1',
			name: 'book.pdf',
			type: 'pdf',
			content: pdfBlob,
			size: 5000000, // 5MB stored size
			uploadedAt: new Date().toISOString(),
			phase: 'uploaded'
		};

		await saveDocument(doc);

		const usage = await getDocumentsStorageUsed();
		expect(usage).toBe(5000000);
	});

	it('handles mixed document types correctly', async () => {
		const pdfBlob = new Blob(['PDF'], { type: 'application/pdf' });

		const docs: StoredDocument[] = [
			{
				id: 'doc1',
				name: 'book.pdf',
				type: 'pdf',
				content: pdfBlob,
				size: 4600000, // ~4.6MB
				uploadedAt: new Date().toISOString(),
				phase: 'uploaded'
			},
			{
				id: 'doc2',
				name: 'chapter.md',
				type: 'markdown',
				content: '# Chapter 1\nContent here',
				size: 60000, // ~60KB
				uploadedAt: new Date().toISOString(),
				phase: 'converted'
			},
			{
				id: 'doc3',
				name: 'notes.txt',
				type: 'text',
				content: 'Notes',
				size: 5000, // ~5KB
				uploadedAt: new Date().toISOString(),
				phase: 'uploaded'
			}
		];

		for (const doc of docs) {
			await saveDocument(doc);
		}

		const usage = await getDocumentsStorageUsed();
		// Should be sum of sizes: 4600000 + 60000 + 5000 = 4665000
		expect(usage).toBe(4665000);
	});
});
