export function fetch2(url: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const host = get_hostname(url);
		const request_param = {
			method: "GET",
			url: url,
			headers: { Origin: host },
			onload: (req: XMLHttpRequest) => {
				if (req.status >= 200 && req.status < 300) {
					resolve(req.responseText);
				} else {
					reject(`request errored: ${url} (${req.status})`);
				}
			},
			onerror: () => {
				reject(`request errored: ${url}`);
			}
		};
		GM_xmlhttpRequest(request_param);
	});
}

export function get_hostname(url: string): string | undefined {
	const match = url.match(/:\/\/([^/:]+)/i);
	if (match && match.length > 1 && typeof match[1] === "string" && match[1].length > 0) {
		return match[1];
	} else {
		return undefined;
	}
}
