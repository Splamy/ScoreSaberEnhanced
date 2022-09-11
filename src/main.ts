import * as compare from "./compare";
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

const hooks: IHook[] = [];
hooks.push(page_song.dl_link_leaderboard);

let has_loaded_head = false;
function on_load_head() {
	if (!document.head) { log.logc("Head not ready"); return; }
	if (has_loaded_head) { log.logc("Already loaded head"); return; }
	has_loaded_head = true;
	log.logc("Loading head");
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

	//page_user.setup_dl_link_user_site();
	//page_user.add_percentage();
	//page_user.update_wide_table_css();
	//page_song.setup_dl_link_leaderboard();
	//page_song.setup_song_filter_tabs();
	//page_song.highlight_user();
	//page_song.add_percentage();
	//page_songlist.setup_links_songlist();
	//page_songlist.setup_extra_filter_checkboxes();
	//page_songlist.apply_extra_filters();
	//header.setup_self_pin_button();
	//header.setup_self_button();
	//compare.setup_user_compare();
	//settings.setup();
	//settings.update_button_visibility();
	//ppgraph.setup_pp_graph();
	//updater.check_for_updates();
	mutation_test();
}

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

function onload() {
	on_load_head();
	on_load_body();
}

onload();
window.addEventListener("DOMContentLoaded", onload);
window.addEventListener("load", onload);
