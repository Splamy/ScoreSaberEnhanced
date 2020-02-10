import * as beastsaber from "../api/beastsaber";
import * as beatsaver from "../api/beatsaver";
import * as buttons from "../components/buttons";
import { IDbUser, ISong } from "../declarations/Types";
import { get_home_user, is_song_leaderboard_page } from "../env";
import g from "../global";
import { create, into } from "../util/dom";
import { check } from "../util/err";
import { format_en, toggled_class } from "../util/format";
import { get_song_compare_value, get_song_hash_from_text } from "../util/song";

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
		for (const user_id in g.user_list) {
			const user = g.user_list[user_id];
			const song = user.songs[song_id];
			// Check if the user has a score on this song
			if (!song)
				continue;
			elements.push([song, generate_song_table_row(user_id, user, song_id)]);
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

export function setup_dl_link_leaderboard(): void {
	if (!is_song_leaderboard_page()) { return; }

	// find the element we want to modify
	let details_box = check(document.querySelector(".content .title.is-5"));
	details_box = check(details_box.parentElement);

	const song_hash = get_song_hash_from_text(details_box.innerHTML);

	details_box.appendChild(
		create("div", {
			id: "leaderboard_tool_strip",
			style: {
				marginTop: "1em"
			}
		},
			buttons.generate_bsaber(song_hash),
			buttons.generate_beatsaver(song_hash, "large"),
			buttons.generate_oneclick(song_hash, "large")
		));

	const beatsaver_box = create("div", { class: "box" });
	const beastsaber_box = create("div", { class: "box" });

	details_box.appendChild(
		create("div", {
			class: "columns",
			style: {
				marginTop: "1em"
			}
		},
			create("div", { class: "column" }, create("b", {}, "BeatSaver"), beatsaver_box),
			create("div", { class: "column" }, create("b", {}, "BeastSaber"), beastsaber_box),
		));

	if (!song_hash)
		return;

	beatsaver.get_data_by_hash(song_hash)
		.then(data => {
			if (data) {
				show_beatsaver_song_data(beatsaver_box, data);
				beastsaber.get_data(data.key)
					.then(data2 => {
						if (data2) {
							show_beastsaber_song_data(beastsaber_box, data2);
						}
					});
			}
		});
}

function show_beatsaver_song_data(elem: HTMLElement, data: beatsaver.IBeatSaverData) {
	into(elem,
		create("div", { title: "Downloads" }, `💾 ${data.stats.downloads}`),
		create("div", { title: "Upvotes" }, `👍 ${data.stats.upVotes}`),
		create("div", { title: "Downvotes" }, `👎 ${data.stats.downVotes}`),
		create("div", { title: "Beatmap Rating" }, `💯 ${(data.stats.rating * 100).toFixed(2)}%`),
		create("div", { title: "Heat (Popularity)" }, `🔥 ${data.stats.heat.toFixed(2)}`),
	);
}

function show_beastsaber_song_data(elem: HTMLElement, data: beastsaber.IBeastSaberData) {
	into(elem,
		create("div", { title: "Fun Factor" }, `😃 ${data.average_ratings.fun_factor}`),
		create("div", { title: "Rhythm" }, `🎶 ${data.average_ratings.rhythm}`),
		create("div", { title: "Flow" }, `🌊 ${data.average_ratings.flow}`),
		create("div", { title: "Pattern Quality" }, `💠 ${data.average_ratings.pattern_quality}`),
		create("div", { title: "Readability" }, `👓 ${data.average_ratings.readability}`),
		create("div", { title: "Level Quality" }, `✔️ ${data.average_ratings.level_quality}`),
	);
}

function generate_song_table_row(user_id: string, user: IDbUser, song_id: string): HTMLElement {
	const song = user.songs[song_id];
	return create("tr", {}, // style: { backgroundColor: ":var(--color-highlight);" }
		create("td", { class: "picture" }),
		create("td", { class: "rank" }, "-"),
		create("td", { class: "player" }, generate_song_table_player(user_id, user)),
		create("td", { class: "score" }, song.score ? format_en(song.score, 0) : "-"),
		create("td", { class: "timeset" }, timeago.format(song.time)),
		create("td", { class: "mods" }, song.mods ? song.mods.toString() : "-"),
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
	action: (() => any) | undefined,
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
