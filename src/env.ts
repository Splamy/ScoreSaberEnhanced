import { IUser } from "./declarations/Types";
import g from "./global";
import { create, into } from "./util/dom";
import { check } from "./util/err";

export function get_user_header(): HTMLElement {
	return check(document.querySelector<HTMLElement>(".title.player"));
}

export function get_navbar(): HTMLDivElement {
	return check(document.querySelector<HTMLDivElement>("nav"));
}

export function is_user_page(): boolean {
	return window.location.href.toLowerCase().startsWith(g.scoresaber_link + "/u/");
}

export function is_song_leaderboard_page(): boolean {
	return window.location.href.toLowerCase().startsWith(g.scoresaber_link + "/leaderboard/");
}

export function get_current_user(): IUser {
	if (!is_user_page()) { throw new Error("Not on a user page"); }

	g._current_user = get_document_user(document);
	return g._current_user;
}

export function get_document_user(doc: Document): IUser {
	const username_elem = check(doc.querySelector(".player-link"));
	const user_name = username_elem.innerText.trim();
	// TODO will be wrong when calling from a different page
	const user_id = g.user_reg.exec(window.location.href)![1];

	return { id: user_id, name: user_name };
}

export function get_home_user(): IUser | undefined {
	if (g._home_user) { return g._home_user; }

	const json = localStorage.getItem("home_user");
	if (!json) {
		return undefined;
	}
	g._home_user = JSON.parse(json);
	return g._home_user;
}

export function get_compare_user(): string | undefined {
	if (g.last_selected) {
		return g.last_selected;
	}

	const stored_last = localStorage.getItem("last_selected");
	if (stored_last) {
		g.last_selected = stored_last;
		return g.last_selected;
	}

	const compare = document.getElementById("user_compare") as HTMLSelectElement | null;
	if (compare?.value) {
		g.last_selected = compare.value;
		return g.last_selected;
	}
	return undefined;
}

/**
 * Adds an element into the toolbar which is right above the song scores of a user.
 */
export function insert_compare_feature(elem: HTMLElement): void {
	if (!is_user_page()) { throw Error("Invalid call to 'insert_compare_feature'"); }
	setup_compare_feature_list();
	elem.style.marginLeft = "1em";
	into(check(g.feature_list), elem);
}

/**
 * Adds an element between the toolbar and the song scores of a user.
 */
export function insert_compare_display(elem: HTMLElement): void {
	if (!is_user_page()) { throw Error("Invalid call to 'insert_compare_display'"); }
	setup_compare_feature_list();
	into(check(g.feature_display_list), elem);
}

function setup_compare_feature_list(): void {
	if (g.feature_list === undefined) {
		// find the old dropdown elem to replace it with out container
		const select_score_order_elem = check(document.querySelector(".btn-group"));
		const parent_box_elem = check(select_score_order_elem.parentElement);
		g.feature_list = create("div", { class: "level-item" });
		const level_box_elem = create("div", { class: "level" }, g.feature_list);

		parent_box_elem.replaceChild(level_box_elem, select_score_order_elem);

		// reinsert the dropdown in our own cotainer now
		insert_compare_feature(select_score_order_elem);

		// Setup the box for feature display elements
		g.feature_display_list = create("div", { class: "level-item" });
		level_box_elem.insertAdjacentElement("afterend", g.feature_display_list);
	}
}

export function set_compare_user(user: string): void {
	g.last_selected = user;
	localStorage.setItem("last_selected", user);
}

export function set_home_user(user: IUser): void {
	g._home_user = user;
	localStorage.setItem("home_user", JSON.stringify(user));
}

export function set_wide_table(value: boolean): void {
	localStorage.setItem("wide_song_table", value ? "true" : "false");
}
export function get_wide_table(): boolean {
	return localStorage.getItem("wide_song_table") === "true";
}

export const BMPage: Pages[] = ["song", "songlist", "user"]
export const BMButton: Buttons[] = ["BS", "OC", "Beast", "BeastBook", "Preview", "BSR"];
export const BMPageButtons: PageButtons[] = BMPage
	.map(p => BMButton.map(b => `${p}-${b}`))
	.reduce((agg, lis) => [...agg, ...lis], []) as PageButtons[];
export type Pages = "song" | "songlist" | "user";
export type Buttons = "BS" | "OC" | "Beast" | "BeastBook" | "Preview" | "BSR";
export type PageButtons = `${Pages}-${Buttons}`;
export type ButtonMatrix = Partial<Record<PageButtons, boolean>>;
export const BMButtonHelp: Record<Buttons, { 
	short: string,
	long: string,
	tip: string
}> = {
	BS: { short: "BS", long: "BeatSaver", tip: "View on BeatSaver" },
	OC: { short: "OC", long: "OneClick™", tip: "Download with OneClick™" },
	Beast: { short: "BST", long: "BeastSaber", tip: "View/Add rating on BeastSaber" },
	BeastBook: { short: "BB", long: "BeastSaber Bookmark", tip: "Bookmark on BeastSaber" },
	Preview: { short: "👓", long: "Preview", tip: "Preview map" },
	BSR: { short: "❗", long: "BeatSaver Request", tip: "Copy !bsr" },
};

export function bmvar(page: Pages, button: Buttons, def: string): Partial<CSSStyleDeclaration> {
	return {
		display: `var(--sse-show-${page}-${button}, ${def})`,
	};
}

export function get_button_matrix(): ButtonMatrix {
	const json = localStorage.getItem("sse_button_matrix");
	if (!json)
		return default_button_matrix();
	return JSON.parse(json);
}

function default_button_matrix(): ButtonMatrix {
	return {
		"song-BS": true,
		"song-BSR": true,
		"song-Beast": true,
		"song-BeastBook": true,
		"song-OC": true,
		"song-Preview": true,
		"songlist-BS": true,
		"songlist-OC": true,
		"user-BS": true,
		"user-OC": true,
	};
}

export function set_button_matrix(bm: ButtonMatrix): void {
	localStorage.setItem("sse_button_matrix", JSON.stringify(bm));
}

export function set_use_new_ss_api(value: boolean): void {
	localStorage.setItem("use_new_api", value ? "true" : "false");
}
export function get_use_new_ss_api(): boolean {
	return (localStorage.getItem("use_new_api") || "true") === "true";
}

export function set_bsaber_username(value: string): void {
	localStorage.setItem("bsaber_username", value);
}
export function get_bsaber_username(): string | undefined {
	return (localStorage.getItem("bsaber_username") || undefined);
}

function get_bsaber_bookmarks(): string[] {
	const data = localStorage.getItem("bsaber_bookmarks");
	if (!data) return [];
	return JSON.parse(data);
}

export function add_bsaber_bookmark(song_hash: string): void {
	const bookmarks = get_bsaber_bookmarks();
	bookmarks.push(song_hash);
	localStorage.setItem("bsaber_bookmarks", JSON.stringify(bookmarks));
}
export function check_bsaber_bookmark(song_hash: string): boolean {
	const bookmarks = get_bsaber_bookmarks();
	return bookmarks.includes(song_hash.toLowerCase());
}

export function get_show_bb_link(): boolean {
	return (get_bsaber_bookmarks() !== [] && !!get_bsaber_username());
}
