import { create, into } from "./dom";
import { logc } from "./log";

declare const GM: any;
declare function GM_addStyle(css: string): HTMLStyleElement;
type GM_XHR_Options = Partial<Request> & { onload?: (req: XMLHttpRequest) => void, onerror?: () => void } | { headers: any };
declare function GM_xmlhttpRequest(info: GM_XHR_Options): void;
interface IInfo {
	/** An object containing data about the currently running script. */
	script: {
		/** Version. Possibly empty string. */
		version?: string,
		// ...
	};
	/** A string, the entire literal Metadata Block (without the delimiters) for the currently running script. */
	scriptMetaStr: string;
	/** The name of the user script engine handling this script's execution. E.g. `Greasemonkey`. */
	scriptHandler: string;
	/** The version of Greasemonkey, a string e.g. `4.0`. */
	version: string;
}
declare const GM_info: IInfo;

export let SSE_addStyle: (css: string) => HTMLStyleElement;
export let SSE_xmlhttpRequest: (info: GM_XHR_Options) => void;
export let SSE_info: IInfo;

export function setup(): void {
	if (typeof (GM) !== "undefined") {
		logc("Using GM.* extenstions", GM);
		SSE_addStyle = GM_addStyle_custom;
		SSE_xmlhttpRequest = GM.xmlHttpRequest;
		SSE_info = GM.info;
	} else {
		logc("Using GM_ extenstions");
		SSE_addStyle = GM_addStyle;
		SSE_xmlhttpRequest = GM_xmlhttpRequest;
		SSE_info = GM_info;
	}
}

function GM_addStyle_custom(css: string): HTMLStyleElement {
	const style = create("style");
	style.innerHTML = css;
	into(document.head, style);
	return style;
}

export async function load_chart_lib(): Promise<boolean> {
	if (typeof Chart !== "function") {
		try {
			const resp = await fetch("https://old.scoresaber.com/imports/js/chart.js");
			const js = await resp.text();
			new Function(js)();
		} catch (err) {
			console.warn("Failed to fetch chartjs. Charts might not work", err);
			return false;
		}
	}
	return true;
}
