import * as compare from "./compare";
import g from "./global";
import * as header from "./header";
import * as page_songlist from "./pages/songlist";
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
	if (!document.head) { log.logc("Head not ready"); return; }
	if (has_loaded_head) { log.logc("Already loaded head"); return; }
	has_loaded_head = true;
	log.logc("Loading head");

	themes.setup();
	settings.load_last_theme();
}

const observer = new MutationObserver((mutations) => {
	for (const m of mutations) {
		for (const a of m.addedNodes) {
			if (!(a instanceof HTMLElement)) {
				continue;
			}
			if (a.matches("header")) {
				g.header_class = a.classList[0];
				on_load_head();
				header.setup_self_button();
				settings.setup();
				settings.update_button_visibility();
			}
			// Player Header
			if (a.matches(".title.player > .player-link")) {
				header.setup_self_pin_button();
				page_user.setup_cache_button();
			}
			
			if (a.matches(".gridTable")) {
				page_song.prepare_table(a);
			}
			
			if (a.matches(".table-item")) {
				page_user.add_percentage(a);
				page_user.setup_dl_link_user_site(a);
				page_song.add_percentage(a);
			}
			
			// Map Page
			if (a.matches(".map-card")) {
				page_song.setup_dl_link_leaderboard();
				page_song.setup_song_filter_tabs();
				page_song.highlight_user();
			}
		}
	}
	
	/*
	
	page_user.update_wide_table_css();
	page_songlist.setup_links_songlist();
	page_songlist.setup_extra_filter_checkboxes();
	page_songlist.apply_extra_filters();
	compare.setup_user_compare();
	ppgraph.setup_pp_graph();
	updater.check_for_updates();
	*/
});
observer.observe(document, {childList: true, subtree: true});
