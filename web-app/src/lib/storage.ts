import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'book-translate-db';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

export interface StoredDocument {
	id: string;
	name: string;
	type: 'pdf' | 'markdown' | 'text';
	content: Blob | string; // Blob for PDFs, string for text/markdown
	size: number;
	uploadedAt: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				}
			}
		});
	}
	return dbPromise;
}

export async function saveDocument(doc: StoredDocument): Promise<void> {
	const db = await getDB();
	await db.put(STORE_NAME, doc);
}

export async function getAllDocuments(): Promise<StoredDocument[]> {
	const db = await getDB();
	return db.getAll(STORE_NAME);
}

export async function getDocument(id: string): Promise<StoredDocument | undefined> {
	const db = await getDB();
	return db.get(STORE_NAME, id);
}

export async function deleteDocument(id: string): Promise<void> {
	const db = await getDB();
	await db.delete(STORE_NAME, id);
}

export async function clearAllDocuments(): Promise<void> {
	const db = await getDB();
	await db.clear(STORE_NAME);
}

// Storage estimation utilities
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
	if (navigator.storage?.estimate) {
		const estimate = await navigator.storage.estimate();
		return {
			usage: estimate.usage || 0,
			quota: estimate.quota || 0
		};
	}
	return null;
}

export async function requestPersistentStorage(): Promise<boolean> {
	if (navigator.storage?.persist) {
		return navigator.storage.persist();
	}
	return false;
}

export async function isPersistentStorage(): Promise<boolean> {
	if (navigator.storage?.persisted) {
		return navigator.storage.persisted();
	}
	return false;
}

// Migration from localStorage
export async function migrateFromLocalStorage(): Promise<number> {
	const localStorageKey = 'documents';
	const stored = localStorage.getItem(localStorageKey);

	if (!stored) {
		return 0;
	}

	try {
		const oldDocs = JSON.parse(stored) as Array<{
			id: string;
			name: string;
			type: 'pdf' | 'markdown' | 'text';
			content: string;
			size: number;
			uploadedAt: string;
		}>;

		let migratedCount = 0;

		for (const oldDoc of oldDocs) {
			// Check if document already exists in IndexedDB
			const existing = await getDocument(oldDoc.id);
			if (existing) {
				continue;
			}

			// Convert base64 PDF content to Blob
			let content: Blob | string;
			if (oldDoc.type === 'pdf') {
				// Convert base64 to Blob
				const binaryString = atob(oldDoc.content);
				const bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}
				content = new Blob([bytes], { type: 'application/pdf' });
			} else {
				content = oldDoc.content;
			}

			const newDoc: StoredDocument = {
				id: oldDoc.id,
				name: oldDoc.name,
				type: oldDoc.type,
				content,
				size: oldDoc.size,
				uploadedAt: oldDoc.uploadedAt
			};

			await saveDocument(newDoc);
			migratedCount++;
		}

		// Clear localStorage after successful migration
		if (migratedCount > 0) {
			localStorage.removeItem(localStorageKey);
		}

		return migratedCount;
	} catch (error) {
		console.error('Migration from localStorage failed:', error);
		return 0;
	}
}

// Helper to convert Blob to base64 for API calls
export async function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const base64 = (reader.result as string).split(',')[1];
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

// Helper to generate unique IDs
export function generateDocumentId(): string {
	return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
