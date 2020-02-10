// ==UserScript==
// @name         ScoreSaberEnhanced
// @namespace    https://scoresaber.com
// @version      1.6.0
// @description  Adds links to beatsaver and add player comparison
// @author       Splamy, TheAsuro
// @match        http*://scoresaber.com/*
// @icon         https://scoresaber.com/imports/images/logo.ico
// @updateURL    https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scoresaber.user.js
// @downloadURL  https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scoresaber.user.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert@2.1.2/dist/sweetalert.min.js
// @require      https://cdn.jsdelivr.net/npm/timeago.js@4.0.2/dist/timeago.min.js
// @run-at       document-body
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_info
// @connect      unpkg.com
// @connect      beatsaver.com
// @connect      githubusercontent.com
// @connect      bsaber.com
// ==/UserScript==

(function () {
	'use strict';

	class Global {
	}
	Global.debug = false;
	Global.scoresaber_link = "https://scoresaber.com";
	Global.beatsaver_link = "https://beatsaver.com/beatmap/";
	Global.bsaber_songs_link = "https://bsaber.com/songs/";
	Global.song_hash_reg = /\/([\da-zA-Z]{40})\.png/;
	Global.score_reg = /(score|accuracy):\s*([\d\.,]+)%?\s*(\(([\w,]*)\))?/;
	Global.leaderboard_reg = /leaderboard\/(\d+)/;
	Global.leaderboard_rank_reg = /#([\d,]+)/;
	Global.user_reg = /u\/(\d+)/;
	Global.script_version_reg = /\/\/\s*@version\s+([\d\.]+)/;
	Global.user_per_page_global_leaderboard = 50;
	Global.user_per_page_song_leaderboard = 12;
	Global.pp_weighting_factor = 0.965;

	function setup() {
	    Global.debug = localStorage.getItem("debug") === "true";
	}
	function logc(message, ...optionalParams) {
	    if (Global.debug) {
	        console.log("DBG", message, ...optionalParams);
	    }
	}

	class SseEventHandler {
	    constructor(eventName) {
	        this.eventName = eventName;
	        this.callList = [];
	    }
	    invoke() {
	        logc("Event", this.eventName);
	        for (const func of this.callList) {
	            func();
	        }
	    }
	    register(func) {
	        this.callList.push(func);
	    }
	}
	class SseEvent {
	}
	SseEvent.UserCacheChanged = new SseEventHandler("UserCacheChanged");
	SseEvent.CompareUserChanged = new SseEventHandler("CompareUserChanged");
	SseEvent.PinnedUserChanged = new SseEventHandler("PinnedUserChanged");

	function create(tag, attrs, ...children) {
	    if (!tag)
	        throw new SyntaxError("'tag' not defined");
	    const ele = document.createElement(tag);
	    if (attrs) {
	        for (const attrName in attrs) {
	            if (attrName === "style") {
	                for (const styleName in attrs.style) {
	                    ele.style[styleName] = attrs.style[styleName];
	                }
	            }
	            else if (attrName === "class") {
	                if (typeof attrs.class === "string") {
	                    const classes = attrs.class.split(/ /g).filter(c => c.trim().length > 0);
	                    ele.classList.add(...classes);
	                }
	                else {
	                    ele.classList.add(...attrs.class);
	                }
	            }
	            else if (attrName === "for") {
	                ele.htmlFor = attrs[attrName];
	            }
	            else if (attrName === "selected") {
	                ele.selected = attrs[attrName] ? "selected" : undefined;
	            }
	            else if (attrName === "disabled") {
	                if (attrs[attrName])
	                    ele.setAttribute("disabled", undefined);
	            }
	            else if (attrName === "data") {
	                const data_dict = attrs[attrName];
	                for (const data_key in data_dict) {
	                    ele.setAttribute(`data-${data_key}`, data_dict[data_key]);
	                }
	            }
	            else {
	                ele[attrName] = attrs[attrName];
	            }
	        }
	    }
	    into(ele, ...children);
	    return ele;
	}
	function clear_children(elem) {
	    while (elem.lastChild) {
	        elem.removeChild(elem.lastChild);
	    }
	}
	function intor(parent, ...children) {
	    clear_children(parent);
	    return into(parent, ...children);
	}
	function into(parent, ...children) {
	    for (const child of children) {
	        if (typeof child === "string") {
	            if (children.length > 1) {
	                parent.appendChild(create("div", {}, child));
	            }
	            else {
	                parent.innerText = child;
	            }
	        }
	        else {
	            parent.appendChild(child);
	        }
	    }
	}

	function check(elem) {
	    if (elem === undefined || elem === null) {
	        throw new Error("Expected value to not be null");
	    }
	    return elem;
	}

	function get_user_header() {
	    return check(document.querySelector(".content div.columns h5"));
	}
	function get_navbar() {
	    return check(document.querySelector("#navMenu div.navbar-start"));
	}
	function is_user_page() {
	    return window.location.href.toLowerCase().startsWith(Global.scoresaber_link + "/u/");
	}
	function is_song_leaderboard_page() {
	    return window.location.href.toLowerCase().startsWith(Global.scoresaber_link + "/leaderboard/");
	}
	function get_current_user() {
	    if (Global._current_user) {
	        return Global._current_user;
	    }
	    if (!is_user_page()) {
	        throw new Error("Not on a user page");
	    }
	    Global._current_user = get_document_user(document);
	    return Global._current_user;
	}
	function get_document_user(doc) {
	    const username_elem = check(doc.querySelector(".content .title a"));
	    const user_name = username_elem.innerText.trim();
	    const user_id = Global.user_reg.exec(window.location.href)[1];
	    return { id: user_id, name: user_name };
	}
	function get_home_user() {
	    if (Global._home_user) {
	        return Global._home_user;
	    }
	    const json = localStorage.getItem("home_user");
	    if (!json) {
	        return undefined;
	    }
	    Global._home_user = JSON.parse(json);
	    return Global._home_user;
	}
	function get_compare_user() {
	    var _a;
	    if (Global.last_selected) {
	        return Global.last_selected;
	    }
	    const stored_last = localStorage.getItem("last_selected");
	    if (stored_last) {
	        Global.last_selected = stored_last;
	        return Global.last_selected;
	    }
	    const compare = document.getElementById("user_compare");
	    if ((_a = compare) === null || _a === void 0 ? void 0 : _a.value) {
	        Global.last_selected = compare.value;
	        return Global.last_selected;
	    }
	    return undefined;
	}
	function insert_compare_feature(elem) {
	    if (!is_user_page()) {
	        throw Error("Invalid call to 'insert_compare_feature'");
	    }
	    setup_compare_feature_list();
	    elem.style.marginLeft = "1em";
	    into(check(Global.feature_list), elem);
	}
	function insert_compare_display(elem) {
	    if (!is_user_page()) {
	        throw Error("Invalid call to 'insert_compare_display'");
	    }
	    setup_compare_feature_list();
	    into(check(Global.feature_display_list), elem);
	}
	function setup_compare_feature_list() {
	    if (Global.feature_list === undefined) {
	        const select_score_order_elem = check(document.querySelector(".content div.select"));
	        const parent_box_elem = check(select_score_order_elem.parentElement);
	        Global.feature_list = create("div", { class: "level-item" });
	        const level_box_elem = create("div", { class: "level" }, Global.feature_list);
	        parent_box_elem.replaceChild(level_box_elem, select_score_order_elem);
	        insert_compare_feature(select_score_order_elem);
	        Global.feature_display_list = create("div", { class: "level-item" });
	        level_box_elem.insertAdjacentElement("afterend", Global.feature_display_list);
	    }
	}
	function set_compare_user(user) {
	    Global.last_selected = user;
	    localStorage.setItem("last_selected", user);
	}
	function set_home_user(user) {
	    Global._home_user = user;
	    localStorage.setItem("home_user", JSON.stringify(user));
	}
	function set_wide_table(value) {
	    localStorage.setItem("wide_song_table", value ? "true" : "false");
	}
	function get_wide_table() {
	    return localStorage.getItem("wide_song_table") === "true";
	}
	function set_show_bs_link(value) {
	    localStorage.setItem("show_bs_link", value ? "true" : "false");
	}
	function get_show_bs_link() {
	    return (localStorage.getItem("show_bs_link") || "true") === "true";
	}
	function set_show_oc_link(value) {
	    localStorage.setItem("show_oc_link", value ? "true" : "false");
	}
	function get_show_oc_link() {
	    return (localStorage.getItem("show_oc_link") || "true") === "true";
	}

	function load() {
	    const json = localStorage.getItem("users");
	    if (!json) {
	        Global.user_list = {};
	        return;
	    }
	    try {
	        Global.user_list = JSON.parse(json);
	    }
	    catch (ex) {
	        Global.user_list = {};
	        localStorage.setItem("users", "{}");
	    }
	    logc("Loaded usercache", Global.user_list);
	}
	function save() {
	    localStorage.setItem("users", JSON.stringify(Global.user_list));
	}

	function format_en(num, digits) {
	    if (digits === undefined)
	        digits = 2;
	    return num.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });
	}
	function toggled_class(bool, css_class) {
	    return bool ? css_class : "";
	}
	function number_invariant(num) {
	    return Number(num.replace(/,/g, ""));
	}

	function fetch2(url) {
	    return new Promise((resolve, reject) => {
	        const host = get_hostname(url);
	        const request_param = {
	            method: "GET",
	            url: url,
	            headers: { Origin: host },
	            onload: (req) => {
	                if (req.status >= 200 && req.status < 300) {
	                    resolve(req.responseText);
	                }
	                else {
	                    reject(`request errored: ${url} (${req.status})`);
	                }
	            },
	            onerror: () => {
	                reject(`request errored: ${url}`);
	            }
	        };
	        GM_xmlhttpRequest(request_param);
	    });
	}
	function get_hostname(url) {
	    const match = url.match(/:\/\/([^/:]+)/i);
	    if (match && match.length > 1 && typeof match[1] === "string" && match[1].length > 0) {
	        return match[1];
	    }
	    else {
	        return undefined;
	    }
	}

	const api_cache = {};
	async function get_data_by_hash(song_hash) {
	    const cached_data = api_cache[song_hash];
	    if (cached_data)
	        return cached_data;
	    try {
	        const data_str = await fetch2(`https://beatsaver.com/api/maps/by-hash/${song_hash}`);
	        const data = JSON.parse(data_str);
	        api_cache[song_hash] = data;
	        return data;
	    }
	    catch (e) {
	        return undefined;
	    }
	}

	function get_song_compare_value(song_a, song_b) {
	    if (song_a.pp > 0 && song_b.pp) {
	        return [song_a.pp, song_b.pp];
	    }
	    else if (song_a.score !== undefined && song_b.score !== undefined && song_a.score > 0) {
	        return [song_a.score, song_b.score];
	    }
	    else if (song_a.accuracy !== undefined && song_b.accuracy !== undefined && song_a.accuracy > 0) {
	        return [song_a.accuracy * get_song_mod_multiplier(song_a), song_b.accuracy * get_song_mod_multiplier(song_b)];
	    }
	    else {
	        return [0, 0];
	    }
	}
	function get_song_mod_multiplier(song) {
	    if (!song.mods)
	        return 1.0;
	    let multiplier = 1.0;
	    for (const mod of song.mods) {
	        switch (mod) {
	            case "NF":
	                multiplier -= 0.50;
	                break;
	            case "NO":
	                multiplier -= 0.05;
	                break;
	            case "NB":
	                multiplier -= 0.10;
	                break;
	            case "SS":
	                multiplier -= 0.30;
	                break;
	            case "NA":
	                multiplier -= 0.30;
	                break;
	            case "DA":
	                multiplier += 0.07;
	                break;
	            case "GN":
	                multiplier += 0.11;
	                break;
	            case "FS":
	                multiplier += 0.08;
	                break;
	        }
	    }
	    return Math.max(0, multiplier);
	}
	function get_song_hash_from_text(text) {
	    const res = Global.song_hash_reg.exec(text);
	    return res ? res[1] : undefined;
	}
	async function oneclick_install(song_key) {
	    const lastCheck = localStorage.getItem("oneclick-prompt");
	    const prompt = lastCheck == undefined ||
	        new Date(lastCheck).getTime() + (1000 * 60 * 60 * 24 * 31) < new Date().getTime();
	    if (prompt) {
	        localStorage.setItem("oneclick-prompt", new Date().getTime().toString());
	        const resp = await swal({
	            icon: "warning",
	            buttons: {
	                install: { text: "Get ModSaber Installer", closeModal: false, className: "swal-button--cancel" },
	                done: { text: "OK" },
	            },
	            text: "OneClick Install requires the BeatSaberModInstaller or BeatDrop2 to function.\nPlease install it before proceeding.",
	        });
	        if (resp === "install")
	            window.open("https://github.com/beat-saber-modding-group/BeatSaberModInstaller/releases");
	    }
	    console.log("Downloading: ", song_key);
	    window.location.assign(`beatsaver://${song_key}`);
	}
	function song_equals(a, b) {
	    if (a === undefined && b === undefined)
	        return true;
	    if (a === undefined || b === undefined)
	        return false;
	    return (a.accuracy === b.accuracy &&
	        a.mods === b.mods &&
	        a.pp === b.pp &&
	        a.score === b.score &&
	        a.time === b.time);
	}

	function setup_user_compare() {
	    if (!is_user_page()) {
	        return;
	    }
	    const header = get_user_header();
	    header.style.display = "flex";
	    header.style.alignItems = "center";
	    const user = get_current_user();
	    into(header, create("div", {
	        class: "button icon is-medium",
	        style: { cursor: "pointer" },
	        data: { tooltip: Global.user_list[user.id] ? "Update score cache" : "Add user to your score cache" },
	        async onclick() {
	            await fetch_user(get_current_user().id);
	        },
	    }, create("i", { class: ["fas", Global.user_list[user.id] ? "fa-sync" : "fa-bookmark"] })));
	    Global.status_elem = create("div");
	    into(header, Global.status_elem);
	    Global.users_elem = create("div");
	    insert_compare_feature(Global.users_elem);
	    update_user_compare_dropdown();
	    SseEvent.UserCacheChanged.register(update_user_compare_dropdown);
	    SseEvent.UserCacheChanged.register(update_user_compare_songtable);
	    SseEvent.CompareUserChanged.register(update_user_compare_songtable);
	    SseEvent.CompareUserChanged.invoke();
	}
	function update_user_compare_dropdown() {
	    if (!is_user_page()) {
	        return;
	    }
	    const compare = get_compare_user();
	    intor(Global.users_elem, create("div", { class: "select" }, create("select", {
	        id: "user_compare",
	        onchange() {
	            const user = this.value;
	            set_compare_user(user);
	            SseEvent.CompareUserChanged.invoke();
	        }
	    }, ...Object.keys(Global.user_list).map(id => {
	        const user = Global.user_list[id];
	        return create("option", { value: id, selected: id === compare }, user.name);
	    }))));
	}
	function update_user_compare_songtable(other_user) {
	    if (!is_user_page()) {
	        return;
	    }
	    if (other_user === undefined) {
	        other_user = get_compare_user();
	        if (other_user === undefined) {
	            return;
	        }
	    }
	    const other_data = Global.user_list[other_user];
	    if (!other_data) {
	        logc("Other user not found: ", other_user);
	        return;
	    }
	    const table = check(document.querySelector("table.ranking.songs"));
	    table.querySelectorAll(".comparisonScore").forEach(el => el.remove());
	    const ranking_table_header = check(table.querySelector("thead > tr"));
	    check(ranking_table_header.querySelector(".score")).insertAdjacentElement("afterend", create("th", { class: "comparisonScore" }, other_data.name));
	    const table_row = table.querySelectorAll("tbody tr");
	    for (const row of table_row) {
	        row.style.backgroundImage = "unset";
	        const [song_id, song] = get_row_data(row);
	        const other_song = other_data.songs[song_id];
	        let other_score_content;
	        if (other_song) {
	            other_score_content = create("div", {}, create("span", { class: "scoreTop ppValue" }, format_en(other_song.pp)), create("span", { class: "scoreTop ppLabel" }, "pp"), create("br"), (() => {
	                let str;
	                if (other_song.accuracy) {
	                    str = `accuracy: ${format_en(other_song.accuracy)}%`;
	                }
	                else if (other_song.score) {
	                    str = `score: ${format_en(other_song.score)}`;
	                }
	                else {
	                    return "<No Data>";
	                }
	                if (other_song.mods) {
	                    str += ` (${other_song.mods.join(",")})`;
	                }
	                return create("span", { class: "scoreBottom" }, str);
	            })());
	        }
	        else {
	            other_score_content = create("hr", {});
	        }
	        check(row.querySelector(".score")).insertAdjacentElement("afterend", create("th", { class: "comparisonScore" }, other_score_content));
	        if (!other_song) {
	            logc("No match");
	            continue;
	        }
	        const [value1, value2] = get_song_compare_value(song, other_song);
	        if (value1 === 0 && value2 === 0) {
	            logc("No score");
	            continue;
	        }
	        let value = (Math.min(value1, value2) / Math.max(value1, value2)) * 100;
	        const better = value1 > value2;
	        if (better) {
	            value = 100 - value;
	        }
	        if (better) {
	            row.style.backgroundImage = `linear-gradient(75deg, var(--color-ahead) ${value}%, rgba(0,0,0,0) ${value}%)`;
	        }
	        else {
	            row.style.backgroundImage = `linear-gradient(105deg, rgba(0,0,0,0) ${value}%, var(--color-behind) ${value}%)`;
	        }
	    }
	}
	function get_row_data(row) {
	    if (row.cache) {
	        return row.cache;
	    }
	    const leaderboard_elem = check(row.querySelector("th.song a"));
	    const pp_elem = check(row.querySelector("th.score .ppValue"));
	    const score_elem = check(row.querySelector("th.score .scoreBottom"));
	    const time_elem = check(row.querySelector("th.song .time"));
	    const song_id = Global.leaderboard_reg.exec(leaderboard_elem.href)[1];
	    const pp = Number(pp_elem.innerText);
	    const time = time_elem.title;
	    let score = undefined;
	    let accuracy = undefined;
	    let mods = undefined;
	    const score_res = check(Global.score_reg.exec(score_elem.innerText));
	    logc(score_res);
	    if (score_res[1] === "score") {
	        score = number_invariant(score_res[2]);
	    }
	    else if (score_res[1] === "accuracy") {
	        accuracy = Number(score_res[2]);
	    }
	    if (score_res[4]) {
	        mods = score_res[4].split(/,/g);
	    }
	    const song = {
	        pp,
	        time,
	        score,
	        accuracy,
	        mods,
	    };
	    const data = [song_id, song];
	    row.cache = data;
	    return data;
	}
	async function fetch_user(id) {
	    let page = 1;
	    let page_max = undefined;
	    let updated = false;
	    intor(Global.status_elem, "Adding user to database...");
	    let user = Global.user_list[id];
	    if (!user) {
	        user = {
	            name: "User" + id,
	            songs: {}
	        };
	        Global.user_list[id] = user;
	    }
	    for (; page <= (page_max || 4); page++) {
	        intor(Global.status_elem, `Updating page ${page}/${(page_max || "?")}`);
	        let doc;
	        let tries = 5;
	        const sleep = (timeout) => new Promise(resolve => setTimeout(resolve, timeout));
	        while ((!doc || doc.body.textContent === '"Rate Limit Exceeded"') && tries > 0) {
	            await sleep(500);
	            doc = await fetch_user_page(id, page);
	            tries--;
	        }
	        if (doc == undefined) {
	            console.warn("Error fetching user page");
	            return;
	        }
	        if (page_max === undefined) {
	            const last_page_elem = doc.querySelector("nav ul.pagination-list li:last-child a");
	            page_max = Number(last_page_elem.innerText) + 1;
	            user.name = get_document_user(doc).name;
	        }
	        const [has_old_entry, has_updated] = process_user_page(doc, user);
	        updated = updated || has_updated;
	        if (has_old_entry) {
	            break;
	        }
	    }
	    const [, has_updated] = process_user_page(document, user);
	    updated = updated || has_updated;
	    if (updated) {
	        save();
	    }
	    intor(Global.status_elem, "User updated");
	    SseEvent.UserCacheChanged.invoke();
	}
	async function fetch_user_page(id, page) {
	    const link = Global.scoresaber_link + `/u/${id}&page=${page}&sort=2`;
	    if (window.location.href.toLowerCase() === link) {
	        logc("Efficient get :P");
	        return document;
	    }
	    logc(`Fetching user ${id} page ${page}`);
	    const init_fetch = await (await fetch(link)).text();
	    const parser = new DOMParser();
	    return parser.parseFromString(init_fetch, "text/html");
	}
	function process_user_page(doc, user) {
	    let has_old_entry = false;
	    let has_updated = false;
	    const table_row = doc.querySelectorAll("table.ranking.songs tbody tr");
	    for (const row of table_row) {
	        const [song_id, song] = get_row_data(row);
	        const song_old = user.songs[song_id];
	        if (song_old && song_old.time === song.time) {
	            logc("Old found: ", song);
	            has_old_entry = true;
	        }
	        else {
	            logc("Updated: ", song_old, song);
	            has_updated = has_updated || !song_equals(song_old, song);
	        }
	        user.songs[song_id] = song;
	    }
	    return [has_old_entry, has_updated];
	}

	function setup_self_pin_button() {
	    if (!is_user_page()) {
	        return;
	    }
	    const header = get_user_header();
	    into(header, create("div", {
	        class: "button icon is-medium",
	        style: { cursor: "pointer" },
	        data: { tooltip: "Pin this user to your navigation bar" },
	        onclick() {
	            set_home_user(get_current_user());
	            SseEvent.PinnedUserChanged.invoke();
	        }
	    }, create("i", { class: "fas fa-thumbtack" })));
	}
	function setup_self_button() {
	    var _a;
	    const home_user = (_a = get_home_user(), (_a !== null && _a !== void 0 ? _a : { name: "<Pins>", id: "0" }));
	    into(get_navbar(), create("div", { class: "navbar-item has-dropdown is-hoverable" }, create("a", {
	        id: "home_user",
	        class: "navbar-item",
	        href: Global.scoresaber_link + "/u/" + home_user.id
	    }, home_user.name), create("div", {
	        id: "home_user_list",
	        class: "navbar-dropdown"
	    })));
	    update_self_user_list();
	    SseEvent.UserCacheChanged.register(update_self_user_list);
	    SseEvent.PinnedUserChanged.register(update_self_button);
	}
	function update_self_button() {
	    var _a;
	    const home_user = (_a = get_home_user(), (_a !== null && _a !== void 0 ? _a : { name: "<Pins>", id: "0" }));
	    const home_elem = document.getElementById("home_user");
	    if (home_elem) {
	        home_elem.href = Global.scoresaber_link + "/u/" + home_user.id;
	        home_elem.innerText = home_user.name;
	    }
	}
	function update_self_user_list() {
	    const home_user_list_elem = check(document.getElementById("home_user_list"));
	    intor(home_user_list_elem, ...Object.keys(Global.user_list).map(id => {
	        const user = Global.user_list[id];
	        return create("a", {
	            class: "navbar-item",
	            style: {
	                paddingRight: "1em",
	                flexWrap: "nowrap",
	                display: "flex",
	            },
	            href: Global.scoresaber_link + "/u/" + id,
	        }, create("div", { style: { flex: "1" } }, user.name), create("a", {
	            class: "button icon is-medium is-danger is-outlined",
	            style: { marginLeft: "3em" },
	            onclick: () => {
	                swal(`Delete User "${user.name}" from cache?`, {
	                    dangerMode: true,
	                    buttons: true,
	                }).then((deleteUser) => {
	                    logc("DELETE!", deleteUser);
	                    if (deleteUser) {
	                        delete_user(id);
	                    }
	                });
	                return false;
	            }
	        }, create("i", { class: "fas fa-trash-alt" })));
	    }));
	}
	function delete_user(user_id) {
	    if (Global.user_list[user_id]) {
	        delete Global.user_list[user_id];
	        save();
	        SseEvent.UserCacheChanged.invoke();
	    }
	}

	function generate_beatsaver(song_hash, size) {
	    const base_elem = create("div", {
	        class: `button icon is-${size} ${toggled_class(size !== "large", "has-tooltip-left")} beatsaver_bg_btn`,
	        style: {
	            cursor: song_hash === undefined ? "default" : "pointer",
	            padding: "0",
	        },
	        disabled: song_hash === undefined,
	        data: { tooltip: "View on BeatSaver" },
	        onclick() {
	            checked_hash_to_song_info(this, song_hash)
	                .then(song_info => new_page(Global.beatsaver_link + song_info.key))
	                .catch(() => failed_to_download(this));
	        },
	    }, create("div", { class: "beatsaver_bg" }));
	    return base_elem;
	}
	function generate_oneclick(song_hash, size) {
	    return create("div", {
	        class: `button icon is-${size} ${toggled_class(size !== "large", "has-tooltip-left")}`,
	        style: {
	            cursor: song_hash === undefined ? "default" : "pointer",
	        },
	        disabled: song_hash === undefined,
	        data: { tooltip: "Download with OneClick™" },
	        onclick() {
	            checked_hash_to_song_info(this, song_hash)
	                .then(song_info => oneclick_install(song_info.key))
	                .then(() => ok_after_download(this))
	                .catch(() => failed_to_download(this));
	        },
	    }, create("i", { class: "fas fa-cloud-download-alt" }));
	}
	function generate_bsaber(song_hash) {
	    return create("a", {
	        class: "button icon is-large",
	        style: {
	            cursor: song_hash === undefined ? "default" : "pointer",
	            padding: "0",
	        },
	        disabled: song_hash === undefined,
	        data: { tooltip: "View/Add rating on BeastSaber" },
	        async onclick() {
	            checked_hash_to_song_info(this, song_hash)
	                .then(song_info => new_page(Global.bsaber_songs_link + song_info.key))
	                .catch(() => failed_to_download(this));
	        },
	    }, create("div", {
	        style: {
	            backgroundImage: "url(\"https://bsaber.com/wp-content/themes/beastsaber-wp-theme/assets/img/avater-callback.png\")",
	            backgroundSize: "cover",
	            backgroundRepeat: "no-repeat",
	            backgroundPosition: "center",
	            width: "100%",
	            height: "100%",
	            borderRadius: "inherit",
	        }
	    }));
	}
	async function checked_hash_to_song_info(ref, song_hash) {
	    reset_download_visual(ref);
	    if (!song_hash) {
	        failed_to_download(ref);
	        throw new Error("song_hash is undefined");
	    }
	    const song_info = await get_data_by_hash(song_hash);
	    if (!song_info) {
	        failed_to_download(ref);
	        throw new Error("song_info is undefined");
	    }
	    return song_info;
	}
	function reset_download_visual(ref) {
	    if (ref) {
	        ref.classList.remove("button_success");
	        ref.classList.remove("button_error");
	    }
	}
	function failed_to_download(ref) {
	    if (ref) {
	        ref.classList.add("button_error");
	    }
	}
	function ok_after_download(ref) {
	    if (ref) {
	        ref.classList.add("button_success");
	    }
	}
	function new_page(link) {
	    window.open(link, "_blank");
	}

	function setup_dl_link_user_site() {
	    if (!is_user_page()) {
	        return;
	    }
	    const table = check(document.querySelector("table.ranking.songs"));
	    const table_tr = check(table.querySelector("thead tr"));
	    into(table_tr, create("th", { class: "compact bs_link" }, "BS"));
	    into(table_tr, create("th", { class: "compact oc_link" }, "OC"));
	    const table_row = table.querySelectorAll("tbody tr");
	    for (const row of table_row) {
	        const image_link = check(row.querySelector("th.song img")).src;
	        const song_hash = get_song_hash_from_text(image_link);
	        into(row, create("th", { class: "compact bs_link" }, generate_beatsaver(song_hash, "medium")));
	        into(row, create("th", { class: "compact oc_link" }, generate_oneclick(song_hash, "medium")));
	    }
	}
	function setup_wide_table_checkbox() {
	    if (!is_user_page()) {
	        return;
	    }
	    const table = check(document.querySelector("table.ranking.songs"));
	    table.insertAdjacentElement("beforebegin", create("input", {
	        id: "wide_song_table_css",
	        type: "checkbox",
	        style: { display: "none" },
	        checked: get_wide_table(),
	    }));
	}
	function setup_user_rank_link_swap() {
	    if (!is_user_page()) {
	        return;
	    }
	    const elem_global = check(document.querySelector(".content div.columns ul li a"));
	    const res_global = check(Global.leaderboard_rank_reg.exec(elem_global.innerText));
	    const number_global = number_invariant(res_global[1]);
	    elem_global.href = Global.scoresaber_link + "/global/" + rank_to_page(number_global, Global.user_per_page_global_leaderboard);
	}
	function setup_song_rank_link_swap() {
	    if (!is_user_page()) {
	        return;
	    }
	    const song_elems = document.querySelectorAll("table.ranking.songs tbody tr");
	    for (const row of song_elems) {
	        const rank_elem = check(row.querySelector(".rank"));
	        const leaderboard_link = check(row.querySelector("th.song a")).href;
	        const rank = number_invariant(rank_elem.innerText.slice(1));
	        const rank_str = rank_elem.innerText;
	        rank_elem.innerHTML = "";
	        into(rank_elem, create("a", {
	            href: `${leaderboard_link}?page=${rank_to_page(rank, Global.user_per_page_song_leaderboard)}`
	        }, rank_str));
	    }
	}
	function rank_to_page(rank, ranks_per_page) {
	    return Math.floor((rank + ranks_per_page - 1) / ranks_per_page);
	}

	function get_state(elem) {
	    return !elem.classList.contains(elem.view_class);
	}
	function set_state(elem, state) {
	    if (state) {
	        elem.classList.remove(elem.view_class);
	    }
	    else {
	        elem.classList.add(elem.view_class);
	    }
	}
	function button(opt) {
	    var _a, _b;
	    const btn = create("div", {
	        class: ["button"]
	    }, opt.text);
	    btn.view_class = `is-${_a = opt.type, (_a !== null && _a !== void 0 ? _a : "primary")}`;
	    btn.on = () => {
	        var _a;
	        set_state(btn, true);
	        (_a = opt.onclick) === null || _a === void 0 ? void 0 : _a.call(btn, true);
	    };
	    btn.off = () => {
	        var _a;
	        set_state(btn, false);
	        (_a = opt.onclick) === null || _a === void 0 ? void 0 : _a.call(btn, false);
	    };
	    btn.toggle = () => {
	        var _a;
	        const state = !get_state(btn);
	        set_state(btn, state);
	        (_a = opt.onclick) === null || _a === void 0 ? void 0 : _a.call(btn, state);
	    };
	    btn.onclick = () => {
	        if (btn.getAttribute("disabled") == null) {
	            btn.toggle();
	        }
	    };
	    set_state(btn, (_b = opt.default, (_b !== null && _b !== void 0 ? _b : false)));
	    return btn;
	}

	let chart;
	let chart_elem;
	let chart_button;
	function setup_pp_graph() {
	    if (!is_user_page()) {
	        return;
	    }
	    chart_elem = create("canvas");
	    const chart_container = create("div", {
	        style: {
	            width: "100%",
	            height: "20em",
	            display: "none",
	        }
	    }, chart_elem);
	    insert_compare_display(chart_container);
	    chart_button = button({
	        default: false,
	        text: "Show pp Graph",
	        onclick(active) {
	            if (!chart_elem)
	                return;
	            this.innerText = (active ? "Hide" : "Show") + " pp Graph";
	            set_pp_graph_visibility(chart_container, active);
	        }
	    });
	    insert_compare_feature(chart_button);
	    update_pp_graph_buttons();
	    SseEvent.UserCacheChanged.register(update_pp_graph_buttons);
	    SseEvent.CompareUserChanged.register(update_pp_graph);
	}
	function chartUserData(canvasContext, datasets, labels) {
	    if (chart !== undefined) {
	        chart.data = {
	            labels,
	            datasets
	        };
	        chart.update();
	        return;
	    }
	    chart = new Chart(canvasContext, {
	        type: "line",
	        data: {
	            labels,
	            datasets,
	        },
	        options: {
	            responsive: true,
	            maintainAspectRatio: false,
	            elements: {
	                point: {
	                    radius: 2,
	                }
	            },
	            tooltips: {
	                callbacks: {
	                    label: tooltipItem => String(tooltipItem.yLabel),
	                    title: () => "",
	                }
	            },
	            scales: {
	                xAxes: [{
	                        display: false,
	                    }]
	            }
	        },
	    });
	}
	function get_graph_data(user_id) {
	    const user = Global.user_list[user_id];
	    if (user === undefined)
	        return [];
	    const data = [];
	    const data_scaled = [];
	    Object.keys(user.songs)
	        .filter(sid => user.songs[sid].pp > 0)
	        .sort((a, b) => user.songs[b].pp - user.songs[a].pp)
	        .forEach((songId, index) => {
	        const pp = user.songs[songId].pp;
	        data.push(pp);
	        data_scaled.push(+(pp * Math.pow(Global.pp_weighting_factor, index)).toFixed(2));
	    });
	    const color = (Number(user_id) % 3600) / 10;
	    return [{
	            label: `${user.name} (song pp)`,
	            backgroundColor: `hsl(${color}, 100%, 50%)`,
	            borderColor: `hsl(${color}, 100%, 50%)`,
	            fill: false,
	            data,
	        }, {
	            label: `${user.name} (weighted pp)`,
	            backgroundColor: `hsl(${color}, 60%, 25%)`,
	            borderColor: `hsl(${color}, 60%, 25%)`,
	            fill: false,
	            data: data_scaled,
	        }];
	}
	function update_pp_graph() {
	    if (chart_elem === undefined)
	        return;
	    let dataSets = get_graph_data(get_current_user().id);
	    const compare_user = get_compare_user();
	    if (get_current_user().id !== compare_user && compare_user !== undefined)
	        dataSets = [...dataSets, ...get_graph_data(compare_user)];
	    let max = 0;
	    for (const set of dataSets) {
	        max = Math.max(max, set.data.length);
	    }
	    for (const set of dataSets) {
	        if (set.data.length < max) {
	            set.data.length = max;
	            set.data.fill(0, set.data.length, max);
	        }
	    }
	    const labels = Array(max);
	    labels.fill("Song", 0, max);
	    chartUserData(check(chart_elem.getContext("2d")), dataSets, labels);
	}
	function update_pp_graph_buttons() {
	    if (!chart_button) {
	        return;
	    }
	    const user = get_current_user();
	    if (Global.user_list[user.id] === undefined) {
	        chart_button.setAttribute("disabled", "");
	        chart_button.setAttribute("data-tooltip", "Add the user to your score cache for this feature");
	        chart_button.off();
	    }
	    else {
	        chart_button.removeAttribute("disabled");
	        chart_button.removeAttribute("data-tooltip");
	    }
	}
	function set_pp_graph_visibility(elem, active) {
	    if (active) {
	        if (!chart) {
	            update_pp_graph();
	        }
	        elem.style.display = "";
	    }
	    else {
	        elem.style.display = "none";
	    }
	}

	const themes = ["Default", "Cerulean", "Cosmo", "Cyborg", "Darkly", "Flatly",
	    "Journal", "Litera", "Lumen", "Lux", "Materia", "Minty", "Nuclear", "Pulse",
	    "Sandstone", "Simplex", "Slate", "Solar", "Spacelab", "Superhero", "United",
	    "Yeti"];
	const theme_light = `:root {
	--color-ahead: rgb(128, 255, 128);
	--color-behind: rgb(255, 128, 128);
	--color-highlight: lightgreen;
}`;
	const theme_dark = `:root {
	--color-ahead: rgb(0, 128, 0);
	--color-behind: rgb(128, 0, 0);
	--color-highlight: darkgreen;
}
.beatsaver_bg_btn {
	background-color: white;
}
/* Reset colors for generic themes */
span.songBottom.time, span.scoreBottom, span.scoreTop.ppWeightedValue {
	color:unset;
}
span.songTop.pp, span.scoreTop.ppValue, span.scoreTop.ppLabel, span.songTop.mapper {
	text-shadow: 1px 1px 2px #000;
}`;
	function setup$1() {
	    const style_data = `.compact {
	padding-right: 0 !important;
	padding-left: 0 !important;
	margin-left: 0px !important;
	margin-right: 0px !important;
	text-align: center !important;
}

h5 > * {
	margin-right: 0.3em;
}

#wide_song_table_css:checked ~ table.ranking.songs {
	max-width: unset !important;
}

#leaderboard_tool_strip > * {
	margin-right: 0.5em;
}

.offset_tab {
	margin-left: auto;
}

.beatsaver_bg {
	background: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200' version='1.1'%3E%3Cg fill='none' stroke='%23000000' stroke-width='10'%3E %3Cpath d='M 100,7 189,47 100,87 12,47 Z' stroke-linejoin='round'/%3E %3Cpath d='M 189,47 189,155 100,196 12,155 12,47' stroke-linejoin='round'/%3E %3Cpath d='M 100,87 100,196' stroke-linejoin='round'/%3E %3Cpath d='M 26,77 85,106 53,130 Z' stroke-linejoin='round'/%3E %3C/g%3E %3C/svg%3E") no-repeat center/85%;
	width: 100%;
	height: 100%;
}

.fas_big {
	line-height: 150%;
	padding-right: 0.5em;
	padding-left: 0.5em;
	min-width: 2.25em;
	/* Fix for some themes overriding font */
	font-weight: 900;
	font-family: "Font Awesome 5 Free";
}

.fas_big::before {
	font-size: 120%;
}

[data-tooltip]::before {
	visibility: hidden;
	background-color: #555;
	color: #fff;
	border-radius: 6px;
	position: absolute;
	z-index: 1;
	margin-top: -5px;
	opacity: 0;
	transition: opacity 0.3s;
	padding: 0.2em 1em;
	content: attr(data-tooltip);
	/* Default */
	top: 0;
	left: 50%;
	right: auto;
	bottom: auto;
	transform: translate(-50%, -100%);
}
[data-tooltip].has-tooltip-left::before {
	top: auto;
	right: auto;
	bottom: 50%;
	left: -11px;
	transform: translate(-100%, 50%);
}
[data-tooltip]:hover::before {
	visibility: visible;
	opacity: 1;
}

@keyframes fill_anim {
	0%{background-position:top;}
	20%{background-position:bottom;}
	80%{background-position:bottom;}
	100%{background-position:top;}
}
.button_error {
	background: linear-gradient(to top, red 50%, transparent 50%);
	background-size: 100% 200%;
	background-position:top;
	animation: fill_anim 3s cubic-bezier(.23,1,.32,1) forwards;
}
.button_success {
	background: linear-gradient(to top, green 50%, transparent 50%);
	background-size: 100% 200%;
	background-position:top;
	animation: fill_anim 3s cubic-bezier(.23,1,.32,1) forwards;
}

/* Fix weird tab list offset */

.content li {
	margin-top: 0;
}
`;
	    GM_addStyle(style_data);
	    into(document.head, create("link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/bulma-checkradio/dist/css/bulma-checkradio.min.css" }));
	}

	function check_for_updates(edit_elem) {
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
	            const latest_version = Global.script_version_reg.exec(latest_script)[1];
	            if (current_version !== latest_version) {
	                into(edit_elem, create("div", { class: "notification is-warning" }, "An update is avalilable"));
	                const settings_menu = check(document.querySelector("#settings_menu i"));
	                settings_menu.classList.remove("fa-cog");
	                settings_menu.classList.add("fa-bell");
	                settings_menu.style.color = "yellow";
	            }
	            else {
	                const now = new Date();
	                now.setDate(now.getDate() + 1);
	                localStorage.setItem("update_check", now.getTime().toString());
	            }
	        }
	    });
	}

	function setup$2() {
	    var _a;
	    const current_theme = (_a = localStorage.getItem("theme_name"), (_a !== null && _a !== void 0 ? _a : "Default"));
	    let set_div = create("div", {
	        id: "settings_overlay",
	        style: {
	            height: "100%",
	            width: "100%",
	            position: "fixed",
	            zIndex: "30",
	            left: "0",
	            top: "0",
	            backgroundColor: "rgba(0,0,0, 0.2)",
	            overflow: "hidden",
	            display: "none",
	            justifyContent: "center",
	        },
	        onclick() {
	            this.style.display = "none";
	        }
	    }, create("div", {
	        id: "settings_dialogue",
	        class: "box has-shadow",
	        style: {
	            width: "100%",
	            position: "fixed",
	            top: "4em",
	            maxWidth: "720px",
	        },
	        onclick(ev) { ev.stopPropagation(); }
	    }, (() => {
	        const notify_box = create("div", { class: "field" });
	        check_for_updates(notify_box);
	        return notify_box;
	    })(), create("div", { class: "field" }, create("label", { class: "label" }, "Theme"), create("div", { class: "control" }, create("div", { class: "select" }, create("select", {
	        onchange() {
	            settings_set_theme(this.value);
	        }
	    }, ...themes.map(name => create("option", { selected: name === current_theme }, name)))))), create("div", { class: "field" }, create("label", { class: "label" }, "Song Table Options")), create("div", { class: "field" }, create("input", {
	        id: "wide_song_table",
	        type: "checkbox",
	        class: "is-checkradio",
	        checked: get_wide_table(),
	        onchange() {
	            set_wide_table(this.checked);
	            check(document.getElementById("wide_song_table_css")).checked = this.checked;
	        }
	    }), create("label", { for: "wide_song_table", class: "checkbox" }, "Always expand table to full width")), create("div", { class: "field" }, create("label", { class: "label" }, "Links")), create("div", { class: "field" }, create("input", {
	        id: "show_bs_link",
	        type: "checkbox",
	        class: "is-checkradio",
	        checked: get_show_bs_link(),
	        onchange() {
	            set_show_bs_link(this.checked);
	            update_button_visibility();
	        }
	    }), create("label", { for: "show_bs_link", class: "checkbox" }, "Show BeatSaver link")), create("div", { class: "field" }, create("input", {
	        id: "show_oc_link",
	        type: "checkbox",
	        class: "is-checkradio",
	        checked: get_show_oc_link(),
	        onchange() {
	            set_show_oc_link(this.checked);
	            update_button_visibility();
	        }
	    }), create("label", { for: "show_oc_link", class: "checkbox" }, "Show OneClick link"))));
	    set_div = document.body.appendChild(set_div);
	    into(get_navbar(), create("a", {
	        id: "settings_menu",
	        class: "navbar-item",
	        style: {
	            cursor: "pointer",
	        },
	        onclick: () => set_div.style.display = "flex",
	    }, create("i", { class: "fas fa-cog" })));
	}
	function settings_set_theme(name) {
	    GM_xmlhttpRequest({
	        method: "GET",
	        headers: {
	            Origin: "unpkg.com",
	        },
	        url: `https://unpkg.com/bulmaswatch/${name.toLowerCase()}/bulmaswatch.min.css`,
	        onload(response) {
	            const css = response.responseText;
	            localStorage.setItem("theme_name", name);
	            localStorage.setItem("theme_css", css);
	            load_theme(name, css);
	        }
	    });
	}
	function load_last_theme() {
	    let theme_name = localStorage.getItem("theme_name");
	    let theme_css = localStorage.getItem("theme_css");
	    if (!theme_name || !theme_css) {
	        theme_name = "Default";
	        theme_css = "";
	    }
	    load_theme(theme_name, theme_css);
	}
	function load_theme(name, css) {
	    let css_fin;
	    if (get_scoresaber_darkmode()
	        || name === "Cyborg" || name === "Darkly" || name === "Nuclear"
	        || name === "Slate" || name === "Solar" || name === "Superhero") {
	        css_fin = css + " " + theme_dark;
	    }
	    else {
	        css_fin = css + " " + theme_light;
	    }
	    if (!Global.style_themed_elem) {
	        Global.style_themed_elem = GM_addStyle(css_fin);
	    }
	    else {
	        Global.style_themed_elem.innerHTML = css_fin;
	    }
	}
	function get_scoresaber_darkmode() {
	    const footer = document.querySelector("footer");
	    if (!footer)
	        return false;
	    return footer.innerText.includes("light mode");
	}
	function update_button_visibility() {
	    if (!is_user_page()) {
	        return;
	    }
	    const table = check(document.querySelector("table.ranking.songs"));
	    table.querySelectorAll("th.bs_link").forEach(bs_link => bs_link.style.display = get_show_bs_link() ? "" : "none");
	    table.querySelectorAll("th.oc_link").forEach(oc_link => oc_link.style.display = get_show_oc_link() ? "" : "none");
	}

	const api_cache$1 = {};
	async function get_data(song_key) {
	    const cached_data = api_cache$1[song_key];
	    if (cached_data)
	        return cached_data;
	    try {
	        const data_str = await fetch2(`https://bsaber.com/wp-json/bsaber-api/songs/${song_key}/ratings`);
	        const data = JSON.parse(data_str);
	        api_cache$1[song_key] = data;
	        return data;
	    }
	    catch (e) {
	        return undefined;
	    }
	}

	function setup_song_filter_tabs() {
	    if (!is_song_leaderboard_page()) {
	        return;
	    }
	    const tab_list_content = check(document.querySelector(".tabs > ul"));
	    function load_friends() {
	        let score_table = check(document.querySelector(".ranking .global > tbody"));
	        Global.song_table_backup = score_table;
	        const table = check(score_table.parentNode);
	        table.removeChild(score_table);
	        score_table = table.appendChild(create("tbody"));
	        const song_id = Global.leaderboard_reg.exec(window.location.pathname)[1];
	        const elements = [];
	        for (const user_id in Global.user_list) {
	            const user = Global.user_list[user_id];
	            const song = user.songs[song_id];
	            if (!song)
	                continue;
	            elements.push([song, generate_song_table_row(user_id, user, song_id)]);
	        }
	        elements.sort((a, b) => { const [sa, sb] = get_song_compare_value(a[0], b[0]); return sb - sa; });
	        elements.forEach(x => score_table.appendChild(x[1]));
	    }
	    function load_all() {
	        if (!Global.song_table_backup) {
	            return;
	        }
	        let score_table = check(document.querySelector(".ranking .global > tbody"));
	        const table = check(score_table.parentNode);
	        table.removeChild(score_table);
	        score_table = table.appendChild(Global.song_table_backup);
	        Global.song_table_backup = undefined;
	    }
	    tab_list_content.appendChild(generate_tab("All Scores", "all_scores_tab", load_all, true, true));
	    tab_list_content.appendChild(generate_tab("Friends", "friends_tab", load_friends, false, false));
	}
	function setup_dl_link_leaderboard() {
	    if (!is_song_leaderboard_page()) {
	        return;
	    }
	    let details_box = check(document.querySelector(".content .title.is-5"));
	    details_box = check(details_box.parentElement);
	    const song_hash = get_song_hash_from_text(details_box.innerHTML);
	    details_box.appendChild(create("div", {
	        id: "leaderboard_tool_strip",
	        style: {
	            marginTop: "1em"
	        }
	    }, generate_bsaber(song_hash), generate_beatsaver(song_hash, "large"), generate_oneclick(song_hash, "large")));
	    const beatsaver_box = create("div", { class: "box" });
	    const beastsaber_box = create("div", { class: "box" });
	    details_box.appendChild(create("div", {
	        class: "columns",
	        style: {
	            marginTop: "1em"
	        }
	    }, create("div", { class: "column" }, create("b", {}, "BeatSaver"), beatsaver_box), create("div", { class: "column" }, create("b", {}, "BeastSaber"), beastsaber_box)));
	    if (!song_hash)
	        return;
	    get_data_by_hash(song_hash)
	        .then(data => {
	        if (data) {
	            show_beatsaver_song_data(beatsaver_box, data);
	            get_data(data.key)
	                .then(data2 => {
	                if (data2) {
	                    show_beastsaber_song_data(beastsaber_box, data2);
	                }
	            });
	        }
	    });
	}
	function show_beatsaver_song_data(elem, data) {
	    into(elem, create("div", { title: "Downloads" }, `💾 ${data.stats.downloads}`), create("div", { title: "Upvotes" }, `👍 ${data.stats.upVotes}`), create("div", { title: "Downvotes" }, `👎 ${data.stats.downVotes}`), create("div", { title: "Beatmap Rating" }, `💯 ${(data.stats.rating * 100).toFixed(2)}%`), create("div", { title: "Heat (Popularity)" }, `🔥 ${data.stats.heat.toFixed(2)}`));
	}
	function show_beastsaber_song_data(elem, data) {
	    into(elem, create("div", { title: "Fun Factor" }, `😃 ${data.average_ratings.fun_factor}`), create("div", { title: "Rhythm" }, `🎶 ${data.average_ratings.rhythm}`), create("div", { title: "Flow" }, `🌊 ${data.average_ratings.flow}`), create("div", { title: "Pattern Quality" }, `💠 ${data.average_ratings.pattern_quality}`), create("div", { title: "Readability" }, `👓 ${data.average_ratings.readability}`), create("div", { title: "Level Quality" }, `✔️ ${data.average_ratings.level_quality}`));
	}
	function generate_song_table_row(user_id, user, song_id) {
	    const song = user.songs[song_id];
	    return create("tr", {}, create("td", { class: "picture" }), create("td", { class: "rank" }, "-"), create("td", { class: "player" }, generate_song_table_player(user_id, user)), create("td", { class: "score" }, song.score ? format_en(song.score, 0) : "-"), create("td", { class: "timeset" }, timeago.format(song.time)), create("td", { class: "mods" }, song.mods ? song.mods.toString() : "-"), create("td", { class: "percentage" }, song.accuracy ? (song.accuracy.toString() + "%") : "-"), create("td", { class: "pp" }, create("span", { class: "scoreTop ppValue" }, format_en(song.pp)), create("span", { class: "scoreTop ppLabel" }, "pp")));
	}
	function generate_song_table_player(user_id, user) {
	    return create("a", { href: `${Global.scoresaber_link}/u/${user_id}` }, user.name);
	}
	function generate_tab(title, css_id, action, is_active, has_offset) {
	    const tabClass = `filter_tab ${toggled_class(is_active, "is-active")} ${toggled_class(has_offset, "offset_tab")}`;
	    return create("li", {
	        id: css_id,
	        class: tabClass,
	    }, create("a", {
	        class: "has-text-info",
	        onclick: () => {
	            document.querySelectorAll(".tabs > ul .filter_tab").forEach(x => x.classList.remove("is-active"));
	            check(document.getElementById(css_id)).classList.add("is-active");
	            if (action)
	                action();
	        }
	    }, title));
	}
	function highlight_user() {
	    const home_user = get_home_user();
	    if (!home_user) {
	        return;
	    }
	    const element = document.querySelector(`table.ranking.global a[href='/u/${home_user.id}']`);
	    if (element != null) {
	        element.parentElement.parentElement.style.backgroundColor = "var(--color-highlight)";
	    }
	}

	setup();
	setup$1();
	load_last_theme();
	load();
	let has_loaded = false;
	function onload() {
	    if (has_loaded) {
	        logc("Already loaded");
	        return;
	    }
	    logc("LOADING");
	    has_loaded = true;
	    setup_dl_link_user_site();
	    setup_user_rank_link_swap();
	    setup_song_rank_link_swap();
	    setup_wide_table_checkbox();
	    setup_dl_link_leaderboard();
	    setup_song_filter_tabs();
	    highlight_user();
	    setup_self_pin_button();
	    setup_self_button();
	    setup_user_compare();
	    setup$2();
	    update_button_visibility();
	    setup_pp_graph();
	}
	if (document.readyState === "complete" || document.readyState === "interactive") {
	    onload();
	}
	window.addEventListener("DOMContentLoaded", onload);
	window.addEventListener("load", onload);
	window.document.addEventListener("load", onload);

}());
//# sourceMappingURL=rollup.js.map
