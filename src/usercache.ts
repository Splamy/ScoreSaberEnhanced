import g from "./global";
import { logc } from "./util/log";

export function load(): void {
	const json = localStorage.getItem("users");
	if (!json) {
		g.user_list = {};
		return;
	}
	try {
		g.user_list = JSON.parse(json);
	} catch (ex) {
		g.user_list = {};
		localStorage.setItem("users", "{}");
	}
	logc("Loaded usercache", g.user_list);
}

export function save(): void {
	localStorage.setItem("users", JSON.stringify(g.user_list));
}
