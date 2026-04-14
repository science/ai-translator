/**
 * LLM-based font selection for PDF export.
 * Uses the OpenAI API to pick the best Noto Sans variant
 * for the user's translation context.
 */

export interface FontConfig {
	url: string | null;
	label: string;
}

export interface FontSelection {
	font: string;
	reason: string;
}

/**
 * Available Noto Sans font variants with their Google Fonts CDN TTF URLs.
 */
export const AVAILABLE_FONTS: Record<string, FontConfig> = {
	NotoSansJP: {
		url: 'https://fonts.gstatic.com/s/notosansjp/v53/KFRmCnaiYGlBY-PmQxJMIm1ZQ38.ttf',
		label: 'Japanese'
	},
	NotoSansKR: {
		url: 'https://fonts.gstatic.com/s/notosanskr/v36/PbykFmXiEBPT4ITbgNA5CgmG0HNal4Ck.ttf',
		label: 'Korean'
	},
	NotoSansSC: {
		url: 'https://fonts.gstatic.com/s/notosanssc/v37/k3kCo84MPvpLmixcA63oeALhL4iJ-Q7m8w.ttf',
		label: 'Chinese Simplified'
	},
	NotoSansTC: {
		url: 'https://fonts.gstatic.com/s/notosanstc/v36/-nFkOG829Oofr2wohFbTp9iFOSsLA_ZJ1g.ttf',
		label: 'Chinese Traditional'
	},
	NotoSansArabic: {
		url: 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHGpfUYfA.ttf',
		label: 'Arabic/Persian/Urdu'
	},
	NotoSansThai: {
		url: 'https://fonts.gstatic.com/s/notosansthai/v25/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5Rt.ttf',
		label: 'Thai'
	},
	NotoSansDevanagari: {
		url: 'https://fonts.gstatic.com/s/notosansdevanagari/v26/TuGoUUFzXI5FBtUq5a8bjKYTZjtRU6Sgv3NaV_SNmI0b6w.ttf',
		label: 'Hindi/Sanskrit/Marathi'
	},
	NotoSansHebrew: {
		url: 'https://fonts.gstatic.com/s/notosanshebrew/v44/or3HQ7v33eiDljA1IufXTtVf7V6RvEEdhQlk0LlGxCyaeNKYZC0sqk3xXGiXd4qtosLHsw.ttf',
		label: 'Hebrew'
	},
	NotoSans: {
		url: 'https://fonts.gstatic.com/s/notosans/v36/o-0bIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjc5aPdu2ui.ttf',
		label: 'Latin/Cyrillic/Greek'
	},
	builtin: {
		url: null,
		label: 'Latin-only (Helvetica, no download)'
	}
};

// Cache font selection results per translation description
const selectionCache = new Map<string, FontSelection>();

// Cache font binary data per font ID
const fontDataCache = new Map<string, ArrayBuffer>();

/**
 * Use the LLM to select the best font for a given translation description.
 * Falls back to 'builtin' on any error.
 */
export async function selectFontForLanguage(
	translationDescription: string,
	apiKey: string,
	model: string = 'gpt-5.4-mini'
): Promise<FontSelection> {
	// Check cache first
	const cached = selectionCache.get(translationDescription);
	if (cached) return cached;

	const fontList = Object.entries(AVAILABLE_FONTS)
		.map(([id, config]) => `"${id}" (${config.label})`)
		.join(', ');

	try {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model,
				response_format: { type: 'json_object' },
				messages: [
					{
						role: 'system',
						content:
							'You select fonts for PDF rendering. Given the user\'s translation description, pick the best font from the available options. Respond with JSON: {"font": "<fontId>", "reason": "<brief reason>"}'
					},
					{
						role: 'user',
						content: `Translation description: "${translationDescription}"\nAvailable fonts: [${fontList}]`
					}
				]
			})
		});

		if (!response.ok) {
			return fallback(translationDescription);
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content;
		if (!content) return fallback(translationDescription);

		const parsed = JSON.parse(content);
		const fontId = parsed.font;

		// Validate font ID exists
		if (!fontId || !(fontId in AVAILABLE_FONTS)) {
			return fallback(translationDescription);
		}

		const result: FontSelection = { font: fontId, reason: parsed.reason || '' };
		selectionCache.set(translationDescription, result);
		return result;
	} catch {
		return fallback(translationDescription);
	}
}

function fallback(description: string): FontSelection {
	const result: FontSelection = { font: 'builtin', reason: 'Fallback to built-in font' };
	selectionCache.set(description, result);
	return result;
}

/**
 * Fetch font binary data from Google Fonts CDN.
 * Returns null for 'builtin' font or on error.
 * Caches results in memory.
 */
export async function getFontData(fontId: string): Promise<ArrayBuffer | null> {
	if (fontId === 'builtin') return null;

	const cached = fontDataCache.get(fontId);
	if (cached) return cached;

	const config = AVAILABLE_FONTS[fontId];
	if (!config?.url) return null;

	try {
		const response = await fetch(config.url);
		if (!response.ok) return null;

		const data = await response.arrayBuffer();
		fontDataCache.set(fontId, data);
		return data;
	} catch {
		return null;
	}
}

/**
 * Clear caches (useful for testing).
 */
export function clearFontCaches(): void {
	selectionCache.clear();
	fontDataCache.clear();
}
