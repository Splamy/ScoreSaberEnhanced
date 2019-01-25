// ==UserScript==
// @name         ScoreSaber Enhancer
// @namespace    https://scoresaber.com
// @version      0.1
// @description  Adds links to beatsaver and add player comparison
// @author       Splamy
// @match        https://scoresaber.com/*
// @grant        none
// ==/UserScript==
// @ts-check

const scoresaber_link = "https://scoresaber.com";
const beatsaver_link = "https://beatsaver.com/browse/detail/"
const bsaber_link_reg = /https?:\/\/bsaber.com\/songs\/(\d+-\d+)/;

function main() {
    add_dl_link();
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
    let bs_link = document.createElement("div");
        bs_link.style.cursor = "pointer";
        bs_link.classList.add("pagination-link");
        bs_link.innerText = "🔗";
        // there's only one link, so 'a' will find it.
        /** @type {HTMLAnchorElement} */
        let leaderboard_link = row.querySelector("th.song a");
        // we cant get the beatsaver song directly so we fetch
        // the song version (<id>-<id>) from the leaderboard site with an async
        // fetch request when the user clicks.
        bs_link.onclick = async () => {
            //console.log("Accessing ", leaderboard_link.href);
            let leaderboard_site = await fetch(leaderboard_link.href);
            let leaderboard_text = await leaderboard_site.text();
            //console.log("Got ", leaderboard_text);
            let id_result = bsaber_link_reg.exec(leaderboard_text);
            let id = id_result[1];
            //console.log(id);
            window.open(beatsaver_link + id, '_blank');
            return false;
        }

        table_col_th.appendChild(bs_link);
        row.appendChild(table_col_th);
    }

    // direkt download 💾
}

main();