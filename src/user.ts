import { is_user_page, get_user_header, get_current_user, set_home_user, get_home_user, get_navbar } from "./env";
import { create, into } from "./util/dom";
import g from "./global";
import { update_self_user_list } from "./compare";

export function setup_self_pin_button() {
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

export function update_self_button() {
    let home_user = get_home_user();
    if (!home_user) {
        home_user = { name: "<Pins>", id: "0" };
    }

    let home_elem = document.getElementById("home_user") as HTMLAnchorElement | null;
    if (home_elem) {
        home_elem.href = g.scoresaber_link + "/u/" + home_user.id;
        home_elem.innerText = home_user.name;
    } else {
        into(get_navbar(),
            create("div", { class: "navbar-item has-dropdown is-hoverable" },
                create("a", {
                    id: "home_user",
                    class: "navbar-item",
                    href: g.scoresaber_link + "/u/" + home_user.id
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