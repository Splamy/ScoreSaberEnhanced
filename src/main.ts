import * as compare from "./compare";
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

let mutated = [];
let added = [];
//let modified = [];

function on_load_body() {
	added = [];
	//modified = [];
	
	mutated
		.filter((e) => e.target !== document.head)
		.forEach((e) => added = added.concat(Array.from(e.addedNodes).filter(a => a.nodeName !== "#text" && a.nodeName !== "#comment")));
	
	console.log(added);
	
	if (added.find(e => e.nodeName === "HEADER")) {
		log.logc("Heading added");
		header.setup_self_button();
		settings.setup();
		settings.update_button_visibility();
	}
	if (added.find(e => e.classList.contains("map-card"))) {
		page_song.setup_dl_link_leaderboard();
		page_song.setup_song_filter_tabs();
		page_song.highlight_user();
		page_song.add_percentage();
	}
	/*
	header.setup_self_pin_button();
	page_user.setup_dl_link_user_site();
	page_user.add_percentage();
	page_user.update_wide_table_css();
	page_songlist.setup_links_songlist();
	page_songlist.setup_extra_filter_checkboxes();
	page_songlist.apply_extra_filters();
	compare.setup_user_compare();
	ppgraph.setup_pp_graph();
	updater.check_for_updates();
	*/
	mutated = [];
}

let timer_id = null;

function onload() {
	try {
		on_load_head();
		on_load_body();
		console.log("onload");
	}
	catch(e) { console.error(e); }
}

const observer = new MutationObserver((mutations) => {
	mutated = mutated.concat(mutations);
	
	if (timer_id !== null) {
		clearTimeout(timer_id);
	}
	timer_id = setTimeout(onload, 1000);
});
observer.observe(document, {childList: true, subtree: true});
