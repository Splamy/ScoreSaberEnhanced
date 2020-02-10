import { IUser } from "./declarations/Types";
import g from "./global";
import { create, into } from "./util/dom";
import { check } from "./util/err";

export function get_user_header(): HTMLHeadingElement {
	return check(document.querySelector<HTMLHeadingElement>(".content div.columns h5"));
}

export function get_navbar(): HTMLDivElement {
	return check(document.querySelector<HTMLDivElement>("#navMenu div.navbar-start"));
}

export function is_user_page(): boolean {
	return window.location.href.toLowerCase().startsWith(g.scoresaber_link + "/u/");
}

export function is_song_leaderboard_page(): boolean {
	return window.location.href.toLowerCase().startsWith(g.scoresaber_link + "/leaderboard/");
}

export function get_current_user(): IUser {
	if (g._current_user) { return g._current_user; }
	if (!is_user_page()) { throw new Error("Not on a user page"); }

	g._current_user = get_document_user(document);
	return g._current_user;
}

export function get_document_user(doc: Document) {
	const username_elem = check(doc.querySelector(".content .title a"));
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
export function insert_compare_feature(elem: HTMLElement) {
	if (!is_user_page()) { throw Error("Invalid call to 'insert_compare_feature'"); }
	setup_compare_feature_list();
	elem.style.marginLeft = "1em";
	into(check(g.feature_list), elem);
}

/**
 * Adds an element between the toolbar and the song scores of a user.
 */
export function insert_compare_display(elem: HTMLElement) {
	if (!is_user_page()) { throw Error("Invalid call to 'insert_compare_display'"); }
	setup_compare_feature_list();
	into(check(g.feature_display_list), elem);
}

function setup_compare_feature_list() {
	if (g.feature_list === undefined) {
		// find the old dropdown elem to replace it with out container
		const select_score_order_elem = check(document.querySelector(".content div.select"));
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

export function set_show_bs_link(value: boolean): void {
	localStorage.setItem("show_bs_link", value ? "true" : "false");
}

export function get_show_bs_link(): boolean {
	return (localStorage.getItem("show_bs_link") || "true") === "true";
}

export function set_show_oc_link(value: boolean): void {
	localStorage.setItem("show_oc_link", value ? "true" : "false");
}

export function get_show_oc_link(): boolean {
	return (localStorage.getItem("show_oc_link") || "true") === "true";
}
