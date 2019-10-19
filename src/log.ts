import g from "./global";

export function setup(): void {
    g.debug = localStorage.getItem("debug") === "true";
}

export function logc(message: any, ...optionalParams: any[]): void {
    if (g.debug) {
        console.log(message, ...optionalParams);
    }
}
