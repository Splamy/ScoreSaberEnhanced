import SseEvent from "./components/events";
import * as modal from "./components/modal";
import * as env from "./env";
import { clear_children, create, into, intor } from "./util/dom";
import SettingsDialogue from "./components/SettingsDialogue.svelte";

let notify_box: HTMLElement | undefined;
let settings_modal: modal.Modal<any> | undefined;

export function setup(): void {
	notify_box = create("div", { class: "field" });
	const cog = create("i", { class: "fas fa-cog" });
	into(env.get_navbar(),
		create("a", {
			id: "settings_menu",
			class: g.header_class,
			style: {
				cursor: "pointer",
			},
			onclick: () => show_settings_lazy(),
		}, cog)
	);

	SseEvent.UserNotification.register(() => {
		const ntfys = SseEvent.getNotifications();
		if (ntfys.length > 0) {
			cog.classList.remove("fa-cog");
			cog.classList.add("fa-bell");
			cog.style.color = "yellow";
		} else {
			cog.classList.remove("fa-bell");
			cog.classList.add("fa-cog");
			cog.style.color = "";
		}

		if (!notify_box) return;
		clear_children(notify_box);
		for (const ntfy of ntfys) {
			into(notify_box,
				create("div", { class: `notification is-${ntfy.type}` }, ntfy.msg)
			);
		}
	});
}

function show_settings_lazy() {
	if (settings_modal) {
		settings_modal.show();
		return;
	}

	const status_box = create("div", {});
	SseEvent.StatusInfo.register((status) => intor(status_box, status.text));

	const set_div = create("div");
	new SettingsDialogue({ target: set_div });

	settings_modal = modal.create_modal({
		title: "Options",
		text: set_div,
		footer: status_box,
		type: "card",
		default: true,
	});
}

export function update_button_visibility(): void {
	const bm = env.get_button_matrix();
	for (const pb of env.BMPageButtons) {
		const showButton = bm[pb] || false;
		document.documentElement.style.setProperty(
			`--sse-show-${pb}`,
			showButton ? "unset" : "none");
	}
}
