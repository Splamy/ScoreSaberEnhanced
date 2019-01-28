// ==UserScript==
// @name         ScoreSaberEnhanced
// @namespace    https://scoresaber.com
// @version      0.9
// @description  Adds links to beatsaver and add player comparison
// @author       Splamy
// @match        https://scoresaber.com/*
// @grant        none
// @icon         https://scoresaber.com/imports/images/logo.ico
// @updateURL    https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scorsaber.user.js
// @downloadURL  https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scorsaber.user.js
// @require      https://unpkg.com/sweetalert@2.1.2/dist/sweetalert.min.js
// @require      https://beatsaver.com/js/oneclick.js
// ==/UserScript==
// @ts-check

const scoresaber_link = "https://scoresaber.com";
const beatsaver_link = "https://beatsaver.com/browse/detail/"
const bsaber_link_reg = /https?:\/\/bsaber.com\/songs\/(\d+-\d+)/;
const score_reg = /(score|accuracy):\s+([\d\.,]+)%?/;
const leaderboard_reg = /leaderboard\/(\d+)/;
const user_reg = /u\/(\d+)/;

/** @type {{ [user_id: string]: { name: string, songs: {[song_id: string]: { time: string, pp:number, accuracy?: number, score?: number } } }}} */
let userDat;
let status_elem;
let users_elem;
/** @type {string} */
let last_selected;
let debug = false;

// Cache
/** @type {{ id: string, name: string }} */
let _current_user;
/** @type {{ id: string, name: string }} */
let _home_user;
// ~Cache

// *** Buttons and styles ***

function generate_beatsaver_button(click, compact) {
    return create("div", {
        class: ["pagination-link", compact ? "compact" : undefined],
        style: {
            cursor: "pointer",
        },
        onclick: click,
    }, "🔗");
}

function generate_oneclick_button(click, compact) {
    return create("div", {
        class: ["pagination-link", compact ? "compact" : undefined],
        style: {
            cursor: "pointer",
        },
        onclick: click,
    }, "💾");
}

function generate_bsaber_button(href) {
    return create("a", {
        class: "pagination-link",
        style: {
            cursor: "pointer",
            backgroundImage: "url(\"https://bsaber.com/wp-content/themes/beastsaber-wp-theme/assets/img/avater-callback.png\")",
            backgroundSize: "contain",
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
    }`;
    into(document.head, style);
}

// *** Injection and generation ***

// *** Download Buttons ***

function add_dl_link_user_site() {
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
                    let id = await get_id(leaderboard_link);
                    window.open(beatsaver_link + id, '_blank');
                }, true)
            )
        );

        // oneclick installer
        into(row,
            create("th", { class: "compact" },
                generate_oneclick_button(async () => {
                    let id = await get_id(leaderboard_link);
                    // @ts-ignore
                    oneClick(this, id);
                }, true)
            )
        );
    }
}

function add_dl_link_leaderboard() {
    // check we are on a leaderboard page
    if (!window.location.href.toLowerCase().startsWith(scoresaber_link + "/leaderboard/")) {
        return;
    }

    // find the element we want to modify
    /** @type {HTMLAnchorElement} */
    let link_element = document.querySelector("h4.is-4 + div > a");

    let id = bsaber_link_reg.exec(link_element.href)[1];

    let details_box = link_element.parentElement;
    let hr_elem = details_box.querySelector("hr");

    details_box.removeChild(link_element);
    details_box.insertBefore(
        create("div", {},
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

async function get_id(link) {
    // we cant get the beatsaver song directly so we fetch
    // the song version (<id>-<id>) from the leaderboard site with an async
    // fetch request.
    let leaderboard_text = await (await fetch(link)).text();
    let id_result = bsaber_link_reg.exec(leaderboard_text);
    return id_result[1];
}

// *** User compare ***

function add_user_compare() {
    if (!is_user_page()) { return; }

    load_user_cache();

    // find the element we want to modify
    let content = document.querySelector(".content");
    let header = get_user_header();
    header.style.display = "flex";
    header.style.alignItems = "center";

    into(header,
        create("div", {
            style: { cursor: "pointer" },
            onclick: async () => { await cache_user(get_current_user().id); },
        }, "📑")
    );

    status_elem = create("div", {});
    into(header, status_elem);

    let select_elem = content.querySelector("div.select");
    let scores_elem = content.children[1];

    users_elem = create("div", {
        style: {
            display: "inline",
            marginLeft: "1em"
        }
    });
    scores_elem.insertBefore(users_elem, select_elem.nextSibling);

    generate_user_compare_dropdown();
    if (last_selected) {
        update_comparison_list(last_selected);
    }
}

function generate_user_compare_dropdown() {
    intor(users_elem,
        create("div", { class: "select" },
            create("select", {
                onchange: function () {
                    // @ts-ignore
                    last_selected = this.value;
                    localStorage.setItem("last_selected", last_selected);
                    update_comparison_list(last_selected);
                }
            }, ...Object.keys(userDat).map(id => {
                let user = userDat[id];
                if (id == last_selected) {
                    return create("option", { value: id, selected: "selected" }, user.name);
                }
                return create("option", { value: id }, user.name);
            }))
        )
    );
}

function update_comparison_list(other_user) {
    let other_data = userDat[other_user];
    if (!other_data) {
        logc("Other user not found: ", other_user); // Try update?
        return;
    }

    let table = document.querySelector("table.ranking.songs");
    /** @type {NodeListOf<HTMLElement>} */
    let table_row = table.querySelectorAll("tbody tr");
    for (let row of table_row) {
        // reset style
        row.style.backgroundImage = "";

        let [song_id, song] = get_row_data(row);
        let other_song = other_data.songs[song_id];
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
        userDat = {};
        return;
    }
    try {
        userDat = JSON.parse(json);
    } catch (ex) {
        userDat = {};
        localStorage.setItem("users", "{}");
    }
    last_selected = localStorage.getItem("last_selected");
    logc("Loaded usercache", userDat);
}

async function cache_user(id) {
    let page = 1;
    let page_max = undefined;
    let updated = false;

    intor(status_elem, "Adding user to database...");

    for (; page <= (page_max || 512); page++) {
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

        let user = userDat[id];
        if (!user) {
            user = {
                name: "User" + id,
                songs: {}
            };
            userDat[id] = user;
        }

        user.name = get_current_user().name;

        let table_row = table.querySelectorAll("tbody tr");
        for (let row of table_row) {

            let [song_id, song] = get_row_data(row);
            if (user.songs[song_id] && user.songs[song_id].time === song.time) {
                logc("User cache up to date");
                break;
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
        localStorage.setItem("users", JSON.stringify(userDat));
    }

    intor(status_elem, "User updated");

    generate_user_compare_dropdown();
}

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
    let data = [song_id, song];
    row.cache = data;
    return data;
}

async function get_user_page(id, page) {
    let link = scoresaber_link + `/u/${id}&page=${page}&sort=2`;
    if (window.location.href.toLowerCase() === link) {
        logc("Efficient get :P");
        return document;
    }

    let init_fetch = await (await fetch(link)).text();
    var parser = new DOMParser();
    return parser.parseFromString(init_fetch, 'text/html');
}

// *** Self button ***

function add_self_button() {
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
                create("div", { class: "navbar-dropdown" },
                    ...Object.keys(userDat).map(id => {
                        let user = userDat[id];
                        return create("a", { class: "navbar-item", href: scoresaber_link + "/u/" + id }, user.name);
                    })
                )
            )
        );
    }
}

function add_self_pin_button() {
    if (!is_user_page()) { return; }

    let header = get_user_header();
    into(header, create("div", {
        style: {
            cursor: "pointer",
        },
        onclick: () => {
            set_home_user(get_current_user());
            add_self_button();
        }
    }, "📌"));
}

function setup_self() {
    add_self_button();
    add_self_pin_button();
}

// *** Html Getter ***

/**
 * @return {HTMLHeadingElement}
 */
function get_user_header() {
    return document.querySelector(".content div.columns h5");
}

function is_user_page() {
    return window.location.href.toLowerCase().startsWith(scoresaber_link + "/u/");
}

/** @return { { id: string, name: string }} */
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

/** @return {{ id: string, name: string } | undefined} */
function get_home_user() {
    if (_home_user) { return _home_user; }

    let json = localStorage.getItem("home_user");
    if (!json) {
        return undefined;
    }
    _home_user = JSON.parse(json);
    return _home_user;
}

/** @param {{ id: string, name: string }} user */
function set_home_user(user) {
    _home_user = user;
    localStorage.setItem("home_user", JSON.stringify(user));
}

// *** Utility ***

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {(Partial<HTMLElementTagNameMap[K]> | { style?: Partial<CSSStyleDeclaration>}) & { class?: string|string[], selected?: "selected" }} attrs
 * @param {...(HTMLElement|string)} children
 * @return {HTMLElementTagNameMap[K]}
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
 * @param {...(HTMLElement|string)} children
 */
function intor(parent, ...children) {
    for (let child of parent.children) {
        parent.removeChild(child);
    }
    return into(parent, ...children);
}

/**
 * Appends the children to the parent
 * @param {HTMLElement} parent
 * @param {...(HTMLElement|string)} children
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
    let is_debug = localStorage.getItem("debug");
    debug = is_debug === "true";
}

function logc(message, ...optionalParams) {
    console.log(message, ...optionalParams);
}

(function () {
    setup_log();
    setup_style();
    add_dl_link_user_site();
    add_dl_link_leaderboard();
    add_user_compare();
    setup_self();
})();