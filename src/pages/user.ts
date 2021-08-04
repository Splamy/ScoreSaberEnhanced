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
	const table = check(document.querySelector("table.ranking.songs"));

	// add a new column for our links
	const table_tr = check(table.querySelector("thead tr"));
	for (const btn of BMButton) {
		into(table_tr,
			create("th", {
				class: "compact",
				style: bmvar(PAGE, btn, "table-cell"),
				// TODO: Tooltip is currently cut off at the to due to div nesting
				//data: { tooltip: BMButtonHelp[btn].long },
			}, BMButtonHelp[btn].short)
		);
	}

	// add a link for each song
	const table_row = table.querySelectorAll("tbody tr");
	for (const row of table_row) {
		const image_link = check(row.querySelector<HTMLImageElement>("th.song img")).src;
		const song_hash = get_song_hash_from_text(image_link);

		for (const btn of BMButton) {
			into(row,
				create("th", { class: "compact", style: bmvar(PAGE, btn, "table-cell") },
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

export function setup_wide_table_checkbox(): void {
	if (!is_user_page()) { return; }

	const table = check(document.querySelector("table.ranking.songs"));

	table.insertAdjacentElement("beforebegin", create("input", {
		id: "wide_song_table_css",
		type: "checkbox",
		style: { display: "none" },
		checked: get_wide_table(),
	}));
}

// ** Link util **

export function setup_user_rank_link_swap(): void {
	if (!is_user_page()) { return; }

	const elem_ranking_links = document.querySelectorAll<HTMLAnchorElement>(".content div.columns ul > li > a");
	console.assert(elem_ranking_links.length >= 2, elem_ranking_links);
	// Global rank
	const elem_global = elem_ranking_links[0];
	const res_global = check(g.leaderboard_rank_reg.exec(elem_global.innerText));
	const rank_global = number_invariant(res_global[1]);
	elem_global.href = g.scoresaber_link + "/global/" + rank_to_page(rank_global, g.user_per_page_global_leaderboard);
	// Country rank
	const elem_country = elem_ranking_links[1];
	const res_country = check(g.leaderboard_rank_reg.exec(elem_country.innerText));
	const country_str = check(g.leaderboard_country_reg.exec(elem_country.href));
	const number_country = number_invariant(res_country[1]);
	elem_country.href = g.scoresaber_link +
		"/global/" + rank_to_page(number_country, g.user_per_page_global_leaderboard) +
		"?country=" + country_str[2];
}

export function setup_song_rank_link_swap(): void {
	if (!is_user_page()) { return; }

	const song_elems = document.querySelectorAll("table.ranking.songs tbody tr");
	for (const row of song_elems) {
		const rank_elem = check(row.querySelector(".rank"));
		// there's only one link, so 'a' will find it.
		const leaderboard_link = check(row.querySelector<HTMLAnchorElement>("th.song a")).href;
		const rank = number_invariant(rank_elem.innerText.slice(1));
		const rank_str = rank_elem.innerText;
		rank_elem.innerHTML = "";
		into(rank_elem,
			create("a", {
				href: `${leaderboard_link}?page=${rank_to_page(rank, g.user_per_page_song_leaderboard)}`
			}, rank_str)
		);
	}
}

function rank_to_page(rank: number, ranks_per_page: number): number {
	return Math.max(Math.floor((rank + ranks_per_page - 1) / ranks_per_page), 1);
}

export function add_percentage(): void {
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
			const standard_characteristic = data.metadata.characteristics.find(c => c.name === "Standard");
			if (!diff_name || !standard_characteristic)
				return;
			const notes = get_notes_count(diff_name, standard_characteristic);
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
