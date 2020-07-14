import SseEvent from "./components/events";
import * as modal from "./components/modal";
import { get_current_user, get_home_user, get_navbar, get_user_header, is_user_page, set_home_user } from "./env";
import g from "./global";
import * as usercache from "./usercache";
import { create, into, intor } from "./util/dom";
import { check } from "./util/err";
import { logc } from "./util/log";

export function setup_self_pin_button(): void {
	if (!is_user_page()) { return; }

	const header = get_user_header();
	into(header, create("div", {
		class: "button icon is-medium",
		style: { cursor: "pointer" },
		data: { tooltip: "Pin this user to your navigation bar" },
		onclick() {
			set_home_user(get_current_user());
			SseEvent.PinnedUserChanged.invoke();
		}
	},
		create("i", { class: "fas fa-thumbtack" }),
	));
}

export function setup_self_button(): void {
	const home_user = get_home_user() ?? { name: "<Pins>", id: "0" };

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

	SseEvent.UserCacheChanged.register(update_self_user_list);
	SseEvent.PinnedUserChanged.register(update_self_button);
}

function update_self_button(): void {
	const home_user = get_home_user() ?? { name: "<Pins>", id: "0" };

	const home_elem = document.getElementById("home_user") as HTMLAnchorElement | null;
	if (home_elem) {
		home_elem.href = g.scoresaber_link + "/u/" + home_user.id;
		home_elem.innerText = home_user.name;
	}
}

function update_self_user_list(): void {
	const home_user_list_elem = check(document.getElementById("home_user_list"));
	intor(home_user_list_elem,
		...Object.entries(g.user_list).map(([id, user]) => {
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
				create("div", {
					class: "button icon is-medium is-danger is-outlined",
					style: { marginLeft: "3em" },
					async onclick(ev) {
						ev.preventDefault();
						ev.stopPropagation();
						const response = await modal.show_modal({
							text: `Delete User "${user.name}" from cache?`,
							buttons: {
								delete: { text: "Delete", class: "is-danger" },
								x: { text: "Abort", class: "is-info" }
							},
						});

						if (response === "delete") {
							logc("Delete user", id, user.name);
							delete_user(id);
						}
					}
				},
					create("i", { class: "fas fa-trash-alt" })
				),
			);
		})
	);
}

function delete_user(user_id: string): void {
	if (g.user_list[user_id]) {
		delete g.user_list[user_id];
		usercache.save();
		SseEvent.UserCacheChanged.invoke();
	}
}
