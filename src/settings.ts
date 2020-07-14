import * as beastsaber from "./api/beastsaber";
import * as compare from "./compare";
import SseEvent from "./components/events";
import * as modal from "./components/modal";
import * as env from "./env";
import g from "./global";
import * as themes from "./themes";
import { clear_children, create, into, intor } from "./util/dom";
import { check } from "./util/err";
import { fetch2 } from "./util/net";
import { SSE_addStyle } from "./util/userscript";

let notify_box: HTMLElement | undefined;
let settings_modal: modal.Modal<any> | undefined;

export function setup(): void {
	notify_box = create("div", { class: "field" });
	const cog = create("i", { class: "fas fa-cog" });
	into(env.get_navbar(),
		create("a", {
			id: "settings_menu",
			class: "navbar-item",
			style: {
				cursor: "pointer",
			},
			onclick: () => show_settings_lazy(),
		}, cog)
	);

	SseEvent.UserNotification.register(() => {
		const ntfys = SseEvent.getNotifications();
		if (ntfys.length > 0) {
			cog.classList.remove("fa-cog");
			cog.classList.add("fa-bell");
			cog.style.color = "yellow";
		} else {
			cog.classList.remove("fa-bell");
			cog.classList.add("fa-cog");
			cog.style.color = "";
		}

		if (!notify_box) return;
		clear_children(notify_box);
		for (const ntfy of ntfys) {
			into(notify_box,
				create("div", { class: `notification is-${ntfy.type}` }, ntfy.msg)
			);
		}
	});
}

function show_settings_lazy() {
	if (settings_modal) {
		settings_modal.show();
		return;
	}

	const current_theme = localStorage.getItem("theme_name") ?? "Default";

	const status_box = create("div", {});
	SseEvent.StatusInfo.register((status) => intor(status_box, status.text));

	const set_div = create("div", {},
		check(notify_box),
		create("div", { class: "field" },
			create("label", { class: "label" }, "Theme"),
			create("div", { class: "control" },
				create("div", { class: "select" },
					create("select", {
						onchange() {
							settings_set_theme((this as HTMLSelectElement).value);
						}
					},
						...themes.themes.map(name => create("option", { selected: name === current_theme }, name))
					)
				)
			)
		),
		create("div", { class: "field" },
			create("label", { class: "label" }, "Song Table Options"),
		),
		create("div", { class: "field" },
			create("input", {
				id: "wide_song_table",
				type: "checkbox",
				class: "is-checkradio",
				checked: env.get_wide_table(),
				onchange() {
					env.set_wide_table((this as HTMLInputElement).checked);
					(check(document.getElementById("wide_song_table_css")) as HTMLInputElement).checked = (this as HTMLInputElement).checked;
				}
			}),
			create("label", { for: "wide_song_table", class: "checkbox" }, "Always expand table to full width"),
		),
		create("div", { class: "field" },
			create("label", { class: "label" }, "Links"),
		),
		create("div", { class: "field" },
			create("input", {
				id: "show_bs_link",
				type: "checkbox",
				class: "is-checkradio",
				checked: env.get_show_bs_link(),
				onchange() {
					env.set_show_bs_link((this as HTMLInputElement).checked);
					update_button_visibility();
				}
			}),
			create("label", { for: "show_bs_link", class: "checkbox" }, "Show BeatSaver link"),
		),
		create("div", { class: "field" },
			create("input", {
				id: "show_oc_link",
				type: "checkbox",
				class: "is-checkradio",
				checked: env.get_show_oc_link(),
				onchange() {
					env.set_show_oc_link((this as HTMLInputElement).checked);
					update_button_visibility();
				}
			}),
			create("label", { for: "show_oc_link", class: "checkbox" }, "Show OneClick link"),
		),
		create("div", { class: "field" },
			create("label", { class: "label" }, "Other"),
		),
		create("div", { class: "field" },
			create("input", {
				id: "use_new_ss_api",
				type: "checkbox",
				class: "is-checkradio",
				checked: env.get_use_new_ss_api(),
				onchange() {
					env.set_use_new_ss_api((this as HTMLInputElement).checked);
				}
			}),
			create("label", { for: "use_new_ss_api", class: "checkbox" }, "Use new ScoreSaber api"),
		),
		create("div", { class: "field" },
			create("label", { class: "label" }, "Tools"),
		),
		create("div", { class: "field" },
			create("div", { class: "buttons" },
				create("button", {
					class: "button",
					async onclick() {
						await compare.fetch_all();
					}
				}, "Update All User"),
				create("button", {
					class: "button is-danger",
					async onclick() {
						const resp = await modal.show_modal({
							text:
								"Warning: This might take a long time, depending " +
								"on how many users you have in your library list and " +
								"how many songs they have on ScoreSaber.\n" +
								"Use this only when all pp is fucked again.\n" +
								"And have mercy on the ScoreSaber servers.",
							buttons: {
								ok: { text: "Continue", class: "is-success" },
								x: { text: "Cancel", class: "is-danger" }
							}
						});
						if (resp === "ok") {
							await compare.fetch_all(true);
						}
					}
				}, "Force Update All User"),
			),
		),
		create("div", { class: "field" },
			create("label", { class: "label" }, "Beastsaber Bookmarks"),
		),
		create("div", { class: "field has-addons" },
			create("div", { class: "control has-icons-left" },
				create("input", {
					id: "bsaber_username",
					type: "text",
					class: "input",
					placeholder: "username",
					value: env.get_bsaber_username() ?? "",
					onchange() {
						env.set_bsaber_username((this as HTMLInputElement).value);
						update_button_visibility();
					}
				}),
				create("span", { class: "icon is-small is-left" },
					create("i", { class: "fas fa-user fa-xs" })
				),
			),
			create("div", { class: "control" },
				create("button",
					{
						class: "button bsaber_update_bookmarks",
						data: { tooltip: "Load Bookmarks" },
						async onclick() {
							const bsaber_username = env.get_bsaber_username();
							if (!bsaber_username) {
								await modal.show_modal({ text: "Please enter a username first.", buttons: modal.buttons.OkOnly });
								return;
							}
							await update_bsaber_bookmark_cache(this as any, bsaber_username);
						},
					},
					create("i", { class: "fas fa-sync" }),
				),
			),
		),
		create("br"),
	);

	settings_modal = modal.create_modal({
		title: "Options",
		text: set_div,
		footer: status_box,
		type: "card",
		default: true,
	});
}

async function settings_set_theme(name: string): Promise<void> {
	let css = "";
	if (name !== "Default") {
		css = await fetch2(`https://unpkg.com/bulmaswatch/${name.toLowerCase()}/bulmaswatch.min.css`);
	}
	localStorage.setItem("theme_name", name);
	localStorage.setItem("theme_css", css);
	load_theme(name, css);
}

// *** Theming ***

export function load_last_theme(): void {
	let theme_name = localStorage.getItem("theme_name");
	let theme_css = localStorage.getItem("theme_css");
	if (!theme_name || !theme_css) {
		theme_name = "Default";
		theme_css = "";
	}
	load_theme(theme_name, theme_css);
}

function load_theme(name: string, css: string): void {
	let css_fin: string;

	if (get_scoresaber_darkmode()
		|| name === "Cyborg" || name === "Darkly" || name === "Nuclear"
		|| name === "Slate" || name === "Solar" || name === "Superhero") {
		css_fin = css + " " + themes.theme_dark;
	} else {
		css_fin = css + " " + themes.theme_light;
	}
	if (!g.style_themed_elem) {
		g.style_themed_elem = SSE_addStyle(css_fin);
	} else {
		g.style_themed_elem.innerHTML = css_fin;
	}
}

function get_scoresaber_darkmode(): boolean {
	return document.cookie.includes("dark=1");
}

async function update_bsaber_bookmark_cache(button: any, username: string): Promise<void> {
	button.firstChild.classList.add("fa-spin");

	for (let page = 1; ; page++) {
		SseEvent.StatusInfo.invoke({ text: `Loading BeastSaber page ${page}` });
		const bookmarks = await beastsaber.get_bookmarks(username, page, 50);
		if (!bookmarks)
			break;
		process_bookmarks(bookmarks.songs);
		if (bookmarks.next_page === null) {
			break;
		}
	}

	SseEvent.StatusInfo.invoke({ text: "Finished loading BeastSaber bookmarks" });
	button.firstChild.classList.remove("fa-spin");
}

function process_bookmarks(songs: beastsaber.IBeastSaberSongInfo[]): void {
	for (const song of songs) {
		if (!song.hash) {
			continue;
		}
		if (!env.check_bsaber_bookmark(song.hash)) {
			env.add_bsaber_bookmark(song.hash);
		}
	}
}

export function update_button_visibility() {
	if (!env.is_user_page()) { return; }

	const table = check(document.querySelector("table.ranking.songs"));

	const bs_view = env.get_show_bs_link() ? "" : "none";
	table.querySelectorAll("th.bs_link").forEach(bs_link => bs_link.style.display = bs_view);

	const oc_view = env.get_show_oc_link() ? "" : "none";
	table.querySelectorAll("th.oc_link").forEach(oc_link => oc_link.style.display = oc_view);

	const bb_view = env.get_show_bb_link() ? "" : "none";
	table.querySelectorAll("th.bb_link").forEach(bb_link => bb_link.style.display = bb_view);
}
