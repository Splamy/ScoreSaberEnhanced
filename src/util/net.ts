import { SSE_xmlhttpRequest } from "./userscript";

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
		SSE_xmlhttpRequest(request_param);
	});
}

function get_hostname(url: string): string | undefined {
	const match = url.match(/:\/\/([^/:]+)/i);
	if (match !== null) {
		return match[1];
	} else {
		return undefined;
	}
}

export function new_page(link: string): void {
	window.open(link, "_blank");
}
