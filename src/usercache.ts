import g from "./global";
import { read_inline_date } from "./util/format";
import { logc } from "./util/log";

const CURRENT_DATA_VER: number = 1;

export function load(): void {
	const json = localStorage.getItem("users");
	if (!json) {
		reset_data();
		return;
	}
	try {
		g.user_list = JSON.parse(json);
	} catch (ex) {
		console.error("Failed to read user cache, resetting!");
		reset_data();
		return;
	}

	let users_data_ver = get_data_ver();
	if (users_data_ver !== CURRENT_DATA_VER) {
		logc("Updating usercache format");

		if (users_data_ver <= 0) {
			for (const user of Object.values(g.user_list)) {
				for (const song of Object.values(user.songs)) {
					const time = read_inline_date(song.time);
					song.time = time.toISOString();
				}
			}
			users_data_ver = 1;
		}

		update_data_ver();
		save();
		logc("Update successful");
	}
	logc("Loaded usercache", g.user_list);
}

function reset_data(): void {
	g.user_list = {};
	localStorage.setItem("users", "{}");
	update_data_ver();
}

function get_data_ver(): number {
	return Number(localStorage.getItem("users_data_ver") ?? "0");
}

function update_data_ver(): void {
	localStorage.setItem("users_data_ver", String(CURRENT_DATA_VER));
}

export function save(): void {
	localStorage.setItem("users", JSON.stringify(g.user_list));
}
