import { create, into } from "./dom";
import { logc } from "./log";

declare var GM: any;
declare function GM_addStyle(css: string): HTMLStyleElement;
type GM_XHR_Options = Partial<Request> & { onload?: (req: XMLHttpRequest) => any, onerror?: () => any } | { headers: any };
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
declare var GM_info: IInfo;

// tslint:disable: variable-name
export let SSE_addStyle: (css: string) => HTMLStyleElement;
export let SSE_xmlhttpRequest: (info: GM_XHR_Options) => void;
export let SSE_info: IInfo;

export function setup() {
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
