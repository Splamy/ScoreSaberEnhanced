import * as compare from "./compare";
import * as header from "./header";
import * as page_user from "./pages/user";
import * as ppgraph from "./ppgraph";
import * as settings from "./settings";
import * as page_song from "./pages/song";
import * as themes from "./themes";
import * as usercache from "./usercache";
import * as log from "./util/log";

log.setup();
themes.setup();
settings.load_last_theme();
usercache.load();

let has_loaded = false;
function onload(): void {
	if (has_loaded) {
		log.logc("Already loaded");
		return;
	}
	log.logc("LOADING");
	has_loaded = true;
	page_user.setup_dl_link_user_site();
	page_user.setup_user_rank_link_swap();
	page_user.setup_song_rank_link_swap();
	page_user.setup_wide_table_checkbox();
	page_song.setup_dl_link_leaderboard();
	page_song.setup_song_filter_tabs();
	page_song.highlight_user();
	header.setup_self_pin_button();
	header.setup_self_button();
	compare.setup_user_compare();
	settings.setup();
	settings.update_button_visibility();
	ppgraph.setup_pp_graph();
}

if (document.readyState === "complete" || document.readyState === "interactive") {
	onload();
}
window.addEventListener("DOMContentLoaded", onload);
window.addEventListener("load", onload);
window.document.addEventListener("load", onload);
