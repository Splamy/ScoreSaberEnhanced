import { create } from "./util/dom";
import { check } from "./util/err";
import g from "./global";
import { ISong, IDbUser } from "./declarations/Types";
import { format_en, toggled_class } from "./util/format";
import { get_song_compare_value } from "./util/song";
import { is_song_leaderboard_page, get_home_user } from "./env";

export function setup_song_filter_tabs(): void {
    if (!is_song_leaderboard_page()) { return; }

    let tab_list_content = check(document.querySelector(".tabs > ul"));

    function load_friends() {
        let score_table = check(document.querySelector(".ranking .global > tbody"));
        g.song_table_backup = score_table;
        let table = check(score_table.parentNode);
        table.removeChild(score_table);
        score_table = table.appendChild(create("tbody"));
        let song_id = g.leaderboard_reg.exec(window.location.pathname)![1];

        let elements: [ISong, HTMLElement][] = [];
        for (const user_id in g.user_list) {
            let user = g.user_list[user_id];
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
        if (!g.song_table_backup) {
            return;
        }

        let score_table = check(document.querySelector(".ranking .global > tbody"));
        let table = check(score_table.parentNode);
        table.removeChild(score_table);
        score_table = table.appendChild(g.song_table_backup);
        g.song_table_backup = undefined;
    }

    tab_list_content.appendChild(generate_tab("All Scores", "all_scores_tab", load_all, true, true));
    tab_list_content.appendChild(generate_tab("Friends", "friends_tab", load_friends, false, false));
    // tab_list_content.appendChild(generate_tab("Around Me", "around_me_tab", () => {}, false, false));
}

function generate_song_table_row(user_id: string, user: IDbUser, song_id: string): HTMLElement {
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

function generate_song_table_player(user_id: string, user: IDbUser) {
    return create("a", { href: `${g.scoresaber_link}/u/${user_id}` }, user.name);
}

function generate_tab(
    title: string | HTMLElement,
    css_id: string,
    action: (() => any) | undefined,
    is_active: boolean,
    has_offset: boolean
): HTMLElement {
    let tabClass = `filter_tab ${toggled_class(is_active, "is-active")} ${toggled_class(has_offset, "offset_tab")}`;
    return create("li", {
        id: css_id,
        class: tabClass,
    },
        create("a", {
            class: "has-text-info",
            onclick: () => {
                document.querySelectorAll(".tabs > ul .filter_tab").forEach(x => x.classList.remove("is-active"));
                check(document.getElementById(css_id)).classList.add("is-active");
                if (action) action();
            }
        }, title)
    );
}

// TODO not quite correct here, should be somewhere for general leaderboards

export function highlight_user() {
    // (No page check, this should work on global and song boards)
    let home_user = get_home_user();
    if (!home_user) { return; }

    let element = document.querySelector(`table.ranking.global a[href='/u/${home_user.id}']`);

    if (element != null) {
        element.parentElement!.parentElement!.style.backgroundColor = "var(--color-highlight)";
    }
}