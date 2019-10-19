import * as themes from "./themes";
import { create, into } from "./util/dom";
import g from "./global";
import { is_user_page, get_show_bs_link, get_show_oc_link, get_navbar, get_wide_table, set_show_oc_link, set_show_bs_link, set_wide_table } from "./env";
import { check } from "./util/err";
import { check_for_updates } from "./updater";

export function setup() {
    let current_theme = localStorage.getItem("theme_name");
    if (!current_theme) {
        current_theme = "Default";
    }

    let set_div = create("div", {
        id: "settings_overlay",
        style: {
            height: "100%",
            width: "100%",
            position: "fixed",
            zIndex: "30",
            left: "0",
            top: "0",
            backgroundColor: "rgba(0,0,0, 0.2)",
            overflow: "hidden",

            display: "none", // flex
            justifyContent: "center",
        },
        onclick: function () {
            (this as HTMLElement).style.display = "none";
        }
    },
        create("div", {
            id: "settings_dialogue",
            class: "box has-shadow",
            style: {
                width: "100%",
                position: "fixed",
                top: "4em",
                maxWidth: "720px",
            },
            onclick: function (ev) { ev.stopPropagation(); }
        },
            function () {
                let notify_box = create("div", { class: "field" });
                check_for_updates(notify_box);
                return notify_box;
            }(),
            create("div", { class: "field" },
                create("label", { class: "label" }, "Theme"),
                create("div", { class: "control" },
                    create("div", { class: "select" },
                        create("select", {
                            onchange: function () {
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
                    checked: get_wide_table(),
                    onchange: function () {
                        set_wide_table((this as HTMLInputElement).checked);
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
                    checked: get_show_bs_link(),
                    onchange: function () {
                        set_show_bs_link((this as HTMLInputElement).checked);
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
                    checked: get_show_oc_link(),
                    onchange: function () {
                        set_show_oc_link((this as HTMLInputElement).checked);
                        update_button_visibility();
                    }
                }),
                create("label", { for: "show_oc_link", class: "checkbox" }, "Show OneClick link"),
            )
        )
    );

    set_div = document.body.appendChild(set_div);

    into(get_navbar(),
        create("a", {
            id: "settings_menu",
            class: "navbar-item",
            style: {
                cursor: "pointer",
            },
            onclick: () => set_div.style.display = "flex",
        },
            create("i", { class: "fas fa-cog" })
        )
    );
}


/** @param {string} name */
function settings_set_theme(name: string): void {
    GM_xmlhttpRequest({
        method: "GET",
        headers: {
            "Origin": "unpkg.com",
        },
        url: `https://unpkg.com/bulmaswatch/${name.toLowerCase()}/bulmaswatch.min.css`,
        onload: function (response: XMLHttpRequest): void {
            const css = response.responseText;
            localStorage.setItem("theme_name", name);
            localStorage.setItem("theme_css", css);
            load_theme(name, css);
        }
    });
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
    if (name === "Cyborg" || name === "Darkly" || name === "Nuclear"
        || name === "Slate" || name === "Solar" || name === "Superhero") {
        css_fin = css + " " + themes.theme_dark;
    } else {
        css_fin = css + " " + themes.theme_light;
    }
    if (!g.style_themed_elem) {
        g.style_themed_elem = GM_addStyle(css_fin);
    } else {
        g.style_themed_elem.innerHTML = css_fin;
    }
}

export function update_button_visibility() {
    if (!is_user_page()) { return; }

    let table = check(document.querySelector("table.ranking.songs"));

    table.querySelectorAll("th.bs_link").forEach(bs_link =>
        bs_link.style.display = get_show_bs_link() ? "" : "none");

    table.querySelectorAll("th.oc_link").forEach(oc_link =>
        oc_link.style.display = get_show_oc_link() ? "" : "none");
}