declare function GM_addStyle(css: string) : HTMLStyleElement;
declare function GM_xmlhttpRequest(info: RequestInfo | { onload: (req: XMLHttpRequest) => any }) : void;
declare function swal(text: string, options: {}) : Promise<{}>;
declare function oneClick(elem: Element, songId: string) : Promise<void>;