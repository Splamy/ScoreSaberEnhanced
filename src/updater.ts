import SseEvent from "./components/events";
import g from "./global";
import { fetch2 } from "./util/net";
import { SSE_info } from "./util/userscript";

export async function check_for_updates(): Promise<void> {
	const current_version = SSE_info.script.version;
	const update_check = localStorage.getItem("update_check");

	if (update_check && Number(update_check) >= new Date().getTime()) {
		return;
	}

	const latest_script = await fetch2(`https://raw.githubusercontent.com/Splamy/ScoreSaberEnhanced/master/scoresaber.user.js`);
	const latest_version = g.script_version_reg.exec(latest_script)![1];
	if (current_version !== latest_version) {
		SseEvent.addNotification({ msg: "An update is available", type: "warning" });
	} else {
		const now = new Date();
		now.setDate(now.getDate() + 1);
		localStorage.setItem("update_check", now.getTime().toString());
	}
}
