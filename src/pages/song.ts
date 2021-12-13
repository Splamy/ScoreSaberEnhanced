import * as beastsaber from "../api/beastsaber";
import * as beatsaver from "../api/beatsaver";
import * as scoresaber from "../api/scoresaber";
import { IDbUser, ISong } from "../declarations/Types";
import { BMButton, get_home_user, is_song_leaderboard_page, Pages } from "../env";
import g from "../global";
import { create, into, intor } from "../util/dom";
import { check } from "../util/err";
import { format_en, number_invariant, number_to_timespan, toggled_class } from "../util/format";
import { Lazy } from "../util/lazy";
import { calculate_max_score, get_notes_count, get_song_compare_value, get_song_hash_from_text } from "../util/song";
import QuickButton from "../components/QuickButton.svelte";
import { new_page } from "../util/net";

const PAGE: Pages = "song";

class shared {
	public static _current_page;
	public static song_hash;
	public static details_box;
	public static diff_name;
	public static game_mode;
	
	private static _leaderboard_info ={};
	
	static async get() {
		if (this._current_page === window.location.pathname) {
			// I hate javascript so much
			const song_hash = this.song_hash, details_box = this.details_box, diff_name = this.diff_name, game_mode = this.game_mode;
			return { song_hash, details_box, diff_name, game_mode };
		}
		
		// find the element we want to modify
		this.details_box = check(document.querySelector(".title.is-5").parentElement.parentElement.parentElement);
		
		const id = window.location.pathname.split('/').pop();
		
		if (this._leaderboard_info[id] === undefined) {
			console.log(`Refresh, ${this._current_href} !== ${window.location.href} ${this.song_hash}`);
			this._leaderboard_info[id] = scoresaber.get_leaderboard_info(id);
		}
		
		const leaderboard_info = await this._leaderboard_info[id];

		this.song_hash = leaderboard_info.songHash.toLowerCase();
		this.diff_name = leaderboard_info.difficulty.difficultyRaw.split("_")[1];
		this.game_mode = leaderboard_info.difficulty.gameMode.replace("Solo","");
		
		this._current_page = window.location.pathname;
		
		const song_hash = this.song_hash, details_box = this.details_box, diff_name = this.diff_name, game_mode = this.game_mode;
		return { song_hash, details_box, diff_name, game_mode };
	}
}

export function setup_song_filter_tabs(): void {
	if (!is_song_leaderboard_page()) { return; }

	const tab_list_content = check(document.querySelector(".tabs > ul"));

	function load_friends() {
		let score_table = check(document.querySelector(".ranking .global > tbody"));
		g.song_table_backup = score_table;
		const table = check(score_table.parentNode);
		table.removeChild(score_table);
		score_table = table.appendChild(create("tbody"));
		const song_id = g.leaderboard_reg.exec(window.location.pathname)![1];

		const elements: [ISong, HTMLElement][] = [];
		for (const [user_id, user] of Object.entries(g.user_list)) {
			const song = user.songs[song_id];
			// Check if the user has a score on this song
			if (!song)
				continue;
			elements.push([song, generate_song_table_row(user_id, user, song)]);
		}
		elements.sort((a, b) => { const [sa, sb] = get_song_compare_value(a[0], b[0]); return sb - sa; });
		elements.forEach(x => score_table.appendChild(x[1]));
	}

	function load_all() {
		if (!g.song_table_backup) {
			return;
		}

		let score_table = check(document.querySelector(".ranking .global > tbody"));
		const table = check(score_table.parentNode);
		table.removeChild(score_table);
		score_table = table.appendChild(g.song_table_backup);
		g.song_table_backup = undefined;
	}

	tab_list_content.appendChild(generate_tab("All Scores", "all_scores_tab", load_all, true, true));
	tab_list_content.appendChild(generate_tab("Friends", "friends_tab", load_friends, false, false));
	// tab_list_content.appendChild(generate_tab("Around Me", "around_me_tab", () => {}, false, false));
}

export async function setup_dl_link_leaderboard(): void {
	if (!is_song_leaderboard_page()) { return; }

	const { song_hash, details_box } = await shared.get();

	const tool_strip = create("div", {
		id: "leaderboard_tool_strip",
		style: {
			marginTop: "1em"
		}
	});
	for (const btn of BMButton) {
		new QuickButton({
			target: tool_strip,
			props: { song_hash, size: "large", type: btn, page: PAGE }
		});
	}
	details_box.appendChild(tool_strip);

	const song_warning = create("div");
	details_box.appendChild(song_warning);

	const box_style = { class: "box", style: { display: "flex", flexDirection: "column", alignItems: "end", padding: "0.5em 1em" } };
	const beatsaver_box = create("div", box_style,
		create("b", {}, "BeatSaver"),
		create("span", { class: "icon" }, create("i", { class: "fas fa-spinner fa-pulse" }))
	);
	const beastsaber_box = create("div", box_style,
		create("b", {}, "BeastSaber"),
		create("span", { class: "icon" }, create("i", { class: "fas fa-spinner fa-pulse" }))
	);

	const column_style = { class: "column", style: { padding: "0 0.75em" } };
	details_box.appendChild(
		create("div", {
			class: "columns",
			style: {
				marginTop: "1em"
			}
		},
			create("div", column_style, beatsaver_box),
			create("div", column_style, beastsaber_box),
		));

	if (!song_hash)
		return;

	(async () => {
		const data = await beatsaver.get_data_by_hash(song_hash);
		if (!data)
			return;
		show_song_warning(song_warning, song_hash, data);
		show_beatsaver_song_data(beatsaver_box, data);
		const data2 = await beastsaber.get_data(data.id);
		if (!data2)
			return;
		show_beastsaber_song_data(beastsaber_box, data2);
	})();
}

async function show_song_warning(elem: HTMLElement, song_hash: string, data: beatsaver.IBeatSaverData) {
	const contains_version = data.versions.some(x => x.hash === song_hash);
	if (!contains_version) {
		const new_song_hash = data.versions[data.versions.length - 1].hash;
		const { diff_name } = await shared.get();

		intor(elem,
			create("div", {
				style: { marginTop: "1em", cursor: "pointer" },
				class: "notification is-warning",
				onclick: async () => {
					const bs2ss = await scoresaber.get_scoresaber_data_by_hash(new_song_hash, diff_name);
					if (bs2ss === undefined)
						return;
					new_page(`https://scoresaber.com/leaderboard/${bs2ss.uid}`);
				},
			},
				create("i", { class: "fas fa-exclamation-triangle" }),
				create("span", { style: { marginLeft: "0.25em" } }, "A newer version of this song exists on BeatSaver")
			)
		);
	}
}

function show_beatsaver_song_data(elem: HTMLElement, data: beatsaver.IBeatSaverData) {
	intor(elem,
		create("div", { title: "Downloads" }, `${data.stats.downloads} 💾`),
		create("div", { title: "Upvotes" }, `${data.stats.upvotes} 👍`),
		create("div", { title: "Downvotes" }, `${data.stats.downvotes} 👎`),
		create("div", { title: "Beatmap Rating" }, `${(data.stats.score * 100).toFixed(2)}% 💯`),
		create("div", { title: "Beatmap Duration" }, `${number_to_timespan(data.metadata.duration)} ⏱`),
	);
}

function show_beastsaber_song_data(elem: HTMLElement, data: beastsaber.IBeastSaberData) {
	intor(elem,
		create("div", { title: "Fun Factor" }, `${data.average_ratings.fun_factor} 😃`),
		create("div", { title: "Rhythm" }, `${data.average_ratings.rhythm} 🎶`),
		create("div", { title: "Flow" }, `${data.average_ratings.flow} 🌊`),
		create("div", { title: "Pattern Quality" }, `${data.average_ratings.pattern_quality} 💠`),
		create("div", { title: "Readability" }, `${data.average_ratings.readability} 👓`),
		create("div", { title: "Level Quality" }, `${data.average_ratings.level_quality} ✔️`),
	);
}

function generate_song_table_row(user_id: string, user: IDbUser, song: ISong): HTMLElement {
	return create("tr", {}, // style: { backgroundColor: ":var(--color-highlight);" }
		create("td", { class: "picture" }),
		create("td", { class: "rank" }, "-"),
		create("td", { class: "player" }, generate_song_table_player(user_id, user)),
		create("td", { class: "score" }, song.score !== undefined ? format_en(song.score, 0) : "-"),
		create("td", { class: "timeset" }, moment(song.time).fromNow()),
		create("td", { class: "mods" }, song.mods !== undefined ? song.mods.toString() : "-"),
		create("td", { class: "percentage" }, song.accuracy ? (song.accuracy.toString() + "%") : "-"),
		create("td", { class: "pp" },
			create("span", { class: "scoreTop ppValue" }, format_en(song.pp)),
			create("span", { class: "scoreTop ppLabel" }, "pp")
		)
	);
}

function generate_song_table_player(user_id: string, user: IDbUser): HTMLElement {
	return create("a", { href: `${g.scoresaber_link}/u/${user_id}` }, user.name);
}

function generate_tab(
	title: string | HTMLElement,
	css_id: string,
	action: (() => void) | undefined,
	is_active: boolean,
	has_offset: boolean
): HTMLElement {
	const tabClass = `filter_tab ${toggled_class(is_active, "is-active")} ${toggled_class(has_offset, "offset_tab")}`;
	return create("li", {
		id: css_id,
		class: tabClass,
	},
		create("a", {
			class: "has-text-info",
			onclick: () => {
				document.querySelectorAll(".tabs > ul .filter_tab").forEach(x => x.classList.remove("is-active"));
				check(document.getElementById(css_id)).classList.add("is-active");
				if (action) action();
			}
		}, title)
	);
}

// TODO not quite correct here, should be somewhere for general leaderboards

export function highlight_user(): void {
	// (No page check, this should work on global and song boards)
	const home_user = get_home_user();
	if (!home_user) { return; }

	const element = document.querySelector(`table.ranking.global a[href='/u/${home_user.id}']`);

	if (element != null) {
		element.parentElement!.parentElement!.style.backgroundColor = "var(--color-highlight)";
	}
}

// Add column for percentage if it doesn't exist
export async function prepare_table(table: HTMLElement): void {
	const header = table.querySelector(".header");
	
	for (const heading of header.children) {
		if (heading.innerText === "Percentage") {
			return;
		}
	}
	const columns = header.children.length;
	
	table.style.setProperty("--columns", `1fr 5fr repeat(${columns - 1}, 2fr)`);
	into(header, create(
		"div",
		{"class": `centered ${table.classList[1]}`},
		"Percentage"
	));
}

export async function add_percentage(row: HTMLElement): void {
	if (!is_song_leaderboard_page()) {
		return;
	}

	if (row.children.length === 6) {
		return;
	}

	const { song_hash, diff_name, game_mode } = await shared.get();

	if (!song_hash) {
		return;
	}

	const data = await beatsaver.get_data_by_hash(song_hash);
	if (!data)
		return;
	// Scoresaber fails to display the difficlulty tab for some categories (e.g. Lawless), ex:
	// - none at all: https://scoresaber.com/leaderboard/307121
	// - only expert+ shown, but actual diff is missing: https://scoresaber.com/leaderboard/314128
	if (!diff_name)
		return;
	const version = data.versions.find((v) => v.hash === song_hash.toLowerCase());
	if (!diff_name || !version)
		return;
	const notes = get_notes_count(diff_name, game_mode, version);
	if (notes < 0)
		return;
	const max_score = calculate_max_score(notes);
	const score = check(row.querySelector(".score")).innerText;
	const score_num = number_invariant(score);
	const calculated_percentage = (100 * score_num / max_score).toFixed(2);
	into(row, create(
		"div",
		{"class" : `accuracy centered ${row.classList[1]}`},
		`${calculated_percentage}%`
	));
}
