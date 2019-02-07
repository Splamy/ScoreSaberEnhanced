// ==UserScript==
// @name         ScoreSaberEnhanced
// @namespace    https://scoresaber.com
// @version      0.16
// @description  Adds links to beatsaver and add player comparison
// @author       Splamy
// @match        http*://scoresaber.com/*
// @grant        none
// @icon         https://scoresaber.com/imports/images/logo.ico
// @updateURL    https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scorsaber.user.js
// @downloadURL  https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scorsaber.user.js
// @require      https://unpkg.com/sweetalert@2.1.2/dist/sweetalert.min.js
// @require      https://beatsaver.com/js/oneclick.js
// ==/UserScript==
// @ts-check

/**
 * @typedef {{ time: string, pp:number, accuracy?: number, score?: number }} Song
 * @typedef {{ id: string, name: string }} User
 */

"use strict";
const scoresaber_link = "https://scoresaber.com";
const beatsaver_link = "https://beatsaver.com/browse/detail/"
const bsaber_link_reg = /https?:\/\/bsaber.com\/songs\/(\d+-\d+)/;
const score_reg = /(score|accuracy):\s+([\d\.,]+)%?/;
const leaderboard_reg = /leaderboard\/(\d+)/;
const user_reg = /u\/(\d+)/;

/** @type {{ [user_id: string]: { name: string, songs: {[song_id: string]: Song } }}} */
let user_list;
let status_elem;
let users_elem;
/** @type {string} */
let last_selected;
let debug = false;

// Cache
/** @type {User} */
let _current_user;
/** @type {User} */
let _home_user;

// *** Buttons and styles ***

/**
 * @param {(this: GlobalEventHandlers, ev: MouseEvent) => any} click
 * @param {boolean} compact
 * @returns {HTMLElement}
 */
function generate_beatsaver_button(click, compact) {
    return create("div", {
        class: "button is-normal fas_big beatsaver_bg" + (compact ? " compact" : ""),
        style: {
            cursor: "pointer",
        },
        onclick: click,
    });
}

/**
 * @param {(this: GlobalEventHandlers, ev: MouseEvent) => any} click
 * @param {boolean} compact
 * @returns {HTMLElement}
 */
function generate_oneclick_button(click, compact) {
    return create("div", {
        class: "button is-normal fas_big fas fa-cloud-download-alt" + (compact ? " compact" : ""),
        style: {
            cursor: "pointer",
        },
        onclick: click,
    });
}

/**
 * @param {string} href
 * @returns {HTMLElement}
 */
function generate_bsaber_button(href) {
    return create("a", {
        class: "button is-normal",
        style: {
            cursor: "pointer",
            backgroundImage: "url(\"https://bsaber.com/wp-content/themes/beastsaber-wp-theme/assets/img/avater-callback.png\")",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            minWidth: "2.5em",
        },
        href: href,
    });
}

function setup_style() {
    let style = create("style", { type: "text/css" });
    style.innerHTML = `.compact {
        padding-right: 0 !important;
        padding-left: 0 !important;
        margin-left: 0px !important;
        margin-right: 0px !important;
        text-align: center !important;
    }
    h5 > * {
        margin-right: 0.3em;
    }
    #wide_song_table:checked ~ .ranking.songs table{
        max-width: unset !important;
    }
    .beatsaver_bg {
        background: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200' version='1.1'%3E%3Cg fill='none' stroke='%23000000' stroke-width='10'%3E %3Cpath d='M 100,7 189,47 100,87 12,47 Z' stroke-linejoin='round'/%3E %3Cpath d='M 189,47 189,155 100,196 12,155 12,47' stroke-linejoin='round'/%3E %3Cpath d='M 100,87 100,196' stroke-linejoin='round'/%3E %3Cpath d='M 26,77 85,106 53,130 Z' stroke-linejoin='round'/%3E %3C/g%3E %3C/svg%3E") no-repeat center/80%;
        background-color: white;
    }
    .fas_big {
        line-height: 150%;
        padding-right: 0.5em;
        padding-left: 0.5em;
        min-width: 2.25em;
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
        margin-left: 0.5em;
    }
    `;
    into(document.head, style);
    into(document.head, create("link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/bulma-checkradio/dist/css/bulma-checkradio.min.css" }));
}

// *** Injection and generation ***

// *** Download Buttons ***

function setup_dl_link_user_site() {
    if (!is_user_page()) { return; }

    // find the table we want to modify
    let table = document.querySelector("table.ranking.songs");

    // add a new column for our links
    /** @type {HTMLTableRowElement} */
    let table_tr = table.querySelector("thead tr");
    into(table_tr, create("th", { class: "compact" }, "BS"));
    into(table_tr, create("th", { class: "compact" }, "OC"));

    // add a link for each song
    /** @type {NodeListOf<HTMLTableRowElement>} */
    let table_row = table.querySelectorAll("tbody tr");
    for (let row of table_row) {
        // there's only one link, so 'a' will find it.
        /** @type {HTMLAnchorElement} */
        let leaderboard_elem = row.querySelector("th.song a");
        let leaderboard_link = leaderboard_elem.href;

        // link to the website
        into(row,
            create("th", { class: "compact" },
                generate_beatsaver_button(async () => {
                    let id = await fetch_id(leaderboard_link);
                    window.open(beatsaver_link + id, '_blank');
                }, true)
            )
        );

        // oneclick installer
        into(row,
            create("th", { class: "compact" },
                generate_oneclick_button(async () => {
                    let id = await fetch_id(leaderboard_link);
                    // @ts-ignore
                    oneClick(this, id);
                }, true)
            )
        );
    }
}

function setup_dl_link_leaderboard() {
    if (!is_song_leaderboard_page()) { return; }

    // find the element we want to modify
    /** @type {HTMLAnchorElement} */
    let link_element = document.querySelector("h4.is-4 + div > a");

    let id = bsaber_link_reg.exec(link_element.href)[1];

    let details_box = link_element.parentElement;
    let hr_elem = details_box.querySelector("hr");

    details_box.removeChild(link_element);
    details_box.insertBefore(
        create("div", {
            id: "leaderboard_tool_strip"
        },
            generate_bsaber_button(link_element.href),
            generate_beatsaver_button(() => {
                window.open(beatsaver_link + id, '_blank');
            }, false),
            generate_oneclick_button(() => {
                // @ts-ignore
                oneClick(this, id);
            }, false)
        ), hr_elem);
}

/**
 * @param {string} link
 * @returns {Promise<string>}
 */
async function fetch_id(link) {
    // we cant get the beatsaver song directly so we fetch
    // the song version (<id>-<id>) from the leaderboard site with an async
    // fetch request.
    let leaderboard_text = await (await fetch(link)).text();
    let id_result = bsaber_link_reg.exec(leaderboard_text);
    return id_result[1];
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
            class: "button is-normal tooltip fas_big fas " + (user_list[user.id] ? "fa-sync" : "fa-bookmark"),
            style: { cursor: "pointer" },
            onclick: async () => {
                await fetch_user(get_current_user().id);
                update_user_compare_songtable_default();
            },
        },
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
                if (id === compare) {
                    return create("option", { value: id, selected: "selected" }, user.name);
                }
                return create("option", { value: id }, user.name);
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
    /** @type {NodeListOf<HTMLElement>} */
    let table_row = table.querySelectorAll("tbody tr");
    for (let row of table_row) {
        // reset style
        row.style.backgroundImage = "";

        let [song_id, song] = get_row_data(row);
        let other_song = other_data.songs[song_id];

        // add score column
        /** @type {string | HTMLElement} */
        let other_score_content = "";
        if (other_song) {
            other_score_content = create("div", {},
                create("span", { class: "scoreTop ppValue" }, `${format_en(other_song.pp)}pp`),
                create("br"),
                other_song.accuracy
                    ? create("span", { class: "scoreBottom" }, `accuracy: ${format_en(other_song.accuracy)}%`)
                    : other_song.score
                        ? create("span", { class: "scoreBottom" }, `score: ${format_en(other_song.score)}`)
                        : "<No Data>",
                // create("span", { class: "songBottom time" }, other_song.time) // TODO: Date formatting
            );
        }
        row.querySelector(".score").insertAdjacentElement("afterend", create("th", { class: "comparisonScore" }, other_score_content));

        if (!other_song) {
            logc("No match");
            row.style.backgroundImage = `linear-gradient(0deg, rgb(240, 240, 240) 0%, rgb(240, 240, 240) 0%)`;
            continue;
        }

        let value1;
        let value2;
        if (song.pp > 0) {
            value1 = song.pp;
            value2 = other_song.pp;
        } else if (song.score > 0) {
            value1 = song.score;
            value2 = other_song.score;
        } else if (song.accuracy > 0) {
            value1 = song.accuracy;
            value2 = other_song.accuracy;
        } else {
            logc("No score");
            continue;
        }

        let value = (Math.min(value1, value2) / Math.max(value1, value2)) * 100;
        let better = value1 > value2;
        if (better) {
            value = 100 - value;
        }

        // light gray?: rgb(240, 240, 240)
        if (better) {
            row.style.backgroundImage = `linear-gradient(75deg, rgb(128, 255, 128) ${value}%, rgba(0,0,0,0) ${value}%)`
        } else {
            row.style.backgroundImage = `linear-gradient(105deg, rgba(0,0,0,0) ${value}%, rgb(255, 128, 128) ${value}%)`
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

    scan: for (; page <= (page_max || 512); page++) {
        intor(status_elem, `Updating page ${page}/${(page_max || "?")}`);
        let page1 = await get_user_page(id, page);

        let table = page1.querySelector("table.ranking.songs");
        if (!table) {
            return;
        }

        if (page_max === undefined) {
            /** @type {HTMLAnchorElement} */
            let last_page_elem = document.querySelector("nav ul.pagination-list li:last-child a");
            // weird bug on the scoresaber site:
            // It lists for e.g. 20 pages, but 21 might be needed
            page_max = Number(last_page_elem.innerText) + 1;
        }

        let user = user_list[id];
        if (!user) {
            user = {
                name: "User" + id,
                songs: {}
            };
            user_list[id] = user;
        }

        user.name = get_current_user().name;

        let table_row = table.querySelectorAll("tbody tr");
        for (let row of table_row) {
            let [song_id, song] = get_row_data(row);
            if (user.songs[song_id] && user.songs[song_id].time === song.time) {
                logc("User cache up to date");
                break scan;
            }

            logc("Updated: ", song);
            user.songs[song_id] = song;
            updated = true;
        }

        if (!updated) {
            break;
        }
    }

    if (updated) {
        save_user_cache();
    }

    intor(status_elem, "User updated");

    on_user_list_changed();
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
    /** @type {HTMLSpanElement} */
    let pp_elem = row.querySelector("th.score .ppValue");
    /** @type {HTMLSpanElement} */
    let score_elem = row.querySelector("th.score .scoreBottom");
    /** @type {HTMLSpanElement} */
    let time_elem = row.querySelector("th.song .time");

    let song_id = leaderboard_reg.exec(leaderboard_elem.href)[1];
    let pp = Number(pp_elem.innerText);
    let time = time_elem.title;
    let score = undefined;
    let accuracy = undefined;
    let score_res = score_reg.exec(score_elem.innerText);
    if (score_res[1] === "score") {
        score = Number(score_res[2].replace(/,/g, ''));
    } else if (score_res[1] === "accuracy") {
        accuracy = Number(score_res[2]);
    }

    let song = {
        pp,
        time,
        score,
        accuracy
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
async function get_user_page(id, page) {
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
        /** @type {HTMLDivElement} */
        let navbar_elem = document.querySelector("#navMenu div.navbar-start");

        into(navbar_elem,
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
                    class: "button is-small",
                    style: { marginLeft: "3em" },
                    onclick: () => {
                        // @ts-ignore
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
                }, "❌"),
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
        class: "button is-normal tooltip fas_big fas fa-thumbtack",
        style: { cursor: "pointer", },
        onclick: () => {
            set_home_user(get_current_user());
            update_self_button();
        }
    },
        create("div", { class: "tooltiptext" }, "Pin this user to your navigation bar")
    ));
}

// ** Wide table ***

function setup_wide_table_checkbox() {
    if (!is_user_page()) { return; }

    let table = document.querySelector("div.ranking.songs");

    table.insertAdjacentElement("beforebegin", create("input", {
        id: "wide_song_table",
        type: "checkbox",
        class: "is-checkradio",
        checked: get_wide_table(),
        onchange: function () {
            // @ts-ignore
            set_wide_table(this.checked);
        }
    }));
    table.insertAdjacentElement("beforebegin", create("label", { class: "checkbox", for: "wide_song_table" }, "Wide Table"));
}

// *** Html/Localstore Getter/Setter ***

/**
 * @returns {HTMLHeadingElement}
 */
function get_user_header() {
    return document.querySelector(".content div.columns h5");
}

function is_user_page() {
    return window.location.href.toLowerCase().startsWith(scoresaber_link + "/u/");
}

function is_song_leaderboard_page() {
    return window.location.href.toLowerCase().startsWith(scoresaber_link + "/leaderboard/");
}

/** @returns {{ id: string, name: string }} */
function get_current_user() {
    if (_current_user) { return _current_user; }
    if (!is_user_page()) { throw new Error("Not on a user page"); }

    /** @type {HTMLAnchorElement} */
    let username_elem = document.querySelector(".content .title a")
    let user_name = username_elem.innerText;
    let user_id = user_reg.exec(window.location.href)[1];

    _current_user = { id: user_id, name: user_name };
    return _current_user;
}

/** @returns {{ id: string, name: string } | undefined} */
function get_home_user() {
    if (_home_user) { return _home_user; }

    let json = localStorage.getItem("home_user");
    if (!json) {
        return undefined;
    }
    _home_user = JSON.parse(json);
    return _home_user;
}

/** @returns {string|undefined} */
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

/** @param {{ id: string, name: string }} user */
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
                    ele.classList.add(...attrs.class.split(/ /g));
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
 * Into, but replaces the content
 * @param {HTMLElement} parent
 * @param {...(HTMLElement | string)} children
 */
function intor(parent, ...children) {
    while (parent.lastChild) {
        parent.removeChild(parent.lastChild);
    }
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
 * @returns {string}
 */
function format_en(num) {
    return num.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

(function () {
    setup_log();
    setup_style();
    load_user_cache();
    setup_dl_link_user_site();
    setup_dl_link_leaderboard();
    setup_self_pin_button();
    setup_user_compare();
    update_self_button();
    setup_wide_table_checkbox();
})();
