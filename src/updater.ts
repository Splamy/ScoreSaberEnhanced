import g from "./global";
import { create, into } from "./util/dom";
import { check } from "./util/err";

export function check_for_updates(edit_elem: HTMLElement): void {
	const current_version = GM_info.script.version;
	const update_check = localStorage.getItem("update_check");

	if (update_check && Number(update_check) >= new Date().getTime()) {
		return;
	}

	GM_xmlhttpRequest({
		method: "GET",
		headers: {
			Origin: "github.com",
		},
		url: `https://raw.githubusercontent.com/Splamy/ScoreSaberEnhanced/master/scoresaber.user.js`,
		onload(response) {
			const latest_script = response.responseText;
			const latest_version = g.script_version_reg.exec(latest_script)![1];
			if (current_version !== latest_version) {
				into(edit_elem,
					create("div", { class: "notification is-warning" }, "An update is avalilable")
				);

				const settings_menu = check(document.querySelector("#settings_menu i"));
				settings_menu.classList.remove("fa-cog");
				settings_menu.classList.add("fa-bell");
				settings_menu.style.color = "yellow";
			} else {
				const now = new Date();
				now.setDate(now.getDate() + 1);
				localStorage.setItem("update_check", now.getTime().toString());
			}
		}
	});
}
