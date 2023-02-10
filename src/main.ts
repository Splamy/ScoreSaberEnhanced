import * as compare from "./compare";
import g from "./global";
import * as header from "./header";
import * as page_songlist from "./pages/songlist";
import * as page_song from "./pages/song";
import * as page_user from "./pages/user";
import * as ppgraph from "./ppgraph";
import * as settings from "./settings";
import * as updater from "./updater";
import * as usercache from "./usercache";
import * as log from "./util/log";
import * as userscript from "./util/userscript";
import { IHook, PageType } from "./hooks/mod";


log.setup();
userscript.setup();
usercache.load();

//const hooks: IHook[] = [];
//hooks.push(page_song.dl_link_leaderboard);

let has_loaded_head = false;
function on_load_head() {
	if (!document.head) { log.logc("Head not ready"); return; }
	if (has_loaded_head) { log.logc("Already loaded head"); return; }
	has_loaded_head = true;
	log.logc("Loading head");
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
		// Svelite >:[
		for (const r of m.removedNodes) {
			if (!(r instanceof HTMLElement)) {
				continue;
			}
			if (r.matches("a#home_user")) {
				header.setup_self_button();
			}
			if (r.matches("a#settings_menu")) {
				settings.setup();
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

function mutation_test() {
	const observer = new MutationObserver((mutations) => {
		apply_sse_dispached(mutations);
	});

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});
}


let last_page: string | undefined = undefined;

function apply_sse_dispached(mutations: MutationRecord[]) {
	const url = window.location.href;
	let changed = false;
	if (url !== last_page) {
		changed = true;
		hooks.forEach((hook) => {
			hook.cleanup?.();
			hook.__loaded = false;
		});
		last_page = url;
	}

	let page = PageType.Unknown;

	if (url.includes("/leaderboard/")) {
		page = PageType.Leaderboard;
	} else if (url.includes("/u/")) {
		page = PageType.User;
	}

	log.logc("Page: ", changed ? "new" : "old", " ", PageType[page]);

	hooks.forEach((hook) => {
		if (hook.page === page && !hook.__loaded) {
			if (hook.try_apply(mutations)) {
				hook.__loaded = true;
			}
		}
	});
}

//mutation_test();
//window.addEventListener("DOMContentLoaded", mutation_test);
//window.addEventListener("load", mutation_test);
