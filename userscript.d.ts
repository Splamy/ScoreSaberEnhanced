declare function GM_addStyle(css: string) : HTMLStyleElement;
declare function GM_xmlhttpRequest(info: RequestInfo | { onload: (req: XMLHttpRequest) => any }) : void;
declare var GM_info : {
    /** An object containing data about the currently running script. */
    script: {
        /** Version. Possibly empty string. */
        version?: string,
        // ...
    },
    /** A string, the entire literal Metadata Block (without the delimiters) for the currently running script. */
    scriptMetaStr: string,
    /** The name of the user script engine handling this script's execution. E.g. `Greasemonkey`. */
    scriptHandler: string,
    /** The version of Greasemonkey, a string e.g. `4.0`. */
    version: string,
};
declare function oneClick(elem: Element, songId: string) : Promise<void>;

type SwalIconType = "info" | "success" | "warning" | "error";
interface SwalOptions {
	readonly title?: string;
	readonly text?: string;
	readonly icon?: SwalIconType;
	readonly button?: SwalButton;
	readonly buttons?: boolean | SwalButton[] | { [button: string]: SwalButton; };
	readonly dangerMode?: boolean;
	readonly content?: "input";
	readonly showCancelButton?: boolean;
	readonly showConfirmButton?: boolean;
}
interface SwalButtonOptions {
	readonly text?: string;
	readonly value?: string;
	readonly closeModal?: boolean;
}
type SwalButton = boolean | string | SwalButtonOptions;
type SwalReturn = null | string;

declare function swal(options: SwalOptions): Promise<SwalReturn>;
declare function swal(text: string, options?: SwalOptions): Promise<SwalReturn>;
declare function swal(title: string, text: string): Promise<SwalReturn>;
declare function swal(title: string, text: string, icon: SwalIconType, options?: SwalOptions): Promise<SwalReturn>;
declare module swal {
	function stopLoading(): void;
	function close(): void;
	function setActionValue(text: string): void;
}

interface ParentNode {
	querySelector<E extends HTMLElement = HTMLElement>(selectors: string): E | null;
	querySelectorAll<E extends HTMLElement = HTMLElement>(selectors: string): NodeListOf<E>;
}