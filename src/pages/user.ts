import * as beatsaver from "../api/beatsaver";
import { BMButton, BMButtonHelp, bmvar, get_wide_table, is_user_page, Pages } from "../env";
import g from "../global";
import { as_fragment, create, into } from "../util/dom";
import { check } from "../util/err";
import { number_invariant } from "../util/format";
import { calculate_max_score, get_notes_count, get_song_hash_from_text, parse_score_bottom } from "../util/song";
import QuickButton from "../components/QuickButton.svelte";

const PAGE: Pages = "user";

export function setup_dl_link_user_site(): void {
	if (!is_user_page()) { return; }

	// find the table we want to modify
	const table = check(document.querySelector(".ranking.songs"));

	// add a new column for our links
    /*
	const table_tr = check(table.querySelector(".table-item"));
	for (const btn of BMButton) {
		into(table_tr,
			create("div", {
				class: "compact svelte-hij8c", // TODO: might not be static
				style: bmvar(PAGE, btn, "table-cell"),
				// TODO: Tooltip is currently cut off at the to due to div nesting
				//data: { tooltip: BMButtonHelp[btn].long },
			}, BMButtonHelp[btn].short)
		);
	}
    * */

	// add a link for each song
	const table_row = table.querySelectorAll(".table-item");
	for (const row of table_row) {
		const image_link = check(row.querySelector<HTMLImageElement>(".song-container img")).src;
		const song_hash = get_song_hash_from_text(image_link);
		
		const col = create("div", {
			class: "svelte-hij8c"
		});
		into(row, col);
		
		for (const btn of BMButton) {
			into(col,
				create("span", { class: "compact", style: bmvar(PAGE, btn, "table-cell") },
					as_fragment(target => new QuickButton({
						target,
						props: { song_hash, size: "medium", type: btn }
					}))
				)
			);
		}
	}
}

// ** Wide table ***

export function update_wide_table_css(): void {
	if (!is_user_page()) { return; }

	const table = check(document.querySelector(".ranking.songs"));
	table.classList.toggle("wide_song_table", get_wide_table());
}

// ** Link util **

export function add_percentage(): void {
	// TODO
	return;
	if (!is_user_page()) { return; }

	// find the table we want to modify
	const table = check(document.querySelector("table.ranking.songs"));
	const table_row = table.querySelectorAll("tbody tr");
	for (const row of table_row) {
		const image_link = check(row.querySelector<HTMLImageElement>("th.song img")).src;
		const song_hash = get_song_hash_from_text(image_link);

		if (!song_hash) {
			return;
		}

		const score_column = check(row.querySelector(`th.score`));
		// skip rows with percentage from ScoreSaber
		if (!score_column.innerText || score_column.innerText.includes("%")) { continue; }

		(async () => {
			const data = await beatsaver.get_data_by_hash(song_hash);
			if (!data)
				return;
			const song_column = check(row.querySelector(`th.song`));
			const diff_name = check(song_column.querySelector(`span > span`)).innerText;
			const version = data.versions.find((v) => v.hash === song_hash.toLowerCase());
			if (!diff_name || !version)
					return;
			const notes = get_notes_count(diff_name, "Standard", version);
			if (notes < 0)
				return;
			const max_score = calculate_max_score(notes);
			const user_score = check(score_column.querySelector(".scoreBottom")).innerText;
			const { score } = parse_score_bottom(user_score);
			if (score !== undefined) {
				const calculated_percentage = (100 * score / max_score).toFixed(2);
				check(score_column.querySelector(".ppWeightedValue")).innerHTML = `(${calculated_percentage}%)`;
			}
		})();
	}
}
