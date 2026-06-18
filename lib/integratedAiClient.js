const API_SERVER_URL = '/hcgi/api';

async function getSupabaseToken() {
	try {
		const { supabase } = await import('@/lib/supabaseClient.js');
		const { data } = await supabase.auth.getSession();
		return data?.session?.access_token ?? null;
	} catch {
		return null;
	}
}

const integratedAiClient = {
	fetch: async (path, options = {}) => {
		const token = await getSupabaseToken();

		const response = await window.fetch(API_SERVER_URL + path, {
			...options,
			headers: {
				...options.headers,
				...(token && { Authorization: `Bearer ${token}` }),
			},
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`Request failed (${response.status}): ${errorBody}`);
		}

		return response.json();
	},

	stream: async (path, { body, signal, images } = {}) => {
		const token = await getSupabaseToken();

		const headers = {
			Accept: 'text/event-stream',
			...(token && { Authorization: `Bearer ${token}` }),
		};

		const formData = new FormData();
		formData.append('message', JSON.stringify(body?.message ?? []));

		(images ?? []).forEach((image) => {
			formData.append('images', image);
		});

		const response = await window.fetch(API_SERVER_URL + path, {
			method: 'POST',
			headers,
			body: formData,
			signal,
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`Request failed (${response.status}): ${errorBody}`);
		}

		if (!response.body) {
			throw new Error('No response body');
		}

		return response;
	},
};

export default integratedAiClient;

export { integratedAiClient };
