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

// Vercel rejects a serverless request body over 4.5 MB before Express ever runs,
// and its raw reply ("FUNCTION_PAYLOAD_TOO_LARGE" plus a request id) means
// nothing to a seller. Say what went wrong and what to do about it.
function describeFailure(status, body) {
	if (status === 413) {
		return 'Those photos are too large to analyse together. Try a single, smaller photo of the front.';
	}
	return `Request failed (${status}): ${body}`;
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
			throw new Error(describeFailure(response.status, errorBody));
		}

		return response.json();
	},

	// `baseUrl` points a call at a dedicated function (e.g. '/grade-estimate',
	// its own 300 s budget) instead of the shared /hcgi/api one.
	stream: async (path, { body, signal, images, baseUrl = API_SERVER_URL } = {}) => {
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

		const response = await window.fetch(baseUrl + path, {
			method: 'POST',
			headers,
			body: formData,
			signal,
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(describeFailure(response.status, errorBody));
		}

		if (!response.body) {
			throw new Error('No response body');
		}

		return response;
	},
};

export default integratedAiClient;

export { integratedAiClient };
