// ==UserScript==
// @name         ScoreSaber Enhancer
// @namespace    https://scoresaber.com
// @version      0.3
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

const scoresaber_link = "https://scoresaber.com";
const beatsaver_link = "https://beatsaver.com/browse/detail/"
const bsaber_link_reg = /https?:\/\/bsaber.com\/songs\/(\d+-\d+)/;

// we cant get the beatsaver song directly so we fetch
// the song version (<id>-<id>) from the leaderboard site with an async
// fetch request.
async function get_id(link) {
    let leaderboard_site = await fetch(link);
    let leaderboard_text = await leaderboard_site.text();
    let id_result = bsaber_link_reg.exec(leaderboard_text);
    return id_result[1];
}

function generate_beatsaver_button() {
    return m("div", {
        class: "pagination-link",
        style: {
            cursor: "pointer",
        }
    }, "🔗");
}

function generate_oneclick_button() {
    return m("div", {
        class: "pagination-link",
        style: {
            cursor: "pointer",
        }
    }, "💾");
}

function generate_bsaber_button() {
    return m("a", {
        class: "pagination-link",
        style: {
            cursor: "pointer",
            backgroundImage: "url(\"https://bsaber.com/wp-content/themes/beastsaber-wp-theme/assets/img/avater-callback.png\")",
            backgroundSize: "contain",
        }
    });
}

function add_dl_link_user_site() {
    // check we are on a user page
    if (!window.location.href.toLowerCase().startsWith(scoresaber_link + "/u/")) {
        return;
    }

    // find the table we want to modify
    let table = document.querySelector("table.ranking.songs");
    if (!table) {
        return;
    }

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
        let bs_button = generate_beatsaver_button();
        bs_button.onclick = async () => {
            let id = await get_id(leaderboard_link);
            window.open(beatsaver_link + id, '_blank');
        }

        // oneclick installer
        let oc_button = generate_oneclick_button();
        oc_button.onclick = async () => {
            let id = await get_id(leaderboard_link);
            // @ts-ignore
            oneClick(this, id);
        }

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
    if (!link_element) {
        return;
    }

    let id = bsaber_link_reg.exec(link_element.href)[1];

    let bs_button = generate_beatsaver_button();
    bs_button.onclick = () => {
        window.open(beatsaver_link + id, '_blank');
    }

    let oc_button = generate_oneclick_button();
    oc_button.onclick = () => {
        // @ts-ignore
        oneClick(this, id);
    }

    let details_box = link_element.parentElement;
    let hr_elem = details_box.querySelector("hr");

    let bt_button = generate_bsaber_button();
    bt_button.href = link_element.href;
    let dummy_div = document.createElement("div");
    details_box.removeChild(link_element);
    details_box.insertBefore(dummy_div, hr_elem);
    m.render(dummy_div, [ bt_button, oc_button, bs_button ]);
}

var UserCompare = {
    view: function () {
        return m('h1', 'Hello, World!');
    }
}

function add_user_compare() {
    // check we are on a user page
    if (!window.location.href.toLowerCase().startsWith(scoresaber_link + "/u/")) {
        return;
    }

    // find the element we want to modify
    let content = document.querySelector("div.content");
    if (!content) {
        return;
    }

    let userBox = document.createElement("div");
    userBox.classList.add("box", "has-shadow", "has-text-centered");

    m.mount(content, UserCompare);

    content.appendChild(userBox);
}

function cache_user(id) {
    // https://scoresaber.com/u/76561198030404325&page=1&sort=2
}

(function () {
    add_dl_link_user_site();
    add_dl_link_leaderboard();
    //add_user_compare();
})();