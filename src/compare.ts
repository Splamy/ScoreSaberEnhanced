import { is_user_page, get_user_header, get_current_user, get_compare_user, get_document_user, set_compare_user } from "./env";
import { into, create, intor } from "./util/dom";
import g from "./global";
import { check } from "./util/err";
import { logc } from "./log";
import { get_song_compare_value } from "./util/song";
import { format_en, number_invariant } from "./util/format";
import { ISong, IDbUser } from "./declarations/Types";
import * as usercache from "./usercache";
import { update_pp_distribution_graph } from "./ppgraph";

export function setup_user_compare() {
    if (!is_user_page()) { return; }

    // find the element we want to modify
    let content = check(document.querySelector(".content"));
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
            create("i", { class: ["fas", g.user_list[user.id] ? "fa-sync" : "fa-bookmark"] }),
            create("div", { class: "tooltiptext" }, g.user_list[user.id] ? "Update score cache" : "Add user to your score cache")
        )
    );

    g.status_elem = create("div");
    into(header, g.status_elem);

    g.users_elem = create("div", {
        style: {
            display: "inline",
            marginLeft: "1em"
        }
    });
    check(content.querySelector("div.select")).insertAdjacentElement("afterend", g.users_elem);

    update_user_compare_dropdown();
    update_user_compare_songtable_default();
}

export function update_user_compare_dropdown() {
    if (!is_user_page()) { return; }

    let compare = get_compare_user();
    intor(g.users_elem,
        create("div", { class: "select" },
            create("select", {
                id: "user_compare",
                onchange: function () {
                    set_compare_user((this as HTMLSelectElement).value);
                    on_user_compare_changed();
                }
            }, ...Object.keys(g.user_list).map(id => {
                let user = g.user_list[id];
                return create("option", { value: id, selected: id === compare }, user.name);
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

export function update_user_compare_songtable(other_user: string) {
    if (!is_user_page()) { return; }

    let other_data = g.user_list[other_user];
    if (!other_data) {
        logc("Other user not found: ", other_user); // Try update?
        return;
    }

    let table = check(document.querySelector("table.ranking.songs"));

    // Reload table data
    table.querySelectorAll(".comparisonScore").forEach(el => el.remove());

    const ranking_table_header = check(table.querySelector("thead > tr"));
    check(ranking_table_header.querySelector(".score")).insertAdjacentElement("afterend", create("th", { class: "comparisonScore" }, other_data.name));

    // Update table
    let table_row = table.querySelectorAll("tbody tr");
    for (let row of table_row) {
        // reset style
        row.style.backgroundImage = "unset";

        let [song_id, song] = get_row_data(row);
        let other_song = other_data.songs[song_id];

        // add score column
        let other_score_content: string | HTMLElement;
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
        check(row.querySelector(".score")).insertAdjacentElement("afterend", create("th", { class: "comparisonScore" }, other_score_content));

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
            row.style.backgroundImage = `linear-gradient(75deg, var(--color-ahead) ${value}%, rgba(0,0,0,0) ${value}%)`;
        } else {
            row.style.backgroundImage = `linear-gradient(105deg, rgba(0,0,0,0) ${value}%, var(--color-behind) ${value}%)`;
        }
    }
}


function get_row_data(row: Element & { cache?: [string, ISong]; }): [string, ISong] {
    if (row.cache) {
        return row.cache;
    }

    let leaderboard_elem = check(row.querySelector<HTMLAnchorElement>("th.song a"));
    let pp_elem = check(row.querySelector("th.score .ppValue"));
    let score_elem = check(row.querySelector("th.score .scoreBottom"));
    let time_elem = check(row.querySelector("th.song .time"));

    let song_id = g.leaderboard_reg.exec(leaderboard_elem.href)![1];
    let pp = Number(pp_elem.innerText);
    let time = time_elem.title;
    let score = undefined;
    let accuracy = undefined;
    let mods = undefined;
    let score_res = check(g.score_reg.exec(score_elem.innerText));
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
    let data: [string, ISong] = [song_id, song];
    row.cache = data;
    return data;
}

async function fetch_user(id: string) {
    let page = 1;
    let page_max = undefined;
    let updated = false;

    intor(g.status_elem, "Adding user to database...");

    let user = g.user_list[id];
    if (!user) {
        user = {
            name: "User" + id,
            songs: {}
        };
        g.user_list[id] = user;
    }

    for (; page <= (page_max || 4); page++) {
        intor(g.status_elem, `Updating page ${page}/${(page_max || "?")}`);
        let doc: Document | undefined;
        let tries = 5;
        let sleep = (timeout: number) => { return new Promise(resolve => setTimeout(resolve, timeout)); };
        while ((!doc || doc.body.textContent === '"Rate Limit Exceeded"') && tries > 0) {
            await sleep(500);
            doc = await fetch_user_page(id, page);
            tries--;
        }

        if (doc == undefined) {
            console.warn("Error fetching user page");
            return;
        }

        if (page_max === undefined) {
            let last_page_elem = doc.querySelector("nav ul.pagination-list li:last-child a")!;
            // weird bug on the scoresaber site:
            // it lists for e.g. 20 pages, but 21 might be needed
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
        usercache.save();
    }

    intor(g.status_elem, "User updated");

    on_user_list_changed();
}

/**
 * @param {string} id
 * @param {string|number} page
 * @returns {Promise<Document>}
 */
async function fetch_user_page(id: string, page: string | number): Promise<Document> {
    let link = g.scoresaber_link + `/u/${id}&page=${page}&sort=2`;
    if (window.location.href.toLowerCase() === link) {
        logc("Efficient get :P");
        return document;
    }

    logc(`Fetching user ${id} page ${page}`);
    let init_fetch = await (await fetch(link)).text();
    var parser = new DOMParser();
    return parser.parseFromString(init_fetch, 'text/html');
}

function process_user_page(doc: Document, user: IDbUser) {
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

export function update_self_user_list() {
    let home_user_list_elem = check(document.getElementById("home_user_list"));
    intor(home_user_list_elem,
        ...Object.keys(g.user_list).map(id => {
            let user = g.user_list[id];
            return create("a", {
                class: "navbar-item",
                style: {
                    paddingRight: "1em",
                    flexWrap: "nowrap",
                    display: "flex",
                },
                href: g.scoresaber_link + "/u/" + id,
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

function delete_user(user_id: string) {
    if (g.user_list[user_id]) {
        delete g.user_list[user_id];
        usercache.save();
        on_user_list_changed();
    }
}

// TODO create eventsystem

function on_user_list_changed() {
    update_user_compare_dropdown();
    update_self_user_list();
}

function on_user_compare_changed() {
    let compare_user = get_compare_user();
    if (!compare_user)
        return;
    update_user_compare_songtable(compare_user);
    update_pp_distribution_graph();
}