// ==UserScript==
// @name         ScoreSaber Enhancer
// @namespace    https://scoresaber.com
// @version      0.2
// @description  Adds links to beatsaver and add player comparison
// @author       Splamy
// @match        https://scoresaber.com/*
// @grant        none
// @updateURL    https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scorsaber.user.js
// @downloadURL  https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scorsaber.user.js
// ==/UserScript==
// @ts-check

const scoresaber_link = "https://scoresaber.com";
const beatsaver_link = "https://beatsaver.com/browse/detail/"
const bsaber_link_reg = /https?:\/\/bsaber.com\/songs\/(\d+-\d+)/;

async function get_id(link) {
    let leaderboard_site = await fetch(link);
    let leaderboard_text = await leaderboard_site.text();
    let id_result = bsaber_link_reg.exec(leaderboard_text);
    return id_result[1];
}

function add_dl_link() {
    // check we are on a user page
    if (!window.location.href.toLowerCase().startsWith(scoresaber_link + "/u/")) {
        return;
    }

    // find the table we want to modify;
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

        // link to the website
        let bs_button = document.createElement("div");
        bs_button.style.cursor = "pointer";
        bs_button.classList.add("pagination-link");
        bs_button.innerText = "🔗";
        // there's only one link, so 'a' will find it.
        /** @type {HTMLAnchorElement} */
        let leaderboard_elem = row.querySelector("th.song a");
        let leaderboard_link = leaderboard_elem.href;
        // we cant get the beatsaver song directly so we fetch
        // the song version (<id>-<id>) from the leaderboard site with an async
        // fetch request when the user clicks.
        bs_button.onclick = async () => {
            let id = await get_id(leaderboard_link);
            window.open(beatsaver_link + id, '_blank');
        }

        // oneclick installer
        let oc_button = document.createElement("div");
        oc_button.style.cursor = "pointer";
        oc_button.classList.add("pagination-link");
        oc_button.innerText = "💾";
        oc_button.onclick = async () => {
            let id = await get_id(leaderboard_link);
            // @ts-ignore
            oneClick(this, id);
        }

        // Add everything into the table
        table_col_th.appendChild(bs_button);
        table_col_th.appendChild(oc_button);
        row.appendChild(table_col_th);
    }
}

function include_one_click_installer() {
    let scriptSwal = document.createElement('script');
    scriptSwal.src = "https://unpkg.com/sweetalert@2.1.2/dist/sweetalert.min.js";
    document.head.appendChild(scriptSwal);

    let scriptOc = document.createElement('script');
    //scriptOc.type = "text/babel";
    scriptOc.src = "https://beatsaver.com/js/oneclick.js";
    document.head.appendChild(scriptOc);
}

(function () {
    include_one_click_installer();
    add_dl_link();
})();