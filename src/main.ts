import * as compare from "./compare";
import * as header from "./header";
import * as page_song from "./pages/song";
import * as page_user from "./pages/user";
import * as ppgraph from "./ppgraph";
import * as settings from "./settings";
import * as themes from "./themes";
import * as updater from "./updater";
import * as usercache from "./usercache";
import * as log from "./util/log";
import * as userscript from "./util/userscript";

log.setup();
userscript.setup();
usercache.load();

let has_loaded_head = false;
function on_load_head() {
	// tslint:disable-next-line
	if (!document.head) { log.logc("Head not ready"); return; }
	if (has_loaded_head) { log.logc("Already loaded head"); return; }
	has_loaded_head = true;
	log.logc("Loading head");

	themes.setup();
	settings.load_last_theme();
}

let has_loaded_body = false;
function on_load_body(): void {
	if (document.readyState !== "complete" && document.readyState !== "interactive") {
		log.logc("Body not ready");
		return;
	}
	if (has_loaded_body) { log.logc("Already loaded body"); return; }
	has_loaded_body = true;
	log.logc("Loading body");

	page_user.setup_dl_link_user_site();
	page_user.add_percentage();
	page_user.setup_user_rank_link_swap();
	page_user.setup_song_rank_link_swap();
	page_user.setup_wide_table_checkbox();
	page_song.setup_dl_link_leaderboard();
	page_song.setup_song_filter_tabs();
	page_song.highlight_user();
	page_song.add_percentage();
	header.setup_self_pin_button();
	header.setup_self_button();
	compare.setup_user_compare();
	settings.setup();
	settings.update_button_visibility();
	ppgraph.setup_pp_graph();
	updater.check_for_updates();
}

function onload() {
	on_load_head();
	on_load_body();
}

onload();
window.addEventListener("DOMContentLoaded", onload);
window.addEventListener("load", onload);
