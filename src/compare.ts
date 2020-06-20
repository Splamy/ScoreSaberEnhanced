import * as scoresaber from "./api/scoresaber";
import SseEvent from "./components/events";
import { IDbUser } from "./declarations/Types";
import { get_compare_user, get_current_user, get_use_new_ss_api, get_user_header, insert_compare_feature, is_user_page, set_compare_user } from "./env";
import g from "./global";
import * as usercache from "./usercache";
import { create, into, IntoElem, intor } from "./util/dom";
import { check } from "./util/err";
import { format_en } from "./util/format";
import { logc } from "./util/log";
import { get_song_compare_value, song_equals } from "./util/song";

export function setup_user_compare(): void {
	if (!is_user_page()) { return; }

	// find the element we want to modify

	const header = get_user_header();
	header.style.display = "flex";
	header.style.alignItems = "center";

	const user = get_current_user();
	into(header,
		create("div", {
			class: "button icon is-medium",
			style: { cursor: "pointer" },
			data: { tooltip: g.user_list[user.id] ? "Update score cache" : "Add user to your score cache" },
			async onclick() {
				await fetch_user(get_current_user().id);
			},
		},
			create("i", { class: ["fas", g.user_list[user.id] ? "fa-sync" : "fa-bookmark"] }),
		)
	);

	const status_elem = create("div");
	into(header, status_elem);
	SseEvent.StatusInfo.register((status) => intor(status_elem, status.text));

	g.users_elem = create("div");
	insert_compare_feature(g.users_elem);

	update_user_compare_dropdown();

	SseEvent.UserCacheChanged.register(update_user_compare_dropdown);
	SseEvent.UserCacheChanged.register(update_user_compare_songtable);
	SseEvent.CompareUserChanged.register(update_user_compare_songtable);

	SseEvent.CompareUserChanged.invoke();
}

export function update_user_compare_dropdown(): void {
	if (!is_user_page()) { return; }

	const compare = get_compare_user();
	intor(g.users_elem,
		create("div", { class: "select" },
			create("select", {
				id: "user_compare",
				onchange() {
					const user = (this as HTMLSelectElement).value; // TOOO convert to IUser
					set_compare_user(user);
					SseEvent.CompareUserChanged.invoke();
				}
			}, ...Object.keys(g.user_list).map(id => {
				const user = g.user_list[id];
				return create("option", { value: id, selected: id === compare }, user.name);
			}))
		)
	);
}

export function update_user_compare_songtable(other_user?: string): void {
	if (!is_user_page()) { return; }

	if (other_user === undefined) {
		other_user = get_compare_user();
		if (other_user === undefined) {
			return; // TODO maybe clean up list ?
		}
	}

	const other_data = g.user_list[other_user];
	if (!other_data) {
		logc("Other user not found: ", other_user); // Try update?
		return;
	}

	const table = check(document.querySelector("table.ranking.songs"));

	// Reload table data
	table.querySelectorAll(".comparisonScore").forEach(el => el.remove());

	const ranking_table_header = check(table.querySelector("thead > tr"));
	check(ranking_table_header.querySelector(".score")).insertAdjacentElement("afterend", create("th", { class: "comparisonScore" }, other_data.name));

	// Update table
	const table_row = table.querySelectorAll("tbody tr");
	for (const row of table_row) {
		// reset style
		row.style.backgroundImage = "unset";

		const [song_id, song] = scoresaber.get_row_data(row);
		const other_song = other_data.songs[song_id];

		// add score column
		let other_score_content: IntoElem[];
		if (other_song) {
			other_score_content = [
				create("span", { class: "scoreTop ppValue" }, format_en(other_song.pp)),
				create("span", { class: "scoreTop ppLabel" }, "pp"),
				create("br"),
				(() => {
					let str;
					if (other_song.accuracy) {
						str = `accuracy: ${format_en(other_song.accuracy)}%`;
					} else if (other_song.score) {
						str = `score: ${format_en(other_song.score)}`;
					} else {
						return "<No Data>";
					}
					if (other_song.mods) {
						str += ` (${other_song.mods.join(",")})`;
					}
					return create("span", { class: "scoreBottom" }, str);
				})()
				// create("span", { class: "songBottom time" }, other_song.time) // TODO: Date formatting
			];
		} else {
			other_score_content = [create("hr", {})];
		}
		check(row.querySelector(".score")).insertAdjacentElement("afterend", create("th", { class: "comparisonScore" }, ...other_score_content));

		if (!other_song) {
			logc("No match");
			continue;
		}

		const [value1, value2] = get_song_compare_value(song, other_song);
		if (value1 === 0 && value2 === 0) {
			logc("No score");
			continue;
		}

		let value = (Math.min(value1, value2) / Math.max(value1, value2)) * 100;
		const better = value1 > value2;
		if (better) {
			value = 100 - value;
		}

		if (better) {
			row.style.backgroundImage = `linear-gradient(75deg, var(--color-ahead) ${value}%, rgba(0,0,0,0) ${value}%)`;
		} else {
			row.style.backgroundImage = `linear-gradient(105deg, rgba(0,0,0,0) ${value}%, var(--color-behind) ${value}%)`;
		}
	}
}

async function fetch_user(user_id: string, force: boolean = false): Promise<void> {
	let user = g.user_list[user_id];
	if (!user) {
		user = {
			name: "User" + user_id,
			songs: {}
		};
		g.user_list[user_id] = user;
	}

	let page_max = undefined;
	let user_name = user.name;
	let updated = false;

	SseEvent.StatusInfo.invoke({ text: `Fetching user ${user_name}` });

	if (get_use_new_ss_api()) {
		const user_data = await scoresaber.get_user_info_basic(user_id);
		user_name = user_data.playerInfo.playerName;
	}

	for (let page = 1; ; page++) {
		SseEvent.StatusInfo.invoke({ text: `Updating user ${user_name} page ${page}/${(page_max ?? "?")}` });

		const recent_songs = await scoresaber.get_user_recent_songs_dynamic(user_id, page);

		const { has_old_entry, has_updated } = process_user_page(recent_songs.songs, user);
		updated = updated || has_updated;
		page_max = recent_songs.meta.max_pages ?? page_max;
		user_name = recent_songs.meta.user_name ?? user_name;
		if ((!force && has_old_entry) || recent_songs.meta.was_last_page) {
			break;
		}
	}

	// TODO ADD FEATURE BACK
	// process current page to allow force-updating the current site
	// const [, has_updated] = process_user_page(document, user);
	// updated = updated || has_updated;

	user.name = user_name ?? user.name;

	if (updated) {
		usercache.save();
	}

	SseEvent.StatusInfo.invoke({ text: `User ${user_name} updated` });
	SseEvent.UserCacheChanged.invoke();
}

export async function fetch_all(force: boolean = false): Promise<void> {
	const users = Object.keys(g.user_list);
	for (const user of users) {
		await fetch_user(user, force);
	}
	SseEvent.StatusInfo.invoke({ text: `All users updated` });
}

interface IProcessResult {
	has_old_entry: boolean;
	has_updated: boolean;
}

function process_user_page(songs: scoresaber.ISongTuple[], user: IDbUser): IProcessResult {
	let has_old_entry = false;
	let has_updated = false;

	for (const [song_id, song] of songs) {
		const song_old = user.songs[song_id];
		if (!song_old || !song_equals(song_old, song)) {
			logc("Updated: ", song_old, song);
			has_updated = true;
		} else {
			logc("Old found: ", song);
			has_old_entry = true;
		}
		user.songs[song_id] = song;
	}

	return { has_old_entry, has_updated };
}
