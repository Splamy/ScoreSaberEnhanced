// ==UserScript==
// @name         ScoreSaberEnhanced
// @namespace    https://scoresaber.com
// @version      0.5
// @description  Adds links to beatsaver and add player comparison
// @author       Splamy
// @match        https://scoresaber.com/*
// @grant        none
// @updateURL    https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scorsaber.user.js
// @downloadURL  https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scorsaber.user.js
// @require      https://unpkg.com/mithril/mithril.js
// @require      https://unpkg.com/sweetalert@2.1.2/dist/sweetalert.min.js
// @require      https://beatsaver.com/js/oneclick.js
// ==/UserScript==
// @ts-check
/// <reference path="./mithril.d.ts" />

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

// we cant get the beatsaver song directly so we fetch
// the song version (<id>-<id>) from the leaderboard site with an async
// fetch request.
async function get_id(link) {
    let leaderboard_text = await (await fetch(link)).text();
    let id_result = bsaber_link_reg.exec(leaderboard_text);
    return id_result[1];
}

function logc(message, ...optionalParams) {
    console.log(message, ...optionalParams);
}

function generate_beatsaver_button(click) {
    return m("div", {
        class: "pagination-link",
        style: {
            cursor: "pointer",
        },
        onclick: click,
    }, "🔗");
}

function generate_oneclick_button(click) {
    return m("div", {
        class: "pagination-link",
        style: {
            cursor: "pointer",
        },
        onclick: click,
    }, "💾");
}

function generate_bsaber_button(href) {
    return m("a", {
        class: "pagination-link",
        style: {
            cursor: "pointer",
            backgroundImage: "url(\"https://bsaber.com/wp-content/themes/beastsaber-wp-theme/assets/img/avater-callback.png\")",
            backgroundSize: "contain",
        },
        href: href,
    });
}

function add_dl_link_user_site() {
    // check we are on a user page
    if (!window.location.href.toLowerCase().startsWith(scoresaber_link + "/u/")) {
        return;
    }

    // find the table we want to modify
    let table = document.querySelector("table.ranking.songs");

    // add a new column for our links
    let table_tr = table.querySelector("thead tr");
    let link_row = document.createElement("th");
    link_row.innerText = "BS"
    table_tr.appendChild(link_row);

    // add a link for each song
    let table_row = table.querySelectorAll("tbody tr");
    for (let row of table_row) {
        let table_col_th = document.createElement("th");
        row.appendChild(table_col_th);

        // there's only one link, so 'a' will find it.
        /** @type {HTMLAnchorElement} */
        let leaderboard_elem = row.querySelector("th.song a");
        let leaderboard_link = leaderboard_elem.href;

        // link to the website
        let bs_button = generate_beatsaver_button(async () => {
            let id = await get_id(leaderboard_link);
            window.open(beatsaver_link + id, '_blank');
        });

        // oneclick installer
        let oc_button = generate_oneclick_button(async () => {
            let id = await get_id(leaderboard_link);
            // @ts-ignore
            oneClick(this, id);
        });

        // Add everything into the table
        m.render(table_col_th, [bs_button, oc_button]);
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

    let bs_button = generate_beatsaver_button(() => {
        window.open(beatsaver_link + id, '_blank');
    });

    let oc_button = generate_oneclick_button(() => {
        // @ts-ignore
        oneClick(this, id);
    });

    let details_box = link_element.parentElement;
    let hr_elem = details_box.querySelector("hr");

    let bt_button = generate_bsaber_button(link_element.href);
    let dummy_div = document.createElement("div");
    details_box.removeChild(link_element);
    details_box.insertBefore(dummy_div, hr_elem);
    m.render(dummy_div, [bt_button, bs_button, oc_button]);
}

function add_user_compare() {
    // check we are on a user page
    if (!window.location.href.toLowerCase().startsWith(scoresaber_link + "/u/")) {
        return;
    }

    load_user_cache();

    // find the element we want to modify
    let content = document.querySelector(".content");
    /** @type {HTMLHeadingElement} */
    let header = document.querySelector(".content div.columns h5");
    header.style.display = "flex";
    header.style.alignItems = "center";

    let user_id = user_reg.exec(window.location.href)[1];

    let add_user_elem = document.createElement("div");
    add_user_elem.style.cursor = "pointer";
    add_user_elem.onclick = async () => { await cache_user(user_id); };
    add_user_elem.innerText = "📑";
    header.appendChild(add_user_elem);

    status_elem = document.createElement("div");
    header.appendChild(status_elem);

    let select_elem = content.querySelector("div.select");
    let scores_elem = content.children[1];

    users_elem = document.createElement("div");
    users_elem.style.display = "inline";
    users_elem.style.marginLeft = "1em";
    scores_elem.insertBefore(users_elem, select_elem.nextSibling);

    generate_user_compare_list();
    if (last_selected) {
        update_comparison_list(last_selected);
    }
    //m.mount(content, UserCompare);

    // background-image: linear-gradient(-60deg, lightblue 50%, lime 50%);
}

function generate_user_compare_list() {
    m.render(users_elem,
        m("div", { class: "select" },
            m("select", {
                onchange: function () {
                    last_selected = this.value;
                    localStorage.setItem("last_selected", last_selected);
                    update_comparison_list(last_selected);
                }
            }, ...Object.keys(userDat).map(id => {
                let user = userDat[id];
                if (id == last_selected) {
                    return m("option", { value: id, selected: "selected" }, user.name);
                }
                return m("option", { value: id }, user.name);
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
            continue;
        }

        let value = (Math.min(value1, value2) / Math.max(value1, value2)) * 100;
        let better = value1 > value2;
        if (better) {
            value = 100 - value;
        }

        if (better) {
            row.style.backgroundImage = `linear-gradient(90deg, lawngreen ${value}%, lightgray ${value}%)`
        } else {
            row.style.backgroundImage = `linear-gradient(90deg, lightgray ${value}%, tomato ${value}%)`
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
    } catch {
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

    m.render(status_elem, "Adding user to database...");

    for (; page < (page_max || 512); page++) {
        m.render(status_elem, `Updating page ${page}/${(page_max || "?")}`);
        let page1 = await get_user_page(id, page);

        let table = page1.querySelector("table.ranking.songs");
        if (!table) {
            return;
        }

        if (page_max === undefined) {
            /** @type {HTMLAnchorElement} */
            let last_page_elem = document.querySelector("nav ul.pagination-list li:last-child a");
            page_max = Number(last_page_elem.innerText);
        }

        let user = userDat[id];
        if (!user) {
            user = {
                name: "User" + id,
                songs: {}
            };
            userDat[id] = user;
        }

        /** @type {HTMLAnchorElement} */
        let username_elem = document.querySelector(".content .title a")
        user.name = username_elem.innerText;

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

    m.render(status_elem, "User updated");

    generate_user_compare_list();
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

(function () {
    add_dl_link_user_site();
    add_dl_link_leaderboard();
    add_user_compare();
})();