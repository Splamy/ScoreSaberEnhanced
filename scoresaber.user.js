// ==UserScript==
// @name         ScoreSaberEnhanced
// @namespace    https://scoresaber.com
// @version      1.2.4
// @description  Adds links to beatsaver and add player comparison
// @author       Splamy, TheAsuro
// @match        http*://scoresaber.com/*
// @icon         https://scoresaber.com/imports/images/logo.ico
// @updateURL    https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scoresaber.user.js
// @downloadURL  https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scoresaber.user.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert@2.1.2/dist/sweetalert.min.js
// @require      https://cdn.jsdelivr.net/npm/timeago.js@3.0.2/dist/timeago.min.js
// @run-at       document-body
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_info
// @connect      unpkg.com
// @connect      beatsaver.com
// @connect      githubusercontent.com
// ==/UserScript==
// @ts-check
/// <reference path="userscript.d.ts" />

/**
 * @typedef {{ time: string, pp:number, accuracy?: number, score?: number, mods?:string[] }} Song
 * @typedef {{ id: string, name: string }} User
 * @typedef {{ name: string, songs: {[song_id: string]: Song } }} DbUser
 * @typedef {"small"|"medium"|"large"} BulmaSize
 */

"use strict";
const scoresaber_link = "https://scoresaber.com";
const beatsaver_link = "https://beatsaver.com/browse/detail/"
const beatsaver_detail_api_link = "https://beatsaver.com/api/songs/detail/"
const bsaber_link = "https://bsaber.com/songs/";
const bsaber_link_reg = /https?:\/\/bsaber.com\/songs\/(\d+)/;
const score_reg = /(score|accuracy):\s*([\d\.,]+)%?\s*(\(([\w,]*)\))?/;
const leaderboard_reg = /leaderboard\/(\d+)/;
const leaderboard_rank_reg = /#([\d,]+)\s*\/\s*#([\d,]+)/;
const user_reg = /u\/(\d+)/;
const script_version_reg = /\/\/\s*@version\s+([\d\.]+)/;
const user_per_page_global_leaderboard = 50;
const user_per_page_song_leaderboard = 12;
/** @type{any} */
// @ts-ignore
timeago = timeago();

const themes = ["Default", "Cerulean", "Cosmo", "Cyborg", "Darkly", "Flatly",
    "Journal", "Litera", "Lumen", "Lux", "Materia", "Minty", "Nuclear", "Pulse",
    "Sandstone", "Simplex", "Slate", "Solar", "Spacelab", "Superhero", "United",
    "Yeti"];
const theme_light = `:root {
    --color-ahead: rgb(128, 255, 128);
    --color-behind: rgb(255, 128, 128);
    --color-highlight: lightgreen;
}`;
const theme_dark = `:root {
    --color-ahead: rgb(0, 128, 0);
    --color-behind: rgb(128, 0, 0);
    --color-highlight: darkgreen;
}
.beatsaver_bg {
    filter: invert(1);
}
/* Reset colors for generic themes */
span.songBottom.time, span.scoreBottom, span.scoreTop.ppWeightedValue {
    color:unset;
}
span.songTop.pp, span.scoreTop.ppValue, span.scoreTop.ppLabel, span.songTop.mapper {
    text-shadow: 1px 1px 2px #000;
}`;

/** @type {{ [user_id: string]: DbUser}} */
let user_list;
let status_elem;
let users_elem;
/** @type {string} */
let last_selected;
let debug = false;

/** @type {User} */
let _current_user;
/** @type {User} */
let _home_user;
/** @type {HTMLStyleElement} */
let style_themed_elem
/** @type {HTMLElement} */
let song_table_backup;

// *** Buttons and styles ***

/**
 * @param {((this: GlobalEventHandlers, ev: MouseEvent) => any)|string} click
 * @param {BulmaSize} size
 * @returns {HTMLElement}
 */
function generate_beatsaver_button(click, size) {
    const clas = `button icon is-${size}`;

    let base_elem;
    if (typeof click === "string") {
        base_elem = create("a", {
            class: clas,
            style: {
                padding: "0",
            },
            href: click,
        });
    } else {
        base_elem = create("div", {
            class: clas,
            style: {
                cursor: "pointer",
                padding: "0",
            },
            onclick: click,
        });
    }
    into(base_elem, create("div", { class: "beatsaver_bg" }));
    return base_elem;
}

/**
 * @param {(this: GlobalEventHandlers, ev: MouseEvent) => any} click
 * @param {BulmaSize} size
 * @returns {HTMLElement}
 */
function generate_oneclick_button(click, size) {
    return create("div", {
        class: `button icon is-${size}`,
        style: {
            cursor: "pointer",
        },
        onclick: click,
    }, create("i", { class: "fas fa-cloud-download-alt" }));
}

/**
 * @param {string} href
 * @returns {HTMLElement}
 */
function generate_bsaber_button(href) {
    return create("a", {
        class: "button icon is-large tooltip",
        style: {
            cursor: "pointer",
            padding: "0",
        },
        href: href,
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

function setup_style() {
    GM_addStyle(`.compact {
        padding-right: 0 !important;
        padding-left: 0 !important;
        margin-left: 0px !important;
        margin-right: 0px !important;
        text-align: center !important;
    }
    h5 > * {
        margin-right: 0.3em;
    }
    #wide_song_table_css:checked ~ table.ranking.songs {
        max-width: unset !important;
    }
    .beatsaver_bg {
        background: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200' version='1.1'%3E%3Cg fill='none' stroke='%23000000' stroke-width='10'%3E %3Cpath d='M 100,7 189,47 100,87 12,47 Z' stroke-linejoin='round'/%3E %3Cpath d='M 189,47 189,155 100,196 12,155 12,47' stroke-linejoin='round'/%3E %3Cpath d='M 100,87 100,196' stroke-linejoin='round'/%3E %3Cpath d='M 26,77 85,106 53,130 Z' stroke-linejoin='round'/%3E %3C/g%3E %3C/svg%3E") no-repeat center/85%;
        width: 100%;
        height: 100%;
    }
    .fas_big {
        line-height: 150%;
        padding-right: 0.5em;
        padding-left: 0.5em;
        min-width: 2.25em;
        /* Fix for some themes overriding font */
        font-weight: 900;
        font-family: "Font Awesome 5 Free";
    }
    .fas_big::before {
        font-size: 120%;
    }
    .tooltip { }
    .tooltip .tooltiptext {
        visibility: hidden;
        background-color: #555;
        color: #fff;
        border-radius: 6px;
        position: absolute;
        z-index: 1;
        bottom: 125%;
        margin-left: -3em;
        opacity: 0;
        transition: opacity 0.3s;
        padding: 0.2em 1em;
    }
    .tooltip:hover .tooltiptext {
        visibility: visible;
        opacity: 1;
    }
    #leaderboard_tool_strip > * {
        margin-right: 0.5em;
    }
    .offset_tab {
        margin-left: auto;
    }`);
    into(document.head, create("link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/bulma-checkradio/dist/css/bulma-checkradio.min.css" }));
    //into(document.head, create("link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/bulma-tooltip/dist/css/bulma-tooltip.min.css" }));
}

// *** Injection and generation ***

// *** Download Buttons ***

function setup_dl_link_user_site() {
    if (!is_user_page()) { return; }

    // find the table we want to modify
    let table = document.querySelector("table.ranking.songs");

    // add a new column for our links
    let table_tr = table.querySelector("thead tr");
    into(table_tr, create("th", { class: "compact bs_link" }, "BS"));
    into(table_tr, create("th", { class: "compact oc_link" }, "OC"));

    // add a link for each song
    let table_row = table.querySelectorAll("tbody tr");
    for (let row of table_row) {
        // @ts-ignore // there's only one link, so 'a' will find it.
        let leaderboard_link = row.querySelector("th.song a").href;

        // link to the website
        into(row,
            create("th", { class: "compact bs_link" },
                generate_beatsaver_button(async () => {
                    let simple_id = await fetch_id(leaderboard_link);
                    window.open(beatsaver_link + simple_id, '_blank');
                }, "medium")
            )
        );

        // oneclick installer
        into(row,
            create("th", { class: "compact oc_link" },
                generate_oneclick_button(async () => {
                    await oneclick_autoresolve(undefined, leaderboard_link);
                }, "medium")
            )
        );
    }
}

function setup_dl_link_leaderboard() {
    if (!is_song_leaderboard_page()) { return; }

    // find the element we want to modify
    /** @type {HTMLAnchorElement} */
    let link_element = document.querySelector("div.box hr + a");

    let simple_id = get_id_from_song_link(link_element.href);

    let details_box = link_element.parentElement;

    details_box.insertBefore(
        create("div", {
            id: "leaderboard_tool_strip"
        },
            generate_bsaber_button(link_element.href),
            generate_beatsaver_button(beatsaver_link + simple_id, "large"),
            generate_oneclick_button(async () => {
                await oneclick_autoresolve(simple_id, undefined);
            }, "large")
        ), link_element);
    details_box.removeChild(link_element);
}

function setup_song_filter_tabs() {
    if (!is_song_leaderboard_page()) { return; }

    let tab_list_content = document.querySelector(".tabs > ul");

    function load_friends() {
        let score_table = document.querySelector(".ranking .global > tbody");
        song_table_backup = score_table;
        let table = score_table.parentNode;
        table.removeChild(score_table);
        score_table = table.appendChild(create("tbody"));
        let song_id = leaderboard_reg.exec(window.location.pathname)[1];

        /** @type {[Song, HTMLElement][]} */
        let elements = [];
        for (var user_id in user_list) {
            let user = user_list[user_id];
            let song = user.songs[song_id];
            // Check if the user has a score on this song
            if (!song)
                continue;
            elements.push([song, generate_song_table_row(user_id, user, song_id)]);
        };
        elements.sort((a, b) => { let [sa, sb] = get_song_compare_value(a[0], b[0]); return sb - sa; })
        elements.forEach(x => score_table.appendChild(x[1]));
    }

    function load_all() {
        if (!song_table_backup) {
            return;
        }

        let score_table = document.querySelector(".ranking .global > tbody");
        let table = score_table.parentNode;
        table.removeChild(score_table);
        score_table = table.appendChild(song_table_backup);
        song_table_backup = undefined;
    }

    tab_list_content.appendChild(generate_tab("All Scores", "all_scores_tab", load_all, true, true));
    tab_list_content.appendChild(generate_tab("Friends", "friends_tab", load_friends, false, false));
    // tab_list_content.appendChild(generate_tab("Around Me", "around_me_tab", () => {}, false, false));
}

/**
 * @param {string} user_id
 * @param {DbUser} user
 * @param {string} song_id
 */
function generate_song_table_row(user_id, user, song_id) {
    let song = user.songs[song_id];
    return create("tr", {},
        create("td", { class: "picture" }),
        create("td", { class: "rank" }, "-"),
        create("td", { class: "player" }, generate_song_table_player(user_id, user)),
        create("td", { class: "score" }, song.score ? format_en(song.score, 0) : "-"),
        create("td", { class: "timeset" }, timeago.format(song.time)),
        create("td", { class: "mods" }, song.mods ? song.mods.toString() : "-"),
        create("td", { class: "percentage" }, song.accuracy ? (song.accuracy.toString() + "%") : "-"),
        create("td", { class: "pp" },
            create("span", { class: "scoreTop ppValue" }, format_en(song.pp)),
            create("span", { class: "scoreTop ppLabel" }, "pp")
        )
    )
}

/**
 * @param {DbUser} user
 * @param {string} user_id
 */
function generate_song_table_player(user_id, user) {
    return create("a", { href: `${scoresaber_link}/u/${user_id}` }, user.name);
}

/**
 * @param {string | HTMLElement} title
 * @param {string} css_id
 * @param {(() => any) | undefined} action
 * @param {boolean} is_active
 * @param {boolean} has_offset
 */
function generate_tab(title, css_id, action, is_active, has_offset) {
    let tabClass = `filter_tab ${toggled_class(is_active, "is-active")} ${toggled_class(has_offset, "offset_tab")}`;
    return create("li", {
        id: css_id,
        class: tabClass,
    },
        create("a", {
            class: "has-text-info",
            onclick: () => {
                document.querySelectorAll(".tabs > ul .filter_tab").forEach(x => x.classList.remove("is-active"));
                document.getElementById(css_id).classList.add("is-active");
                if (action) action();
            }
        }, title)
    );
}

/**
 * @param {string} link
 * @returns {Promise<string>}
 */
async function fetch_id(link) {
    // we cant get the beatsaver song link directly so we fetch
    // the song id from the leaderboard site with an async fetch request.
    let leaderboard_text = await (await fetch(link)).text();
    return get_id_from_song_link(leaderboard_text);
}

/**
 * @param {string} simple_id
 * @param {string} leaderboard_link
 */
async function oneclick_autoresolve(simple_id, leaderboard_link) {
    if (simple_id === undefined) {
        if (leaderboard_link === undefined) {
            throw Error("Invalid resolve call");
        }
        simple_id = await fetch_id(leaderboard_link);
    }

    let data = await fetch2(beatsaver_detail_api_link + simple_id);
    if(!data) {
        console.log("Failed to retrive song details");
        return;
    }

    let json = JSON.parse(data);
    let full_id = json.song.key;

    await oneclick_install(full_id);
}

/**
 * @param {string} full_id
 */
async function oneclick_install(full_id) {
    const lastCheck = localStorage.getItem('oneclick-prompt');
    const prompt = lastCheck === undefined ||
        new Date(lastCheck).getTime() + (1000 * 60 * 60 * 24 * 31) < new Date().getTime();

    if (prompt) {
        localStorage.setItem('oneclick-prompt', new Date().getTime().toString())

        const resp = await swal({
            icon: 'warning',
            buttons: {
                install: { text: 'Get ModSaber Installer', closeModal: false, className: 'swal-button--cancel' },
                done: { text: 'OK' },
            },
            text: 'OneClick Install requires the BeatSaberModInstaller or BeatDrop2 to function.\nPlease install it before proceeding.',
        });

        if (resp === 'install') window.open('https://github.com/beat-saber-modding-group/BeatSaberModInstaller/releases');
    }

    window.location.assign(`beatsaver://${full_id}`);
}

/**
 * @param {HTMLElement} edit_elem
 */
function check_for_updates(edit_elem) {
    let current_version = GM_info.script.version;
    let update_check = localStorage.getItem("update_check");

    if (update_check && Number(update_check) >= new Date().getTime()) {
        return;
    }

    console.log("Checking veriuson");
    GM_xmlhttpRequest({
        method: "GET",
        headers: {
            "Origin": "github.com",
        },
        url: `https://raw.githubusercontent.com/Splamy/ScoreSaberEnhanced/master/scoresaber.user.js`,
        onload: function (response) {
            let latest_script = response.responseText;
            let latest_version = script_version_reg.exec(latest_script)[1];
            if (current_version != latest_version) {
                into(edit_elem,
                    create("div", { class: "notification is-warning" }, "An update is avalilable")
                );

                let settings_menu = document.querySelector("#settings_menu i");
                settings_menu.classList.remove("fa-cog");
                settings_menu.classList.add("fa-bell");
                settings_menu.style.color = "yellow";
            } else {
                var now = new Date();
                now.setDate(now.getDate() + 1);
                localStorage.setItem("update_check", now.getTime().toString());
            }
        }
    });
}

function update_button_visibility() {
    if (!is_user_page()) { return; }

    let table = document.querySelector("table.ranking.songs");

    table.querySelectorAll("th.bs_link").forEach(bs_link =>
        bs_link.style.display = get_show_bs_link() ? '' : 'none');

    table.querySelectorAll("th.oc_link").forEach(oc_link =>
        oc_link.style.display = get_show_oc_link() ? '' : 'none');
}

// *** User compare ***

function setup_user_compare() {
    if (!is_user_page()) { return; }

    // find the element we want to modify
    let content = document.querySelector(".content");
    let header = get_user_header();
    header.style.display = "flex";
    header.style.alignItems = "center";

    let user = get_current_user();
    into(header,
        create("div", {
            class: "button icon is-medium tooltip",
            style: { cursor: "pointer" },
            onclick: async () => {
                await fetch_user(get_current_user().id);
                update_user_compare_songtable_default();
            },
        },
            create("i", { class: ["fas", user_list[user.id] ? "fa-sync" : "fa-bookmark"] }),
            create("div", { class: "tooltiptext" }, user_list[user.id] ? "Update score cache" : "Add user to your score cache")
        )
    );

    status_elem = create("div");
    into(header, status_elem);

    users_elem = create("div", {
        style: {
            display: "inline",
            marginLeft: "1em"
        }
    });
    content.querySelector("div.select").insertAdjacentElement("afterend", users_elem);

    update_user_compare_dropdown();
    update_user_compare_songtable_default();
}

function update_user_compare_dropdown() {
    if (!is_user_page()) { return; }

    let compare = get_compare_user();
    intor(users_elem,
        create("div", { class: "select" },
            create("select", {
                id: "user_compare",
                onchange: function () {
                    // @ts-ignore
                    set_compare_user(this.value);
                }
            }, ...Object.keys(user_list).map(id => {
                let user = user_list[id];
                return create("option", { value: id, selected: id === compare ? "selected" : undefined }, user.name);
            }))
        )
    );
}

function update_user_compare_songtable_default() {
    let compare = get_compare_user();
    if (compare) {
        update_user_compare_songtable(compare);
    }
}

/**
 * @param {string} other_user
 */
function update_user_compare_songtable(other_user) {
    if (!is_user_page()) { return; }

    let other_data = user_list[other_user];
    if (!other_data) {
        logc("Other user not found: ", other_user); // Try update?
        return;
    }

    let table = document.querySelector("table.ranking.songs");

    // Reload table data
    table.querySelectorAll(".comparisonScore").forEach(el => el.remove());

    const ranking_table_header = table.querySelector("thead > tr");
    ranking_table_header.querySelector(".score").insertAdjacentElement("afterend", create("th", { class: "comparisonScore" }, other_data.name));

    // Update table
    let table_row = table.querySelectorAll("tbody tr");
    for (let row of table_row) {
        // reset style
        row.style.backgroundImage = "unset";

        let [song_id, song] = get_row_data(row);
        let other_song = other_data.songs[song_id];

        // add score column
        /** @type {string | HTMLElement} */
        let other_score_content;
        if (other_song) {
            other_score_content = create("div", {},
                create("span", { class: "scoreTop ppValue" }, format_en(other_song.pp)),
                create("span", { class: "scoreTop ppLabel" }, "pp"),
                create("br"),
                (function () {
                    let str;
                    if (other_song.accuracy) {
                        str = `accuracy: ${format_en(other_song.accuracy)}%`;
                    } else if (other_song.score) {
                        str = `score: ${format_en(other_song.score)}`;
                    } else {
                        return "<No Data>";
                    }
                    if (other_song.mods) {
                        str += ` (${other_song.mods.join(",")})`;
                    }
                    return create("span", { class: "scoreBottom" }, str);
                })()
                // create("span", { class: "songBottom time" }, other_song.time) // TODO: Date formatting
            );
        } else {
            other_score_content = create("hr", {});
        }
        row.querySelector(".score").insertAdjacentElement("afterend", create("th", { class: "comparisonScore" }, other_score_content));

        if (!other_song) {
            logc("No match");
            continue;
        }

        let [value1, value2] = get_song_compare_value(song, other_song);
        if (value1 === 0 && value2 === 0) {
            logc("No score");
            continue;
        }

        let value = (Math.min(value1, value2) / Math.max(value1, value2)) * 100;
        let better = value1 > value2;
        if (better) {
            value = 100 - value;
        }

        if (better) {
            row.style.backgroundImage = `linear-gradient(75deg, var(--color-ahead) ${value}%, rgba(0,0,0,0) ${value}%)`
        } else {
            row.style.backgroundImage = `linear-gradient(105deg, rgba(0,0,0,0) ${value}%, var(--color-behind) ${value}%)`
        }
    }
}

function load_user_cache() {
    let json = localStorage.getItem("users");
    if (!json) {
        user_list = {};
        return;
    }
    try {
        user_list = JSON.parse(json);
    } catch (ex) {
        user_list = {};
        localStorage.setItem("users", "{}");
    }
    logc("Loaded usercache", user_list);
}

function save_user_cache() {
    localStorage.setItem("users", JSON.stringify(user_list));
}

/**
 * @param {string} id
 */
async function fetch_user(id) {
    let page = 1;
    let page_max = undefined;
    let updated = false;

    intor(status_elem, "Adding user to database...");

    let user = user_list[id];
    if (!user) {
        user = {
            name: "User" + id,
            songs: {}
        };
        user_list[id] = user;
    }

    for (; page <= (page_max || 4); page++) {
        intor(status_elem, `Updating page ${page}/${(page_max || "?")}`);
        let doc;
        let tries = 5;
        let sleep = (timeout) => { return new Promise(resolve => setTimeout(resolve, timeout)) };
        while ((!doc || doc.body.textContent === '"Rate Limit Exceeded"') && tries > 0) {
            await sleep(500);
            doc = await fetch_user_page(id, page);
            tries--;
        }

        if (page_max === undefined) {
            let last_page_elem = doc.querySelector("nav ul.pagination-list li:last-child a");
            // weird bug on the scoresaber site:
            // It lists for e.g. 20 pages, but 21 might be needed
            page_max = Number(last_page_elem.innerText) + 1;

            user.name = get_document_user(doc).name;
        }

        let [has_old_entry, has_updated] = process_user_page(doc, user);
        updated = updated || has_updated;
        if (has_old_entry) {
            break;
        }
    }

    // process current page to allow force-updating the current site
    process_user_page(document, user);

    if (updated) {
        save_user_cache();
    }

    intor(status_elem, "User updated");

    on_user_list_changed();
}

/**
 * @param {Document} doc
 * @param {DbUser} user
 */
function process_user_page(doc, user) {
    let has_old_entry = false;
    let has_updated = false;

    let table_row = doc.querySelectorAll("table.ranking.songs tbody tr");
    for (let row of table_row) {
        let [song_id, song] = get_row_data(row);
        if (user.songs[song_id] && user.songs[song_id].time === song.time) {
            has_old_entry = true;
        } else {
            logc("Updated: ", song);
            has_updated = true;
        }

        user.songs[song_id] = song;
    }

    return [has_old_entry, has_updated];
}

/**
 * @param {string} id
 */
function delete_user(id) {
    if (user_list[id]) {
        delete user_list[id];
        save_user_cache();
        on_user_list_changed();
    }
}

/**
 * @param {Element & { cache?: [string, Song] }} row
 * @returns {[string, Song]}
 */
function get_row_data(row) {
    if (row.cache) {
        return row.cache;
    }

    /** @type {HTMLAnchorElement} */
    let leaderboard_elem = row.querySelector("th.song a");
    let pp_elem = row.querySelector("th.score .ppValue");
    let score_elem = row.querySelector("th.score .scoreBottom");
    let time_elem = row.querySelector("th.song .time");

    let song_id = leaderboard_reg.exec(leaderboard_elem.href)[1];
    let pp = Number(pp_elem.innerText);
    let time = time_elem.title;
    let score = undefined;
    let accuracy = undefined;
    let mods = undefined;
    let score_res = score_reg.exec(score_elem.innerText);
    logc(score_res);
    if (score_res[1] === "score") {
        score = number_invariant(score_res[2]);
    } else if (score_res[1] === "accuracy") {
        accuracy = Number(score_res[2]);
    }
    if (score_res[4]) {
        mods = score_res[4].split(/,/g);
    }

    let song = {
        pp,
        time,
        score,
        accuracy,
        mods,
    };
    /** @type {[string, Song]} */
    let data = [song_id, song];
    row.cache = data;
    return data;
}

/**
 * @param {string} id
 * @param {string|number} page
 * @returns {Promise<Document>}
 */
async function fetch_user_page(id, page) {
    let link = scoresaber_link + `/u/${id}&page=${page}&sort=2`;
    if (window.location.href.toLowerCase() === link) {
        logc("Efficient get :P");
        return document;
    }

    logc(`Fetching user ${id} page ${page}`);
    let init_fetch = await (await fetch(link)).text();
    var parser = new DOMParser();
    return parser.parseFromString(init_fetch, 'text/html');
}

// *** Self button ***

function update_self_button() {
    let home_user = get_home_user();
    if (!home_user) {
        home_user = { name: "<Pins>", id: "0" };
    }

    /** @type {HTMLAnchorElement} */
    // @ts-ignore
    let home_elem = document.getElementById("home_user");
    if (home_elem) {
        home_elem.href = scoresaber_link + "/u/" + home_user.id;
        home_elem.innerText = home_user.name;
    } else {
        into(get_navbar(),
            create("div", { class: "navbar-item has-dropdown is-hoverable" },
                create("a", {
                    id: "home_user",
                    class: "navbar-item",
                    href: scoresaber_link + "/u/" + home_user.id
                }, home_user.name),
                create("div", {
                    id: "home_user_list",
                    class: "navbar-dropdown"
                })
            )
        );
        update_self_user_list();
    }
}

function update_self_user_list() {
    let home_user_list_elem = document.getElementById("home_user_list");
    intor(home_user_list_elem,
        ...Object.keys(user_list).map(id => {
            let user = user_list[id];
            return create("a", {
                class: "navbar-item",
                style: {
                    paddingRight: "1em",
                    flexWrap: "nowrap",
                    display: "flex",
                },
                href: scoresaber_link + "/u/" + id,
            },
                create("div", { style: { flex: "1" } }, user.name),
                create("a", {
                    class: "button icon is-medium is-danger is-outlined",
                    style: { marginLeft: "3em" },
                    onclick: () => {
                        swal(`Delete User "${user.name}" from cache?`, {
                            dangerMode: true,
                            buttons: true,
                        }).then((deleteUser) => {
                            logc("DELETE!", deleteUser);
                            if (deleteUser) {
                                delete_user(id);
                            }
                        });
                        return false;
                    }
                },
                    create("i", { class: "fas fa-trash-alt" })
                ),
            );
        })
    );
}

function on_user_list_changed() {
    update_user_compare_dropdown();
    update_self_user_list();
}

function setup_self_pin_button() {
    if (!is_user_page()) { return; }

    let header = get_user_header();
    into(header, create("div", {
        class: "button icon is-medium tooltip",
        style: { cursor: "pointer" },
        onclick: () => {
            set_home_user(get_current_user());
            update_self_button();
        }
    },
        create("i", { class: "fas fa-thumbtack" }),
        create("div", { class: "tooltiptext" }, "Pin this user to your navigation bar")
    ));
}

// ** Wide table ***

function setup_wide_table_checkbox() {
    if (!is_user_page()) { return; }

    let table = document.querySelector("table.ranking.songs");

    table.insertAdjacentElement("beforebegin", create("input", {
        id: "wide_song_table_css",
        type: "checkbox",
        style: { display: "none" },
        checked: get_wide_table(),
    }));
}

// ** Link util **

function setup_user_rank_link_swap() {
    if (!is_user_page()) { return; }

    /** @type {HTMLAnchorElement} */
    let elem_global = document.querySelector(".content div.columns ul li a");
    let res_global = leaderboard_rank_reg.exec(elem_global.innerText);
    let number_global = number_invariant(res_global[1]);
    elem_global.href = scoresaber_link + "/global/" + rank_to_page(number_global, user_per_page_global_leaderboard);
}

function setup_song_rank_link_swap() {
    if (!is_user_page()) { return; }

    let song_elems = document.querySelectorAll("table.ranking.songs tbody tr");
    for (let row of song_elems) {
        let rank_elem = row.querySelector(".rank");
        // @ts-ignore // there's only one link, so 'a' will find it.
        let leaderboard_link = row.querySelector("th.song a").href;
        let rank = number_invariant(rank_elem.innerText.slice(1));
        let rank_str = rank_elem.innerText;
        rank_elem.innerHTML = '';
        into(rank_elem,
            create("a", {
                href: `${leaderboard_link}?page=${rank_to_page(rank, user_per_page_song_leaderboard)}`
            }, rank_str)
        );
    }
}

// ** Settings page **

function setup_settings_page() {
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
            // @ts-ignore
            this.style.display = "none";
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
                                // @ts-ignore
                                settings_set_theme(this.value);
                            }
                        },
                            ...themes.map(name => create("option", { selected: name == current_theme ? "selected" : undefined }, name))
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
                        // @ts-ignore
                        set_wide_table(this.checked);
                        // @ts-ignore
                        document.getElementById("wide_song_table_css").checked = this.checked;
                    }
                }),
                create("label", { for: "wide_song_table", class: "checkbox" }, "Always expand table to full width"),
            ),
            create("div", { class: "field" },
                create("label", {class: "label" }, "Links"),
            ),
            create("div", { class: "field" },
                create("input", {
                    id: "show_bs_link",
                    type: "checkbox",
                    class: "is-checkradio",
                    checked: get_show_bs_link(),
                    onchange: function () {
                        // @ts-ignore
                        set_show_bs_link(this.checked);
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
                        // @ts-ignore
                        set_show_oc_link(this.checked);
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
    )
}

/** @param {string} name */
function settings_set_theme(name) {
    GM_xmlhttpRequest({
        method: "GET",
        headers: {
            "Origin": "unpkg.com",
        },
        url: `https://unpkg.com/bulmaswatch/${name.toLowerCase()}/bulmaswatch.min.css`,
        onload: function (response) {
            let css = response.responseText;
            localStorage.setItem("theme_name", name);
            localStorage.setItem("theme_css", css);
            load_theme(name, css);
        }
    });
}

// *** Theming ***

function load_last_theme() {
    let theme_name = localStorage.getItem("theme_name");
    let theme_css = localStorage.getItem("theme_css");
    if (!theme_name || !theme_css) {
        theme_name = "Default";
        theme_css = "";
    }
    load_theme(theme_name, theme_css);
}

/**
 * @param {string} name
 * @param {string} css */
function load_theme(name, css) {
    let css_fin;
    if (name == "Cyborg" || name == "Darkly" || name == "Nuclear"
        || name == "Slate" || name == "Solar" || name == "Superhero") {
        css_fin = css + " " + theme_dark;
    } else {
        css_fin = css + " " + theme_light
    }
    if (!style_themed_elem) {
        style_themed_elem = GM_addStyle(css_fin);
    } else {
        style_themed_elem.innerHTML = css_fin;
    }
}

function highlight_user() {
    // (No page check, this should work on global and song boards)
    let home_user = get_home_user();
    if (!home_user) { return; }

    let element = document.querySelector(`table.ranking.global a[href='/u/${home_user.id}']`);

    if (element != null) {
        element.parentElement.parentElement.style.backgroundColor = "var(--color-highlight)";
    }
}

// *** Html/Localstore Getter/Setter ***

/** @returns {HTMLHeadingElement} */
function get_user_header() {
    return document.querySelector(".content div.columns h5");
}

/** @returns {HTMLDivElement} */
function get_navbar() {
    return document.querySelector("#navMenu div.navbar-start");
}

function is_user_page() {
    return window.location.href.toLowerCase().startsWith(scoresaber_link + "/u/");
}

function is_song_leaderboard_page() {
    return window.location.href.toLowerCase().startsWith(scoresaber_link + "/leaderboard/");
}

/** @returns {User} */
function get_current_user() {
    if (_current_user) { return _current_user; }
    if (!is_user_page()) { throw new Error("Not on a user page"); }

    _current_user = get_document_user(document);
    return _current_user;
}

/** @param {Document} doc */
function get_document_user(doc) {
    let username_elem = doc.querySelector(".content .title a")
    let user_name = username_elem.innerText.trim();
    // TODO will be wrong when calling from a different page
    let user_id = user_reg.exec(window.location.href)[1];

    return { id: user_id, name: user_name };
}

/** @returns {User | undefined} */
function get_home_user() {
    if (_home_user) { return _home_user; }

    let json = localStorage.getItem("home_user");
    if (!json) {
        return undefined;
    }
    _home_user = JSON.parse(json);
    return _home_user;
}

/** @returns {string | undefined} */
function get_compare_user() {
    if (last_selected) {
        return last_selected;
    }

    let stored_last = localStorage.getItem("last_selected");
    if (stored_last) {
        last_selected = stored_last;
        return last_selected;
    }

    /** @type {HTMLSelectElement} */
    // @ts-ignore
    let compare = document.getElementById("user_compare");
    if (compare && compare.value) {
        last_selected = compare.value;
        return last_selected;
    }
    return undefined;
}

/** @param {string} user */
function set_compare_user(user) {
    update_user_compare_songtable(user);
    last_selected = user;
    localStorage.setItem("last_selected", user);
}

/** @param {User} user */
function set_home_user(user) {
    _home_user = user;
    localStorage.setItem("home_user", JSON.stringify(user));
}

/** @param {boolean} value */
function set_wide_table(value) {
    localStorage.setItem("wide_song_table", value ? "true" : "false");
}

/** @returns {boolean} */
function get_wide_table() {
    return localStorage.getItem("wide_song_table") === "true";
}

/** @param {boolean} value */
function set_show_bs_link(value) {
    localStorage.setItem("show_bs_link", value ? "true" : "false");
}

/** @returns {boolean} */
function get_show_bs_link() {
    return (localStorage.getItem("show_bs_link") || "true") === "true";
}

/** @param {boolean} value */
function set_show_oc_link(value) {
    localStorage.setItem("show_oc_link", value ? "true" : "false");
}

/** @returns {boolean} */
function get_show_oc_link() {
    return (localStorage.getItem("show_oc_link") || "true") === "true";
}


// *** Utility ***

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {(Partial<HTMLElementTagNameMap[K]> | { style?: Partial<CSSStyleDeclaration>}) & { class?: string | string[], selected?: "selected", for?: string }} [attrs]
 * @param {...(HTMLElement | string)} [children]
 * @returns {HTMLElementTagNameMap[K]}
 */
function create(tag, attrs, ...children) {
    if (!tag) throw new SyntaxError("'tag' not defined");

    var ele = document.createElement(tag), attrName, styleName;
    if (attrs) {
        for (attrName in attrs) {
            if (attrName === "style") {
                for (styleName in attrs.style) { ele.style[styleName] = attrs.style[styleName]; }
            }
            else if (attrName === "class") {
                if (typeof attrs.class === "string") {
                    let classes = attrs.class.split(/ /g).filter(c => c.trim().length > 0);
                    ele.classList.add(...classes);
                } else {
                    ele.classList.add(...attrs.class);
                }
            }
            else if (attrName === "for") {
                // @ts-ignore
                ele.htmlFor = attrs[attrName];
            }
            else {
                ele[attrName] = attrs[attrName];
            }
        }
    }

    into(ele, ...children);
    return ele;
}

/**
 * Removes all child elements
 * @param {HTMLElement} elem
 */
function clear_children(elem) {
    while (elem.lastChild) {
        elem.removeChild(elem.lastChild);
    }
}

/**
 * Into, but replaces the content
 * @param {HTMLElement} parent
 * @param {...(HTMLElement | string)} children
 */
function intor(parent, ...children) {
    clear_children(parent);
    return into(parent, ...children);
}

/**
 * Appends the children to the parent
 * @param {HTMLElement} parent
 * @param {...(HTMLElement | string)} children
 */
function into(parent, ...children) {
    for (let child of children) {
        if (typeof child === "string") {
            if (children.length > 1) {
                parent.appendChild(create("div", {}, child));
            } else {
                parent.innerText = child;
            }
        } else {
            parent.appendChild(child);
        }
    }
}

function setup_log() {
    debug = localStorage.getItem("debug") === "true";
}

function logc(message, ...optionalParams) {
    if (debug) {
        console.log(message, ...optionalParams);
    }
}

/**
 * @param {number} num
 * @param {number} [digits]
 * @returns {string}
 */
function format_en(num, digits) {
    if (digits === undefined) digits = 2;
    return num.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * @param {boolean} bool
 * @param {string} css_class
 */
function toggled_class(bool, css_class) {
    return bool ? css_class : "";
}

/**
 * @param {number} rank
 * @param {number} ranks_per_page
 * @returns {number}
 */
function rank_to_page(rank, ranks_per_page) {
    return Math.floor((rank + ranks_per_page - 1) / ranks_per_page);
}

/**
 * @param {Song} song_a
 * @param {Song} song_b
 * @returns {[number, number]}
 */
function get_song_compare_value(song_a, song_b) {
    if (song_a.pp > 0 && song_b.pp) {
        return [song_a.pp, song_b.pp]
    } else if (song_a.score > 0 && song_b.score) {
        return [song_a.score, song_b.score]
    } else if (song_a.accuracy > 0 && song_b.accuracy) {
        return [song_a.accuracy, song_b.accuracy]
    } else {
        return [0, 0];
    }
}

/**
 * @param {string} num
 * @returns {number}
 */
function number_invariant(num) {
    return Number(num.replace(/,/g, ''));
}

/**
 * @param {string} link
 * @returns {string}
 */
function get_id_from_song_link(link) {
    let match = bsaber_link_reg.exec(link);
    if (match) {
        return match[1];
    }
    return "0";
}

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
function fetch2(url) {
    return new Promise(function (resolve, reject) {
        let host = getHostName(url);
        let request_param = {
            method: "GET",
            url: url,
            headers: { "Origin": host },
            onload: (req) => {
                if (req.status >= 200 && req.status < 300) {
                    resolve(req.responseText);
                } else {
                    reject();
                }
            },
            onerror: () => {
                reject();
            }
        };
        GM_xmlhttpRequest(request_param);
    });
}

/**
 * @param {string} url
 * @returns {string | undefined}
 */
function getHostName(url) {
    var match = url.match(/:\/\/([^/:]+)/i);
    if (match && match.length > 1 && typeof match[1] === 'string' && match[1].length > 0) {
        return match[1];
    }
    else {
        return undefined;
    }
}

setup_log();
setup_style();
load_last_theme();
load_user_cache();
window.addEventListener('DOMContentLoaded', function () {
    setup_dl_link_user_site();
    setup_dl_link_leaderboard();
    setup_self_pin_button();
    setup_user_rank_link_swap();
    setup_song_rank_link_swap();
    setup_user_compare();
    update_self_button();
    update_button_visibility();
    setup_wide_table_checkbox();
    setup_settings_page();
    setup_song_filter_tabs();
    highlight_user();
});
