import * as beatsaver from "../api/beatsaver";
import { BulmaSize } from "../declarations/Types";
import g from "../global";
import { create } from "../util/dom";
import { toggled_class } from "../util/format";
import { oneclick_install } from "../util/song";
export function generate_beatsaver(song_hash: string | undefined, size: BulmaSize): HTMLElement {
	return create("div", {
		class: `button icon is-${size} ${toggled_class(size !== "large", "has-tooltip-left")} beatsaver_bg_btn`,
		style: {
			cursor: song_hash === undefined ? "default" : "pointer",
			padding: "0",
		},
		disabled: song_hash === undefined,
		data: { tooltip: "View on BeatSaver" },
		onclick() {
			checked_hash_to_song_info(this as any, song_hash)
				.then(song_info => new_page(g.beatsaver_link + song_info.key))
				.catch(() => failed_to_download(this as any));
		},
	},
		create("div", { class: "beatsaver_bg" }),
	);
}

export function generate_oneclick(song_hash: string | undefined, size: BulmaSize): HTMLElement {
	return create("div", {
		class: `button icon is-${size} ${toggled_class(size !== "large", "has-tooltip-left")}`,
		style: {
			cursor: song_hash === undefined ? "default" : "pointer",
		},
		disabled: song_hash === undefined,
		data: { tooltip: "Download with OneClick™" },
		onclick() {
			checked_hash_to_song_info(this as any, song_hash)
				.then(song_info => oneclick_install(song_info.key))
				.then(() => ok_after_download(this as any))
				.catch(() => failed_to_download(this as any));
		},
	},
		create("i", { class: "fas fa-cloud-download-alt" }),
	);
}

export function generate_bsaber(song_hash: string | undefined): HTMLElement {
	return create("a", {
		class: "button icon is-large",
		style: {
			cursor: song_hash === undefined ? "default" : "pointer",
			padding: "0",
		},
		disabled: song_hash === undefined,
		data: { tooltip: "View/Add rating on BeastSaber" },
		async onclick() {
			checked_hash_to_song_info(this as any, song_hash)
				.then(song_info => new_page(g.bsaber_songs_link + song_info.key))
				.catch(() => failed_to_download(this as any));
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
	);
}

export function generate_preview(song_hash: string | undefined): HTMLElement {
	return create("div", {
		class: "button icon is-large",
		style: {
			cursor: song_hash === undefined ? "default" : "pointer",
			padding: "0",
		},
		disabled: song_hash === undefined,
		data: { tooltip: "Preview map" },
		onclick() {
			checked_hash_to_song_info(this as any, song_hash)
				.then(song_info => new_page("https://skystudioapps.com/bs-viewer/?id=" + song_info.key))
				.catch(() => failed_to_download(this as any));
		},
	},
		create("i", { class: "fas fa-glasses" }),
	);
}

async function checked_hash_to_song_info(ref: HTMLElement, song_hash: string | undefined): Promise<beatsaver.IBeatSaverData> {
	reset_download_visual(ref);
	if (!song_hash) { failed_to_download(ref); throw new Error("song_hash is undefined"); }
	const song_info = await beatsaver.get_data_by_hash(song_hash);
	if (!song_info) { failed_to_download(ref); throw new Error("song_info is undefined"); }
	return song_info;
}

// *** Utility ***

function reset_download_visual(ref: HTMLElement) {
	if (ref) {
		ref.classList.remove("button_success");
		ref.classList.remove("button_error");
	}
}

function failed_to_download(ref?: HTMLElement) {
	if (ref) {
		ref.classList.add("button_error");
	}
}

function ok_after_download(ref: HTMLElement) {
	if (ref) {
		ref.classList.add("button_success");
	}
}

function new_page(link: string): void {
	window.open(link, "_blank");
}
