import g from "../global";

export function setup(): void {
	g.debug = localStorage.getItem("debug") === "true";
}

/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */
export function logc(message: any, ...optionalParams: any[]): void {
	if (g.debug) {
		console.log("DBG", message, ...optionalParams);
	}
}
