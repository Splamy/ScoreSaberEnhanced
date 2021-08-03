import * as buttons from "../components/buttons";
import {create, into} from "../util/dom";
import {check} from "../util/err";
import {get_song_hash_from_text} from "../util/song";

export function setup_links_songlist(): void {
	if (!is_songlist_page()) {
		return;
	}

	const song_table = check(document.querySelector("table.ranking.songs"));
	const song_table_header = check(song_table.querySelector("thead tr"));

	into(song_table_header, create("th", {class: "compact bs_link"}, "BS"));
	into(song_table_header, create("th", {class: "compact oc_link"}, "OC"));

	// add a link for each song
	const song_rows = song_table.querySelectorAll("tbody tr");
	for (const row of song_rows) {
		const song_hash = get_song_hash_from_row(row);

		// link to beatsaver website
		into(row,
			create("th", { class: "compact bs_link" },
				buttons.generate_beatsaver(song_hash, "medium")
			)
		);

		// oneclick installer
		into(row,
			create("th", { class: "compact oc_link" },
				buttons.generate_oneclick(song_hash, "medium")
			)
		);
	}
}

function get_song_hash_from_row(row: HTMLElement): string|undefined {
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
			create("label", {class: "checkbox"}, create("input", {
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