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

	const users_data_ver = get_data_ver();
	if (users_data_ver !== CURRENT_DATA_VER) {
		logc("Updating usercache format");

		if (users_data_ver <= 0) {
			for (const user_id of Object.keys(g.user_list)) {
				const user = g.user_list[user_id];
				for (const song_id of Object.keys(user.songs)) {
					const song = user.songs[song_id];

					const time = read_inline_date(song.time);
					song.time = time.toISOString();
				}
			}
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
