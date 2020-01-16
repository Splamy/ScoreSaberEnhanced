import { update_self_user_list } from "./compare";
import { get_current_user, get_home_user, get_navbar, get_user_header, is_user_page, set_home_user } from "./env";
import g from "./global";
import { create, into } from "./util/dom";

export function setup_self_pin_button(): void {
	if (!is_user_page()) { return; }

	const header = get_user_header();
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

export function update_self_button(): void {
	const home_user = get_home_user() ?? { name: "<Pins>", id: "0" };

	const home_elem = document.getElementById("home_user") as HTMLAnchorElement | null;
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
