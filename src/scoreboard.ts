import { BulmaSize } from "./declarations/Types";
import { create, into } from "./util/dom";
import { check } from "./util/err";
import { logc } from "./log";
import { is_user_page, is_song_leaderboard_page, get_wide_table } from "./env";
import { fetch_hash, oneclick_install_byhash, fetch_song_info_by_hash, get_song_hash_from_text } from "./util/song";
import g from "./global";
import { number_invariant } from "./util/format";

function new_page(link: string) {
	window.open(link, "_blank");
}

function generate_beatsaver_button(song_hash: string, size: BulmaSize): HTMLElement {
	let base_elem = create("div", {
		class: `button icon is-${size}`,
		style: {
			cursor: "pointer",
			padding: "0",
		},
		onclick: async() => {
			const song_data = await fetch_song_info_by_hash(song_hash);
			new_page(g.beatsaver_link + song_data.key);
		},
	});
	into(base_elem, create("div", { class: "beatsaver_bg" }));
	return base_elem;
}

function generate_oneclick_button(song_hash: string, size: BulmaSize): HTMLElement {
	return create("div", {
		class: `button icon is-${size}`,
		style: {
			cursor: "pointer",
		},
		onclick: async () => {
			await oneclick_install_byhash(song_hash);
		},
	}, create("i", { class: "fas fa-cloud-download-alt" }));
}

function generate_bsaber_button(song_hash: string): HTMLElement {
	return create("a", {
		class: "button icon is-large tooltip",
		style: {
			cursor: "pointer",
			padding: "0",
		},
		onclick: async () => {
			const song_data = await fetch_song_info_by_hash(song_hash);
			new_page(g.bsaber_link + song_data.key);
		},
	},
		create("div", {
			style: {
				backgroundImage: "url(\"https://bsaber.com/wp-content/themes/beastsaber-wp-theme/assets/img/avater-callback.png\")",
				backgroundSize: "cover",
				backgroundRepeat: "no-repeat",
				backgroundPosition: "center",
				width: "100%",
				height: "100%",
				borderRadius: "inherit",
			}
		}),
		create("div", { class: "tooltiptext" }, "View/Add rating on BeastSaber")
	);
}

export function setup_dl_link_user_site() {
	if (!is_user_page()) { return; }

	// find the table we want to modify
	let table = check(document.querySelector("table.ranking.songs"));

	// add a new column for our links
	let table_tr = check(table.querySelector("thead tr"));
	into(table_tr, create("th", { class: "compact bs_link" }, "BS"));
	into(table_tr, create("th", { class: "compact oc_link" }, "OC"));

	// add a link for each song
	let table_row = table.querySelectorAll("tbody tr");
	for (let row of table_row) {
		// there's only one link, so 'a' will find it.
		let image_link = check(row.querySelector<HTMLImageElement>("th.song img")).src;
		let song_hash = get_song_hash_from_text(image_link);

		// link to the website
		into(row,
			create("th", { class: "compact bs_link" },
				generate_beatsaver_button(song_hash, "medium")
			)
		);

		// oneclick installer
		into(row,
			create("th", { class: "compact oc_link" },
				generate_oneclick_button(song_hash, "medium")
			)
		);
	}
}

export function setup_dl_link_leaderboard() {
	if (!is_song_leaderboard_page()) { return; }

	// find the element we want to modify
	let details_box = check(document.querySelector(".content .title.is-5"));
	if (!details_box)
		return;
	details_box = check(details_box.parentElement);

	let song_hash = get_song_hash_from_text(details_box.innerHTML);

	details_box.appendChild(
		create("div", {
			id: "leaderboard_tool_strip"
		},
			generate_bsaber_button(song_hash),
			generate_beatsaver_button(song_hash, "large"),
			generate_oneclick_button(song_hash, "large")
		));
}

// ** Wide table ***

export function setup_wide_table_checkbox() {
	if (!is_user_page()) { return; }

	let table = check(document.querySelector("table.ranking.songs"));

	table.insertAdjacentElement("beforebegin", create("input", {
		id: "wide_song_table_css",
		type: "checkbox",
		style: { display: "none" },
		checked: get_wide_table(),
	}));
}

// ** Link util **

export function setup_user_rank_link_swap() {
	if (!is_user_page()) { return; }

	let elem_global = check(document.querySelector<HTMLAnchorElement>(".content div.columns ul li a"));
	let res_global = check(g.leaderboard_rank_reg.exec(elem_global.innerText));
	let number_global = number_invariant(res_global[1]);
	elem_global.href = g.scoresaber_link + "/global/" + rank_to_page(number_global, g.user_per_page_global_leaderboard);
}

export function setup_song_rank_link_swap() {
	if (!is_user_page()) { return; }

	let song_elems = document.querySelectorAll("table.ranking.songs tbody tr");
	for (let row of song_elems) {
		let rank_elem = check(row.querySelector(".rank"));
		// there's only one link, so 'a' will find it.
		let leaderboard_link = check(row.querySelector<HTMLAnchorElement>("th.song a")).href;
		let rank = number_invariant(rank_elem.innerText.slice(1));
		let rank_str = rank_elem.innerText;
		rank_elem.innerHTML = "";
		into(rank_elem,
			create("a", {
				href: `${leaderboard_link}?page=${rank_to_page(rank, g.user_per_page_song_leaderboard)}`
			}, rank_str)
		);
	}
}

function rank_to_page(rank: number, ranks_per_page: number): number {
	return Math.floor((rank + ranks_per_page - 1) / ranks_per_page);
}