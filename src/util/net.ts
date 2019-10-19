export function fetch2(url: string): Promise<string> {
    return new Promise(function (resolve, reject) {
        let host = getHostName(url);
        let request_param = {
            method: "GET",
            url: url,
            headers: { "Origin": host },
            onload: (req: XMLHttpRequest) => {
                if (req.status >= 200 && req.status < 300) {
                    resolve(req.responseText);
                } else {
                    reject();
                }
            },
            onerror: () => {
                reject();
            }
        };
        GM_xmlhttpRequest(request_param);
    });
}

export function getHostName(url: string): string | undefined {
    var match = url.match(/:\/\/([^/:]+)/i);
    if (match && match.length > 1 && typeof match[1] === "string" && match[1].length > 0) {
        return match[1];
    } else {
        return undefined;
    }
}