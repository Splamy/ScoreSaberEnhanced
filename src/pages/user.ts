import * as beatsaver from "../api/beatsaver";
import SseEvent from "../components/events";
import { BMButton, BMButtonHelp, bmvar, get_current_user, get_user_header, get_wide_table, is_user_page, Pages } from "../env";
import { fetch_user } from "../compare";
import g from "../global";
import { as_fragment, create, into, intor } from "../util/dom";
import { check } from "../util/err";
import { number_invariant } from "../util/format";
import { calculate_max_score, get_notes_count, get_song_hash_from_text, parse_score_bottom } from "../util/song";
import QuickButton from "../components/QuickButton.svelte";

const PAGE: Pages = "user";

export function setup_cache_button(): void {
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
}

export function setup_dl_link_user_site(row: HTMLElement): void {
	if (!is_user_page()) { return; }

	// add a link for each song
	const image_link = check(row.querySelector<HTMLImageElement>(".song-container img")).src;
	const song_hash = get_song_hash_from_text(image_link);
	
	const col = row.querySelector('.scoreInfo > div:last-child');
	
	for (const btn of BMButton) {
		into(col,
			create("span", { class: `stat clickable ${col.classList[0]}`, style: bmvar(PAGE, btn, "table-cell") },
				as_fragment(target => new QuickButton({
					target,
					props: { song_hash, size: "medium", type: btn }
				}))
			)
		);
	}
}

// ** Wide table ***

export function update_wide_table_css(): void {
	if (!is_user_page()) { return; }

	const table = check(document.querySelector(".ranking.songs"));
	table.classList.toggle("wide_song_table", get_wide_table());
}

// ** Link util **

export function add_percentage(row: HTMLElement): void {
	if (!is_user_page()) { return; }

	const image_link = check(row.querySelector<HTMLImageElement>("img.song-image")).src;
	const song_hash = get_song_hash_from_text(image_link);

	if (!song_hash) {
		return;
	}

	const score_column = row.querySelector(".stat.acc");
	// skip rows with percentage from ScoreSaber
	if (score_column) { return; }

	(async () => {
		const data = await beatsaver.get_data_by_hash(song_hash);
		if (!data)
			return;
		const diff_name = check(row.querySelector(".tag")).title; // Other languages?
		const version = data.versions.find((v) => v.hash === song_hash.toLowerCase());
		if (!diff_name || !version)
				return;
		const notes = get_notes_count(diff_name, "Standard", version);
		if (notes < 0)
			return;
		const max_score = calculate_max_score(notes);
		const user_score = check(row.querySelector(".scoreInfo > div:last-of-type > .stat")).innerText;
		const { score } = parse_score_bottom(user_score);
		if (score !== undefined) {
			const calculated_percentage = (100 * score / max_score).toFixed(2);
			const score_row = row.querySelector(".scoreInfo > div:last-of-type");
			score_row.insertBefore(
				create("span", {"class": `stat acc ${score_row.classList[0]}`}, `${calculated_percentage}%`),
				score_row.children[0]
			);
			//check(score_column.querySelector(".ppWeightedValue")).innerHTML = `(${calculated_percentage}%)`;
		}
	})();
}
