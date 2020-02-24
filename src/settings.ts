import SseEvent from "./components/events";
import { create_modal, Modal } from "./components/modal";
import * as env from "./env";
import g from "./global";
import * as themes from "./themes";
import { clear_children, create, into } from "./util/dom";
import { check } from "./util/err";
import { fetch2 } from "./util/net";
import { SSE_addStyle } from "./util/userscript";

let notify_box: HTMLElement | undefined;
let settings_modal: Modal | undefined;

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
		if (ntfys.length) {
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
	);

	settings_modal = create_modal({
		text: set_div,
		default: true,
	});
}

async function settings_set_theme(name: string): Promise<void> {
	const css = await fetch2(`https://unpkg.com/bulmaswatch/${name.toLowerCase()}/bulmaswatch.min.css`);
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
	const footer = document.querySelector("footer");
	if (!footer)
		return false;
	return footer.innerText.includes("light mode");
}

export function update_button_visibility() {
	if (!env.is_user_page()) { return; }

	const table = check(document.querySelector("table.ranking.songs"));

	table.querySelectorAll("th.bs_link").forEach(bs_link =>
		bs_link.style.display = env.get_show_bs_link() ? "" : "none");

	table.querySelectorAll("th.oc_link").forEach(oc_link =>
		oc_link.style.display = env.get_show_oc_link() ? "" : "none");
}
