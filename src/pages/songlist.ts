import { BMButton, BMButtonHelp, bmvar, Pages } from "../env";
import { as_fragment, create, into } from "../util/dom";
import { check } from "../util/err";
import { get_song_hash_from_text } from "../util/song";
import QuickButton from "../components/QuickButton.svelte";

const PAGE: Pages = "songlist";

export function setup_links_songlist(): void {
	if (!is_songlist_page()) {
		return;
	}

	const song_table = check(document.querySelector("table.ranking.songs"));
	const song_table_header = check(song_table.querySelector("thead tr"));

	for (const btn of BMButton) {
		into(song_table_header,
			create("th", {
				class: "compact",
				style: bmvar(PAGE, btn, "table-cell"),
				// TODO: Tooltip is currently cut off at the to due to div nesting
				//data: { tooltip: BMButtonHelp[btn].long },
			}, BMButtonHelp[btn].short)
		);
	}

	// add a link for each song
	const song_rows = song_table.querySelectorAll("tbody tr");
	for (const row of song_rows) {
		const song_hash = get_song_hash_from_row(row);

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

function get_song_hash_from_row(row: HTMLElement): string | undefined {
	const image_link =
		check(row.querySelector<HTMLImageElement>("td.song img")).src;
	return get_song_hash_from_text(image_link);
}


export function setup_extra_filter_checkboxes(): void {
	if (!is_songlist_page()) {
		return;
	}

	setup_duplicates_filter_checkbox();
}

function setup_duplicates_filter_checkbox(): void {
	const checked = should_hide_duplicate_songs();
	const duplicates_filter =
		create("label", { class: "checkbox" }, create("input", {
			id: "duplicates",
			type: "checkbox",
			checked: checked,
			onclick() {
				set_hide_duplicate_songs_filter(!checked);
				window.location.reload();
			}
		}));

	duplicates_filter.appendChild(
		document.createTextNode(" Hide duplicate songs "));

	const ranked_filter =
		check(document.querySelector("input#ranked")?.parentElement);
	ranked_filter.parentNode?.insertBefore(
		duplicates_filter, ranked_filter.nextSibling);
}

export function apply_extra_filters(): void {
	if (!is_songlist_page()) {
		return;
	}

	if (should_hide_duplicate_songs()) {
		hide_duplicate_songs();
	}
}

function hide_duplicate_songs(): void {
	const song_table = check(document.querySelector("table.ranking.songs tbody"));
	const song_rows = check(song_table.querySelectorAll("tr"));

	const hashes = new Set<string>();

	for (const row of song_rows) {
		const song_hash = check(get_song_hash_from_row(row));

		if (hashes.has(song_hash)) {
			song_table.removeChild(row);
		} else {
			hashes.add(song_hash);
		}
	}
}

function should_hide_duplicate_songs(): boolean {
	return localStorage.getItem("hide_songlist_duplicates") == "true";
}

function set_hide_duplicate_songs_filter(filter: boolean): void {
	localStorage.setItem("hide_songlist_duplicates", JSON.stringify(filter));
}

export function is_songlist_page(): boolean {
	return location.pathname == "/";
}
