// ==UserScript==
// @name         ScoreSaberEnhanced
// @version      1.9.2
// @description  Adds links to beatsaver, player comparison and various other improvements
// @author       Splamy, TheAsuro
// @namespace    https://scoresaber.com
// @match        http://scoresaber.com/*
// @match        https://scoresaber.com/*
// @icon         https://scoresaber.com/imports/images/logo.ico
// @updateURL    https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scoresaber.user.js
// @downloadURL  https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scoresaber.user.js
// @require      https://cdn.jsdelivr.net/npm/moment@2.24.0/moment.js
// @run-at       document-start
// for Tampermonkey
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_info
// for Greasemonkey
// @grant        GM.xmlHttpRequest
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
    Global.score_reg = /(score|accuracy):\s*([\d.,]+)%?\s*(\(([\w,]*)\))?/;
    Global.leaderboard_reg = /leaderboard\/(\d+)/;
    Global.leaderboard_rank_reg = /#([\d,]+)/;
    Global.leaderboard_country_reg = /(\?|&)country=(\w+)$/;
    Global.user_reg = /u\/(\d+)/;
    Global.script_version_reg = /\/\/\s*@version\s+([\d.]+)/;
    Global.user_per_page_global_leaderboard = 50;
    Global.user_per_page_song_leaderboard = 12;
    Global.pp_weighting_factor = 0.965;

    function create(tag, attrs, ...children) {
        if (tag === undefined)
            throw new Error("'tag' not defined");
        const ele = document.createElement(tag);
        if (attrs) {
            for (const [attrName, attrValue] of Object.entries(attrs)) {
                if (attrName === "style") {
                    for (const [styleName, styleValue] of Object.entries(attrs.style)) {
                        ele.style[styleName] = styleValue;
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
                    ele.htmlFor = attrValue;
                }
                else if (attrName === "selected") {
                    ele.selected = (attrValue ? "selected" : undefined);
                }
                else if (attrName === "disabled") {
                    if (attrValue)
                        ele.setAttribute("disabled", undefined);
                }
                else if (attrName === "data") {
                    const data_dict = attrs[attrName];
                    for (const [data_key, data_value] of Object.entries(data_dict)) {
                        ele.dataset[data_key] = data_value;
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
                    parent.appendChild(to_node(child));
                }
                else {
                    parent.textContent = child;
                }
            }
            else if ("then" in child) {
                const dummy = document.createElement("DIV");
                parent.appendChild(dummy);
                (async () => {
                    const node = await child;
                    parent.replaceChild(to_node(node), dummy);
                })();
            }
            else {
                parent.appendChild(child);
            }
        }
        return parent;
    }
    function to_node(elem) {
        if (typeof elem === "string") {
            const text_div = document.createElement("DIV");
            text_div.textContent = elem;
            return text_div;
        }
        return elem;
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
        if (Global.last_selected) {
            return Global.last_selected;
        }
        const stored_last = localStorage.getItem("last_selected");
        if (stored_last) {
            Global.last_selected = stored_last;
            return Global.last_selected;
        }
        const compare = document.getElementById("user_compare");
        if (compare === null || compare === void 0 ? void 0 : compare.value) {
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
    function set_use_new_ss_api(value) {
        localStorage.setItem("use_new_api", value ? "true" : "false");
    }
    function get_use_new_ss_api() {
        return (localStorage.getItem("use_new_api") || "true") === "true";
    }
    function set_bsaber_username(value) {
        localStorage.setItem("bsaber_username", value);
    }
    function get_bsaber_username() {
        return (localStorage.getItem("bsaber_username") || undefined);
    }
    function get_bsaber_bookmarks() {
        const data = localStorage.getItem("bsaber_bookmarks");
        if (!data)
            return [];
        return JSON.parse(data);
    }
    function add_bsaber_bookmark(song_hash) {
        const bookmarks = get_bsaber_bookmarks();
        bookmarks.push(song_hash);
        localStorage.setItem("bsaber_bookmarks", JSON.stringify(bookmarks));
    }
    function check_bsaber_bookmark(song_hash) {
        const bookmarks = get_bsaber_bookmarks();
        return bookmarks.includes(song_hash.toLowerCase());
    }
    function get_show_bb_link() {
        return (get_bsaber_bookmarks() !== [] && !!get_bsaber_username());
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
    function number_to_timespan(num) {
        const SECONDS_IN_MINUTE = 60;
        const MINUTES_IN_HOUR = 60;
        let str = "";
        let mod = (num % SECONDS_IN_MINUTE);
        str = mod.toFixed(0).padStart(2, "0") + str;
        num = (num - mod) / SECONDS_IN_MINUTE;
        mod = (num % MINUTES_IN_HOUR);
        str = mod.toFixed(0).padStart(2, "0") + ":" + str;
        num = (num - mod) / MINUTES_IN_HOUR;
        return str;
    }
    function round2(num) {
        return Math.round(num * 100) / 100;
    }
    function read_inline_date(date) {
        return moment.utc(date, "YYYY-MM-DD HH:mm:ss UTC");
    }

    class Limiter {
        constructor() {
            this.ratelimit_reset = undefined;
            this.ratelimit_remaining = undefined;
        }
        async wait() {
            const now = unix_timestamp();
            if (this.ratelimit_reset === undefined || now > this.ratelimit_reset) {
                this.ratelimit_reset = undefined;
                this.ratelimit_remaining = undefined;
                return;
            }
            if (this.ratelimit_remaining === 0) {
                const sleepTime = (this.ratelimit_reset - now);
                console.log(`Waiting for cloudflare rate limiter... ${sleepTime}sec`);
                await sleep(sleepTime * 1000);
                this.ratelimit_remaining = this.ratelimit_limit;
                this.ratelimit_reset = undefined;
            }
        }
        setLimitData(remaining, reset, limit) {
            this.ratelimit_remaining = remaining;
            this.ratelimit_reset = reset;
            this.ratelimit_limit = limit;
        }
    }
    async function sleep(timeout) {
        return new Promise(resolve => setTimeout(resolve, timeout));
    }
    function unix_timestamp() {
        return Math.round((new Date()).getTime() / 1000);
    }

    function setup$3() {
        Global.debug = localStorage.getItem("debug") === "true";
    }
    function logc(message, ...optionalParams) {
        if (Global.debug) {
            console.log("DBG", message, ...optionalParams);
        }
    }

    let SSE_addStyle;
    let SSE_xmlhttpRequest;
    let SSE_info;
    function setup$2() {
        if (typeof (GM) !== "undefined") {
            logc("Using GM.* extenstions", GM);
            SSE_addStyle = GM_addStyle_custom;
            SSE_xmlhttpRequest = GM.xmlHttpRequest;
            SSE_info = GM.info;
        }
        else {
            logc("Using GM_ extenstions");
            SSE_addStyle = GM_addStyle;
            SSE_xmlhttpRequest = GM_xmlhttpRequest;
            SSE_info = GM_info;
        }
    }
    function GM_addStyle_custom(css) {
        const style = create("style");
        style.innerHTML = css;
        into(document.head, style);
        return style;
    }
    async function load_chart_lib() {
        if (typeof Chart !== "function") {
            try {
                const resp = await fetch("https://scoresaber.com/imports/js/chart.js");
                const js = await resp.text();
                new Function(js)();
            }
            catch (err) {
                console.warn("Failed to fetch chartjs. Charts might not work", err);
                return false;
            }
        }
        return true;
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
            SSE_xmlhttpRequest(request_param);
        });
    }
    function get_hostname(url) {
        const match = url.match(/:\/\/([^/:]+)/i);
        if (match !== null) {
            return match[1];
        }
        else {
            return undefined;
        }
    }

    class SessionCache {
        constructor(prefix) {
            this.prefix = prefix;
            if (prefix === undefined)
                throw Error("Prefix must be set. If you don't want a prefix, explicitely pass ''.");
        }
        get(key) {
            const item = sessionStorage.getItem(this.prefix + key);
            if (item === null)
                return undefined;
            return JSON.parse(item);
        }
        set(key, value) {
            sessionStorage.setItem(this.prefix + key, JSON.stringify(value));
        }
    }

    const api_cache$1 = new SessionCache("saver");
    async function get_data_by_hash(song_hash) {
        const cached_data = api_cache$1.get(song_hash);
        if (cached_data !== undefined)
            return cached_data;
        try {
            const data_str = await fetch2(`https://beatsaver.com/api/maps/by-hash/${song_hash}`);
            const data = JSON.parse(data_str);
            api_cache$1.set(song_hash, data);
            return data;
        }
        catch (e) {
            return undefined;
        }
    }

    class Modal {
        constructor(elem) {
            this.elem = elem;
        }
        show() {
            this.elem.classList.add("is-active");
            document.documentElement.classList.add("is-clipped");
        }
        close(answer) {
            this.elem.classList.remove("is-active");
            if (!document.querySelector(".modal.is-active"))
                document.documentElement.classList.remove("is-clipped");
            if (this.after_close)
                this.after_close(answer !== null && answer !== void 0 ? answer : "x");
        }
        dispose() {
            document.body.removeChild(this.elem);
        }
    }
    function create_modal(opt) {
        var _a, _b, _c, _d;
        const base_div = create("div", { class: "modal" });
        const modal = new Modal(base_div);
        const button_bar = create("div", { class: "buttons" });
        let inner;
        switch ((_a = opt.type) !== null && _a !== void 0 ? _a : "content") {
            case "content":
                inner = create("div", { class: "modal-content" }, create("div", { class: "box" }, opt.text, create("br"), button_bar));
                break;
            case "card":
                inner = create("div", { class: "modal-card" }, create("header", { class: "modal-card-head" }, (_b = opt.title) !== null && _b !== void 0 ? _b : ""), create("header", { class: "modal-card-body" }, opt.text), create("header", { class: "modal-card-foot" }, (_c = opt.footer) !== null && _c !== void 0 ? _c : button_bar));
                break;
            default:
                throw new Error("invalid type");
        }
        into(base_div, create("div", {
            class: "modal-background",
            onclick() {
                modal.close("x");
            }
        }), inner, create("button", {
            class: "modal-close is-large",
            onclick() {
                modal.close("x");
            }
        }));
        if (opt.buttons) {
            for (const btn_name of Object.keys(opt.buttons)) {
                const btn_data = opt.buttons[btn_name];
                into(button_bar, create("button", {
                    class: ["button", (_d = btn_data.class) !== null && _d !== void 0 ? _d : ""],
                    onclick() {
                        modal.close(btn_name);
                    }
                }, btn_data.text));
            }
        }
        document.body.appendChild(base_div);
        if (opt.default)
            modal.show();
        return modal;
    }
    function show_modal(opt) {
        return new Promise((resolve) => {
            opt.default = true;
            const modal = create_modal(opt);
            modal.after_close = (answer) => {
                modal.dispose();
                resolve(answer);
            };
        });
    }
    const buttons = {
        OkOnly: { x: { text: "Ok", class: "is-primary" } },
    };

    function get_song_compare_value(song_a, song_b) {
        if (song_a.pp > 0 || song_b.pp > 0) {
            return [song_a.pp, song_b.pp];
        }
        else if (song_a.score !== undefined && song_b.score !== undefined) {
            return [song_a.score, song_b.score];
        }
        else if (song_a.accuracy !== undefined && song_b.accuracy !== undefined) {
            return [song_a.accuracy * get_song_mod_multiplier(song_a), song_b.accuracy * get_song_mod_multiplier(song_b)];
        }
        else {
            return [-1, -1];
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
        const prompt = !lastCheck ||
            new Date(lastCheck).getTime() + (1000 * 60 * 60 * 24 * 31) < new Date().getTime();
        if (prompt) {
            localStorage.setItem("oneclick-prompt", new Date().getTime().toString());
            const resp = await show_modal({
                buttons: {
                    install: { text: "Get ModAssistant Installer", class: "is-info" },
                    done: { text: "OK, now leave me alone", class: "is-success" },
                },
                text: "OneClick™ requires any current ModInstaller tool with the OneClick™ feature enabled.\nMake sure you have one installed before proceeding.",
            });
            if (resp === "install") {
                window.open("https://github.com/Assistant/ModAssistant/releases");
                return;
            }
        }
        console.log("Downloading: ", song_key);
        window.location.assign(`beatsaver://${song_key}`);
    }
    function song_equals(a, b) {
        if (a === b)
            return true;
        if (a === undefined || b === undefined)
            return false;
        return (a.accuracy === b.accuracy &&
            a.pp === b.pp &&
            a.score === b.score &&
            a.time === b.time &&
            array_equals(a.mods, b.mods));
    }
    function array_equals(a, b) {
        if (a === b)
            return true;
        if (a === undefined || b === undefined)
            return false;
        if (a.length !== b.length)
            return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i])
                return false;
        }
        return true;
    }
    function parse_mods(mods) {
        if (!mods)
            return undefined;
        const modarr = mods.split(/,/g);
        if (modarr.length === 0)
            return undefined;
        return modarr;
    }
    function parse_score_bottom(text) {
        let score = undefined;
        let accuracy = undefined;
        let mods = undefined;
        const score_res = check(Global.score_reg.exec(text));
        if (score_res[1] === "score") {
            score = number_invariant(score_res[2]);
        }
        else if (score_res[1] === "accuracy") {
            accuracy = Number(score_res[2]);
        }
        if (score_res[4]) {
            mods = parse_mods(score_res[4]);
        }
        return { score, accuracy, mods };
    }
    function get_notes_count(diff_name, characteristic) {
        var _a;
        let diff;
        switch (diff_name) {
            case "Easy":
                diff = characteristic.difficulties.easy;
                break;
            case "Normal":
                diff = characteristic.difficulties.normal;
                break;
            case "Hard":
                diff = characteristic.difficulties.hard;
                break;
            case "Expert":
                diff = characteristic.difficulties.expert;
                break;
            case "Expert+":
                diff = characteristic.difficulties.expertPlus;
                break;
        }
        return (_a = diff === null || diff === void 0 ? void 0 : diff.notes) !== null && _a !== void 0 ? _a : -1;
    }
    function calculate_max_score(notes) {
        const note_score = 115;
        if (notes <= 1)
            return note_score * (0 + (notes - 0) * 1);
        if (notes <= 5)
            return note_score * (1 + (notes - 1) * 2);
        if (notes <= 13)
            return note_score * (9 + (notes - 5) * 4);
        return note_score * (41 + (notes - 13) * 8);
    }

    const SCORESABER_LINK = "https://new.scoresaber.com/api";
    const API_LIMITER = new Limiter();
    async function get_user_recent_songs_dynamic(user_id, page) {
        logc(`Fetching user ${user_id} page ${page}`);
        if (get_use_new_ss_api()) {
            return get_user_recent_songs_new_api_wrap(user_id, page);
        }
        else {
            return get_user_recent_songs_old_api_wrap(user_id, page);
        }
    }
    async function get_user_recent_songs_new_api_wrap(user_id, page) {
        const recent_songs = await get_user_recent_songs(user_id, page);
        if (!recent_songs) {
            return {
                meta: { was_last_page: true },
                songs: []
            };
        }
        return {
            meta: {
                was_last_page: recent_songs.scores.length < 8
            },
            songs: recent_songs.scores.map(s => [String(s.leaderboardId), {
                    time: s.timeSet,
                    pp: s.pp,
                    accuracy: s.maxScore !== 0 ? round2((s.unmodififiedScore / s.maxScore) * 100) : undefined,
                    score: s.score,
                    mods: parse_mods(s.mods)
                }])
        };
    }
    async function get_user_recent_songs(user_id, page) {
        const req = await auto_fetch_retry(`${SCORESABER_LINK}/player/${user_id}/scores/recent/${page}`);
        if (req.status === 404) {
            return null;
        }
        const data = await req.json();
        return sanitize_song_ids(data);
    }
    async function get_user_info_basic(user_id) {
        const req = await auto_fetch_retry(`${SCORESABER_LINK}/player/${user_id}/basic`);
        const data = await req.json();
        return sanitize_player_ids(data);
    }
    async function auto_fetch_retry(url) {
        const MAX_RETRIES = 20;
        const SLEEP_WAIT = 5000;
        for (let retries = MAX_RETRIES; retries >= 0; retries--) {
            await API_LIMITER.wait();
            const response = await fetch(url);
            const remaining = Number(response.headers.get("x-ratelimit-remaining"));
            const reset = Number(response.headers.get("x-ratelimit-reset"));
            const limit = Number(response.headers.get("x-ratelimit-limit"));
            API_LIMITER.setLimitData(remaining, reset, limit);
            if (response.status === 429) {
                await sleep(SLEEP_WAIT);
            }
            else {
                return response;
            }
        }
        throw new Error("Can't fetch data from new.scoresaber.");
    }
    function sanitize_player_ids(data) {
        data.playerInfo.playerId = String(data.playerInfo.playerId);
        return data;
    }
    function sanitize_song_ids(data) {
        for (const s of data.scores) {
            s.scoreId = String(s.scoreId);
            s.leaderboardId = String(s.leaderboardId);
            s.playerId = String(s.playerId);
        }
        return data;
    }
    async function get_user_recent_songs_old_api_wrap(user_id, page) {
        let doc;
        let tries = 5;
        while ((!doc || doc.body.textContent === '"Rate Limit Exceeded"') && tries > 0) {
            await sleep(500);
            doc = await fetch_user_page(user_id, page);
            tries--;
        }
        if (doc === undefined) {
            throw Error("Error fetching user page");
        }
        const last_page_elem = doc.querySelector("nav ul.pagination-list li:last-child a");
        const max_pages = Number(last_page_elem.innerText) + 1;
        const data = {
            meta: {
                max_pages,
                user_name: get_document_user(doc).name,
                was_last_page: page === max_pages,
            },
            songs: [],
        };
        const table_row = doc.querySelectorAll("table.ranking.songs tbody tr");
        for (const row of table_row) {
            const song_data = get_row_data(row);
            data.songs.push(song_data);
        }
        return data;
    }
    async function fetch_user_page(user_id, page) {
        const link = Global.scoresaber_link + `/u/${user_id}&page=${page}&sort=2`;
        if (window.location.href.toLowerCase() === link) {
            logc("Efficient get :P");
            return document;
        }
        const init_fetch = await (await fetch(link)).text();
        const parser = new DOMParser();
        return parser.parseFromString(init_fetch, "text/html");
    }
    function get_row_data(row) {
        const rowc = row;
        if (rowc.cache) {
            return rowc.cache;
        }
        const leaderboard_elem = check(row.querySelector("th.song a"));
        const pp_elem = check(row.querySelector("th.score .ppValue"));
        const score_elem = check(row.querySelector("th.score .scoreBottom"));
        const time_elem = check(row.querySelector("th.song .time"));
        const song_id = Global.leaderboard_reg.exec(leaderboard_elem.href)[1];
        const pp = Number(pp_elem.innerText);
        const time = read_inline_date(time_elem.title).toISOString();
        const { score, accuracy, mods } = parse_score_bottom(score_elem.innerText);
        const song = {
            pp,
            time,
            score,
            accuracy,
            mods,
        };
        const data = [song_id, song];
        rowc.cache = data;
        return data;
    }

    class SseEventHandler {
        constructor(eventName) {
            this.eventName = eventName;
            this.callList = [];
        }
        invoke(param) {
            logc("Event", this.eventName);
            for (const func of this.callList) {
                func(param);
            }
        }
        register(func) {
            this.callList.push(func);
        }
    }
    class SseEvent {
        static addNotification(notify) {
            this.notificationList.push(notify);
            SseEvent.UserNotification.invoke();
        }
        static getNotifications() {
            return this.notificationList;
        }
    }
    SseEvent.UserCacheChanged = new SseEventHandler("UserCacheChanged");
    SseEvent.CompareUserChanged = new SseEventHandler("CompareUserChanged");
    SseEvent.PinnedUserChanged = new SseEventHandler("PinnedUserChanged");
    SseEvent.UserNotification = new SseEventHandler("UserNotification");
    SseEvent.StatusInfo = new SseEventHandler("StatusInfo");
    SseEvent.notificationList = [];

    const CURRENT_DATA_VER = 1;
    function load() {
        const json = localStorage.getItem("users");
        if (!json) {
            reset_data();
            return;
        }
        try {
            Global.user_list = JSON.parse(json);
        }
        catch (ex) {
            console.error("Failed to read user cache, resetting!");
            reset_data();
            return;
        }
        let users_data_ver = get_data_ver();
        if (users_data_ver !== CURRENT_DATA_VER) {
            logc("Updating usercache format");
            if (users_data_ver <= 0) {
                for (const user of Object.values(Global.user_list)) {
                    for (const song of Object.values(user.songs)) {
                        const time = read_inline_date(song.time);
                        song.time = time.toISOString();
                    }
                }
                users_data_ver = 1;
            }
            update_data_ver();
            save();
            logc("Update successful");
        }
        logc("Loaded usercache", Global.user_list);
    }
    function reset_data() {
        Global.user_list = {};
        localStorage.setItem("users", "{}");
        update_data_ver();
    }
    function get_data_ver() {
        var _a;
        return Number((_a = localStorage.getItem("users_data_ver")) !== null && _a !== void 0 ? _a : "0");
    }
    function update_data_ver() {
        localStorage.setItem("users_data_ver", String(CURRENT_DATA_VER));
    }
    function save() {
        localStorage.setItem("users", JSON.stringify(Global.user_list));
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
        const status_elem = create("div");
        into(header, status_elem);
        SseEvent.StatusInfo.register((status) => intor(status_elem, status.text));
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
        }, ...Object.entries(Global.user_list).map(([id, user]) => {
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
                other_score_content = [
                    create("span", { class: "scoreTop ppValue" }, format_en(other_song.pp)),
                    create("span", { class: "scoreTop ppLabel" }, "pp"),
                    create("br"),
                    (() => {
                        let str;
                        if (other_song.accuracy !== undefined) {
                            str = `accuracy: ${format_en(other_song.accuracy)}%`;
                        }
                        else if (other_song.score !== undefined) {
                            str = `score: ${format_en(other_song.score)}`;
                        }
                        else {
                            return "<No Data>";
                        }
                        if (other_song.mods !== undefined) {
                            str += ` (${other_song.mods.join(",")})`;
                        }
                        return create("span", { class: "scoreBottom" }, str);
                    })()
                ];
            }
            else {
                other_score_content = [create("hr", {})];
            }
            check(row.querySelector(".score")).insertAdjacentElement("afterend", create("th", { class: "comparisonScore" }, ...other_score_content));
            if (!other_song) {
                logc("No match");
                continue;
            }
            const [value1, value2] = get_song_compare_value(song, other_song);
            if (value1 === -1 && value2 === -1) {
                logc("No score");
                continue;
            }
            let value = (Math.min(value1, value2) / Math.max(value1, value2)) * 100;
            const better = value1 > value2;
            if (better) {
                value = 100 - value;
            }
            value = round2(value);
            if (better) {
                row.style.backgroundImage = `linear-gradient(75deg, var(--color-ahead) ${value}%, rgba(0,0,0,0) ${value}%)`;
            }
            else {
                row.style.backgroundImage = `linear-gradient(105deg, rgba(0,0,0,0) ${value}%, var(--color-behind) ${value}%)`;
            }
        }
    }
    async function fetch_user(user_id, force = false) {
        var _a, _b;
        let user = Global.user_list[user_id];
        if (!user) {
            user = {
                name: "User" + user_id,
                songs: {}
            };
            Global.user_list[user_id] = user;
        }
        let page_max = undefined;
        let user_name = user.name;
        let updated = false;
        SseEvent.StatusInfo.invoke({ text: `Fetching user ${user_name}` });
        if (get_use_new_ss_api()) {
            const user_data = await get_user_info_basic(user_id);
            user_name = user_data.playerInfo.playerName;
        }
        for (let page = 1;; page++) {
            SseEvent.StatusInfo.invoke({ text: `Updating user ${user_name} page ${page}/${(page_max !== null && page_max !== void 0 ? page_max : "?")}` });
            const recent_songs = await get_user_recent_songs_dynamic(user_id, page);
            const { has_old_entry, has_updated } = process_user_page(recent_songs.songs, user);
            updated = updated || has_updated;
            page_max = (_a = recent_songs.meta.max_pages) !== null && _a !== void 0 ? _a : page_max;
            user_name = (_b = recent_songs.meta.user_name) !== null && _b !== void 0 ? _b : user_name;
            if ((!force && has_old_entry) || recent_songs.meta.was_last_page) {
                break;
            }
        }
        user.name = user_name !== null && user_name !== void 0 ? user_name : user.name;
        if (updated) {
            save();
        }
        SseEvent.StatusInfo.invoke({ text: `User ${user_name} updated` });
        SseEvent.UserCacheChanged.invoke();
    }
    async function fetch_all(force = false) {
        const users = Object.keys(Global.user_list);
        for (const user of users) {
            await fetch_user(user, force);
        }
        SseEvent.StatusInfo.invoke({ text: `All users updated` });
    }
    function process_user_page(songs, user) {
        let has_old_entry = false;
        let has_updated = false;
        for (const [song_id, song] of songs) {
            const song_old = user.songs[song_id];
            if (!song_old || !song_equals(song_old, song)) {
                logc("Updated: ", song_old, song);
                has_updated = true;
            }
            else {
                logc("Old found: ", song);
                has_old_entry = true;
            }
            user.songs[song_id] = song;
        }
        return { has_old_entry, has_updated };
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
        const home_user = (_a = get_home_user()) !== null && _a !== void 0 ? _a : { name: "<Pins>", id: "0" };
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
        const home_user = (_a = get_home_user()) !== null && _a !== void 0 ? _a : { name: "<Pins>", id: "0" };
        const home_elem = document.getElementById("home_user");
        if (home_elem) {
            home_elem.href = Global.scoresaber_link + "/u/" + home_user.id;
            home_elem.innerText = home_user.name;
        }
    }
    function update_self_user_list() {
        const home_user_list_elem = check(document.getElementById("home_user_list"));
        intor(home_user_list_elem, ...Object.entries(Global.user_list).map(([id, user]) => {
            return create("a", {
                class: "navbar-item",
                style: {
                    paddingRight: "1em",
                    flexWrap: "nowrap",
                    display: "flex",
                },
                href: Global.scoresaber_link + "/u/" + id,
            }, create("div", { style: { flex: "1" } }, user.name), create("div", {
                class: "button icon is-medium is-danger is-outlined",
                style: { marginLeft: "3em" },
                async onclick(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const response = await show_modal({
                        text: `Delete User "${user.name}" from cache?`,
                        buttons: {
                            delete: { text: "Delete", class: "is-danger" },
                            x: { text: "Abort", class: "is-info" }
                        },
                    });
                    if (response === "delete") {
                        logc("Delete user", id, user.name);
                        delete_user(id);
                    }
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

    const api_cache = new SessionCache("beast");
    async function get_data(song_key) {
        const cached_data = api_cache.get(song_key);
        if (cached_data !== undefined)
            return cached_data;
        try {
            const data_str = await fetch2(`https://bsaber.com/wp-json/bsaber-api/songs/${song_key}/ratings`);
            const data = JSON.parse(data_str);
            api_cache.set(song_key, data);
            return data;
        }
        catch (e) {
            return undefined;
        }
    }
    async function get_bookmarks(username, page, count) {
        try {
            const data_str = await fetch2(`https://bsaber.com/wp-json/bsaber-api/songs/?bookmarked_by=${username}&page=${page}&count=${count}`);
            const data = JSON.parse(data_str);
            return data;
        }
        catch (e) {
            return undefined;
        }
    }

    function generate_beatsaver(song_hash, size) {
        return create("div", {
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
    function generate_bsaber_bookmark(song_hash, size) {
        const bookmarked = song_hash === undefined ? false : check_bsaber_bookmark(song_hash);
        const color = bookmarked ? "is-success" : "is-danger";
        const tooltip = bookmarked ? "Bookmarked on BeastSaber" : "Not Bookmarked on BeastSaber";
        return create("div", {
            class: `button icon is-${size} ${color} ${toggled_class(size !== "large", "has-tooltip-left")}`,
            style: {
                cursor: song_hash === undefined ? "default" : "pointer",
                padding: "0",
            },
            disabled: song_hash === undefined,
            data: { tooltip: tooltip },
            onclick() {
                checked_hash_to_song_info(this, song_hash)
                    .then(song_info => new_page(Global.bsaber_songs_link + song_info.key))
                    .catch(() => failed_to_download(this));
            },
        }, create("i", { class: `fas fa-thumbtack` }));
    }
    function generate_preview(song_hash) {
        return create("div", {
            class: "button icon is-large",
            style: {
                cursor: song_hash === undefined ? "default" : "pointer",
                padding: "0",
            },
            disabled: song_hash === undefined,
            data: { tooltip: "Preview map" },
            onclick() {
                checked_hash_to_song_info(this, song_hash)
                    .then(song_info => new_page("https://skystudioapps.com/bs-viewer/?id=" + song_info.key))
                    .catch(() => failed_to_download(this));
            },
        }, create("i", { class: "fas fa-glasses" }));
    }
    function generate_copy_bsr(song_hash) {
        const txtDummyNode = create("input", {
            style: {
                position: "absolute",
                top: "0px",
                left: "-100000px",
            }
        });
        return create("a", {
            class: "button icon is-large",
            style: {
                cursor: song_hash === undefined ? "default" : "pointer",
                padding: "0",
            },
            disabled: song_hash === undefined,
            data: { tooltip: "Copy !bsr" },
            onclick() {
                checked_hash_to_song_info(this, song_hash)
                    .then(song_info => {
                    txtDummyNode.value = `!bsr ${song_info.key}`;
                    txtDummyNode.select();
                    txtDummyNode.setSelectionRange(0, 99999);
                    document.execCommand("copy");
                    ok_after_download(this);
                })
                    .catch(() => failed_to_download(this));
            },
        }, txtDummyNode, create("i", { class: "fas fa-exclamation" }));
    }
    async function checked_hash_to_song_info(ref, song_hash) {
        reset_download_visual(ref);
        if (song_hash === undefined) {
            failed_to_download(ref);
            throw new Error("song_hash is undefined");
        }
        const song_info = await get_data_by_hash(song_hash);
        if (song_info === undefined) {
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

    class Lazy {
        constructor(generator) {
            this.generator = generator;
        }
        get() {
            if (this.generator !== undefined) {
                this.value = this.generator();
                this.generator = undefined;
            }
            return this.value;
        }
    }

    const shared = new Lazy(() => {
        let details_box = check(document.querySelector(".content .title.is-5"));
        details_box = check(details_box.parentElement);
        const song_hash = get_song_hash_from_text(details_box.innerHTML);
        return { song_hash, details_box };
    });
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
            for (const [user_id, user] of Object.entries(Global.user_list)) {
                const song = user.songs[song_id];
                if (!song)
                    continue;
                elements.push([song, generate_song_table_row(user_id, user, song)]);
            }
            elements.sort((a, b) => { const [sa, sb] = get_song_compare_value(a[0], b[0]); return sb - sa; });
            elements.forEach(x => score_table.appendChild(x[1]));
            add_percentage$1();
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
            add_percentage$1();
        }
        tab_list_content.appendChild(generate_tab("All Scores", "all_scores_tab", load_all, true, true));
        tab_list_content.appendChild(generate_tab("Friends", "friends_tab", load_friends, false, false));
    }
    function setup_dl_link_leaderboard() {
        if (!is_song_leaderboard_page()) {
            return;
        }
        const { song_hash, details_box } = shared.get();
        details_box.appendChild(create("div", {
            id: "leaderboard_tool_strip",
            style: {
                marginTop: "1em"
            }
        }, generate_bsaber(song_hash), generate_beatsaver(song_hash, "large"), generate_oneclick(song_hash, "large"), generate_preview(song_hash), generate_bsaber_bookmark(song_hash, "large"), generate_copy_bsr(song_hash)));
        const box_style = { class: "box", style: { display: "flex", flexDirection: "column", alignItems: "end", padding: "0.5em 1em" } };
        const beatsaver_box = create("div", box_style, create("b", {}, "BeatSaver"), create("span", { class: "icon" }, create("i", { class: "fas fa-spinner fa-pulse" })));
        const beastsaber_box = create("div", box_style, create("b", {}, "BeastSaber"), create("span", { class: "icon" }, create("i", { class: "fas fa-spinner fa-pulse" })));
        const column_style = { class: "column", style: { padding: "0 0.75em" } };
        details_box.appendChild(create("div", {
            class: "columns",
            style: {
                marginTop: "1em"
            }
        }, create("div", column_style, beatsaver_box), create("div", column_style, beastsaber_box)));
        if (!song_hash)
            return;
        (async () => {
            const data = await get_data_by_hash(song_hash);
            if (!data)
                return;
            show_beatsaver_song_data(beatsaver_box, data);
            const data2 = await get_data(data.key);
            if (!data2)
                return;
            show_beastsaber_song_data(beastsaber_box, data2);
        })();
    }
    function show_beatsaver_song_data(elem, data) {
        intor(elem, create("div", { title: "Downloads" }, `${data.stats.downloads} 💾`), create("div", { title: "Upvotes" }, `${data.stats.upVotes} 👍`), create("div", { title: "Downvotes" }, `${data.stats.downVotes} 👎`), create("div", { title: "Beatmap Rating" }, `${(data.stats.rating * 100).toFixed(2)}% 💯`), create("div", { title: "Beatmap Duration" }, `${number_to_timespan(data.metadata.duration)} ⏱`));
    }
    function show_beastsaber_song_data(elem, data) {
        intor(elem, create("div", { title: "Fun Factor" }, `${data.average_ratings.fun_factor} 😃`), create("div", { title: "Rhythm" }, `${data.average_ratings.rhythm} 🎶`), create("div", { title: "Flow" }, `${data.average_ratings.flow} 🌊`), create("div", { title: "Pattern Quality" }, `${data.average_ratings.pattern_quality} 💠`), create("div", { title: "Readability" }, `${data.average_ratings.readability} 👓`), create("div", { title: "Level Quality" }, `${data.average_ratings.level_quality} ✔️`));
    }
    function generate_song_table_row(user_id, user, song) {
        return create("tr", {}, create("td", { class: "picture" }), create("td", { class: "rank" }, "-"), create("td", { class: "player" }, generate_song_table_player(user_id, user)), create("td", { class: "score" }, song.score !== undefined ? format_en(song.score, 0) : "-"), create("td", { class: "timeset" }, moment(song.time).fromNow()), create("td", { class: "mods" }, song.mods !== undefined ? song.mods.toString() : "-"), create("td", { class: "percentage" }, song.accuracy ? (song.accuracy.toString() + "%") : "-"), create("td", { class: "pp" }, create("span", { class: "scoreTop ppValue" }, format_en(song.pp)), create("span", { class: "scoreTop ppLabel" }, "pp")));
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
    function add_percentage$1() {
        if (!is_song_leaderboard_page()) {
            return;
        }
        const { song_hash } = shared.get();
        if (!song_hash) {
            return;
        }
        (async () => {
            const data = await get_data_by_hash(song_hash);
            if (!data)
                return;
            const diff_name = check(document.querySelector(`div.tabs li.is-active span`)).innerText;
            const standard_characteristic = data.metadata.characteristics.find(c => c.name === "Standard");
            if (!diff_name || !standard_characteristic)
                return;
            const notes = get_notes_count(diff_name, standard_characteristic);
            if (notes < 0)
                return;
            const max_score = calculate_max_score(notes);
            const user_scores = document.querySelectorAll("table.ranking.global tbody > tr");
            for (const score_row of user_scores) {
                const percentage_column = check(score_row.querySelector("td.percentage"));
                const percentage_value = percentage_column.innerText;
                if (percentage_value === "-") {
                    const score = check(score_row.querySelector("td.score")).innerText;
                    const score_num = number_invariant(score);
                    const calculated_percentage = (100 * score_num / max_score).toFixed(2);
                    percentage_column.innerText = calculated_percentage + "%";
                }
            }
        })();
    }

    function setup_dl_link_user_site() {
        if (!is_user_page()) {
            return;
        }
        const table = check(document.querySelector("table.ranking.songs"));
        const table_tr = check(table.querySelector("thead tr"));
        into(table_tr, create("th", { class: "compact bs_link" }, "BS"));
        into(table_tr, create("th", { class: "compact oc_link" }, "OC"));
        into(table_tr, create("th", { class: "compact bb_link" }, "BB"));
        const table_row = table.querySelectorAll("tbody tr");
        for (const row of table_row) {
            const image_link = check(row.querySelector("th.song img")).src;
            const song_hash = get_song_hash_from_text(image_link);
            into(row, create("th", { class: "compact bs_link" }, generate_beatsaver(song_hash, "medium")));
            into(row, create("th", { class: "compact oc_link" }, generate_oneclick(song_hash, "medium")));
            into(row, create("th", { class: "compact bb_link" }, generate_bsaber_bookmark(song_hash, "medium")));
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
        const elem_ranking_links = document.querySelectorAll(".content div.columns ul > li > a");
        console.assert(elem_ranking_links.length >= 2, elem_ranking_links);
        const elem_global = elem_ranking_links[0];
        const res_global = check(Global.leaderboard_rank_reg.exec(elem_global.innerText));
        const rank_global = number_invariant(res_global[1]);
        elem_global.href = Global.scoresaber_link + "/global/" + rank_to_page(rank_global, Global.user_per_page_global_leaderboard);
        const elem_country = elem_ranking_links[1];
        const res_country = check(Global.leaderboard_rank_reg.exec(elem_country.innerText));
        const country_str = check(Global.leaderboard_country_reg.exec(elem_country.href));
        const number_country = number_invariant(res_country[1]);
        elem_country.href = Global.scoresaber_link +
            "/global/" + rank_to_page(number_country, Global.user_per_page_global_leaderboard) +
            "?country=" + country_str[2];
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
    function add_percentage() {
        if (!is_user_page()) {
            return;
        }
        const table = check(document.querySelector("table.ranking.songs"));
        const table_row = table.querySelectorAll("tbody tr");
        for (const row of table_row) {
            const image_link = check(row.querySelector("th.song img")).src;
            const song_hash = get_song_hash_from_text(image_link);
            if (!song_hash) {
                return;
            }
            const score_column = check(row.querySelector(`th.score`));
            if (!score_column.innerText || score_column.innerText.includes("%")) {
                continue;
            }
            (async () => {
                const data = await get_data_by_hash(song_hash);
                if (!data)
                    return;
                const song_column = check(row.querySelector(`th.song`));
                const diff_name = check(song_column.querySelector(`span > span`)).innerText;
                const standard_characteristic = data.metadata.characteristics.find(c => c.name === "Standard");
                if (!diff_name || !standard_characteristic)
                    return;
                const notes = get_notes_count(diff_name, standard_characteristic);
                if (notes < 0)
                    return;
                const max_score = calculate_max_score(notes);
                const user_score = check(score_column.querySelector(".scoreBottom")).innerText;
                const { score } = parse_score_bottom(user_score);
                if (score !== undefined) {
                    const calculated_percentage = (100 * score / max_score).toFixed(2);
                    check(score_column.querySelector(".ppWeightedValue")).innerHTML = `(${calculated_percentage}%)`;
                }
            })();
        }
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
            class: "button"
        }, opt.text);
        btn.view_class = `is-${(_a = opt.type) !== null && _a !== void 0 ? _a : "primary"}`;
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
        set_state(btn, (_b = opt.default) !== null && _b !== void 0 ? _b : false);
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
    async function chartUserData(canvasContext, datasets, labels) {
        if (chart !== undefined) {
            chart.data = {
                labels,
                datasets
            };
            chart.update();
            return;
        }
        if (!await load_chart_lib())
            return;
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
        Object.values(user.songs)
            .filter((song) => song.pp > 0)
            .sort((a, b) => b.pp - a.pp)
            .forEach((song, index) => {
            const pp = song.pp;
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

/* Fix bulma+scoresable dark color */
/* Theme CSS will be appended and can therefore
 * conveniently overwrite those rules.
 * This makes them effectively useful for the default
 * Light/Dark Themes of ScoreSaber */

.navbar-dropdown, .modal-card-head, .modal-card-foot {
	color: var(--textColor, black);
	background-color: var(--background, white);
	border-color: var(--foreground, #dbdbdb);
}

.box, .modal-card-body {
	color: var(--textColor, black);
	background-color: var(--background, white);
}
`;
        SSE_addStyle(style_data);
        into(document.head, create("link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/bulma-checkradio/dist/css/bulma-checkradio.min.css" }));
    }

    let notify_box;
    let settings_modal;
    function setup() {
        notify_box = create("div", { class: "field" });
        const cog = create("i", { class: "fas fa-cog" });
        into(get_navbar(), create("a", {
            id: "settings_menu",
            class: "navbar-item",
            style: {
                cursor: "pointer",
            },
            onclick: () => show_settings_lazy(),
        }, cog));
        SseEvent.UserNotification.register(() => {
            const ntfys = SseEvent.getNotifications();
            if (ntfys.length > 0) {
                cog.classList.remove("fa-cog");
                cog.classList.add("fa-bell");
                cog.style.color = "yellow";
            }
            else {
                cog.classList.remove("fa-bell");
                cog.classList.add("fa-cog");
                cog.style.color = "";
            }
            if (!notify_box)
                return;
            clear_children(notify_box);
            for (const ntfy of ntfys) {
                into(notify_box, create("div", { class: `notification is-${ntfy.type}` }, ntfy.msg));
            }
        });
    }
    function show_settings_lazy() {
        var _a, _b;
        if (settings_modal) {
            settings_modal.show();
            return;
        }
        const current_theme = (_a = localStorage.getItem("theme_name")) !== null && _a !== void 0 ? _a : "Default";
        const status_box = create("div", {});
        SseEvent.StatusInfo.register((status) => intor(status_box, status.text));
        const set_div = create("div", {}, check(notify_box), create("div", { class: "field" }, create("label", { class: "label" }, "Theme"), create("div", { class: "control" }, create("div", { class: "select" }, create("select", {
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
        }), create("label", { for: "show_oc_link", class: "checkbox" }, "Show OneClick link")), create("div", { class: "field" }, create("label", { class: "label" }, "Other")), create("div", { class: "field" }, create("input", {
            id: "use_new_ss_api",
            type: "checkbox",
            class: "is-checkradio",
            checked: get_use_new_ss_api(),
            onchange() {
                set_use_new_ss_api(this.checked);
            }
        }), create("label", { for: "use_new_ss_api", class: "checkbox" }, "Use new ScoreSaber api")), create("div", { class: "field" }, create("label", { class: "label" }, "Tools")), create("div", { class: "field" }, create("div", { class: "buttons" }, create("button", {
            class: "button",
            async onclick() {
                await fetch_all();
            }
        }, "Update All User"), create("button", {
            class: "button is-danger",
            async onclick() {
                const resp = await show_modal({
                    text: "Warning: This might take a long time, depending " +
                        "on how many users you have in your library list and " +
                        "how many songs they have on ScoreSaber.\n" +
                        "Use this only when all pp is fucked again.\n" +
                        "And have mercy on the ScoreSaber servers.",
                    buttons: {
                        ok: { text: "Continue", class: "is-success" },
                        x: { text: "Cancel", class: "is-danger" }
                    }
                });
                if (resp === "ok") {
                    await fetch_all(true);
                }
            }
        }, "Force Update All User"))), create("div", { class: "field" }, create("label", { class: "label" }, "Beastsaber Bookmarks")), create("div", { class: "field has-addons" }, create("div", { class: "control has-icons-left" }, create("input", {
            id: "bsaber_username",
            type: "text",
            class: "input",
            placeholder: "username",
            value: (_b = get_bsaber_username()) !== null && _b !== void 0 ? _b : "",
            onchange() {
                set_bsaber_username(this.value);
                update_button_visibility();
            }
        }), create("span", { class: "icon is-small is-left" }, create("i", { class: "fas fa-user fa-xs" }))), create("div", { class: "control" }, create("button", {
            class: "button bsaber_update_bookmarks",
            data: { tooltip: "Load Bookmarks" },
            async onclick() {
                const bsaber_username = get_bsaber_username();
                if (!bsaber_username) {
                    await show_modal({ text: "Please enter a username first.", buttons: buttons.OkOnly });
                    return;
                }
                await update_bsaber_bookmark_cache(this.firstElementChild, bsaber_username);
            },
        }, create("i", { class: "fas fa-sync" })))), create("br"));
        settings_modal = create_modal({
            title: "Options",
            text: set_div,
            footer: status_box,
            type: "card",
            default: true,
        });
    }
    async function settings_set_theme(name) {
        let css = "";
        if (name !== "Default") {
            css = await fetch2(`https://unpkg.com/bulmaswatch/${name.toLowerCase()}/bulmaswatch.min.css`);
        }
        localStorage.setItem("theme_name", name);
        localStorage.setItem("theme_css", css);
        load_theme(name, css);
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
            Global.style_themed_elem = SSE_addStyle(css_fin);
        }
        else {
            Global.style_themed_elem.innerHTML = css_fin;
        }
    }
    function get_scoresaber_darkmode() {
        return document.cookie.includes("dark=1");
    }
    async function update_bsaber_bookmark_cache(button, username) {
        button.classList.add("fa-spin");
        for (let page = 1;; page++) {
            SseEvent.StatusInfo.invoke({ text: `Loading BeastSaber page ${page}` });
            const bookmarks = await get_bookmarks(username, page, 50);
            if (!bookmarks)
                break;
            process_bookmarks(bookmarks.songs);
            if (bookmarks.next_page === null) {
                break;
            }
        }
        SseEvent.StatusInfo.invoke({ text: "Finished loading BeastSaber bookmarks" });
        button.classList.remove("fa-spin");
    }
    function process_bookmarks(songs) {
        for (const song of songs) {
            if (!song.hash) {
                continue;
            }
            if (!check_bsaber_bookmark(song.hash)) {
                add_bsaber_bookmark(song.hash);
            }
        }
    }
    function update_button_visibility() {
        if (!is_user_page()) {
            return;
        }
        const table = check(document.querySelector("table.ranking.songs"));
        const bs_view = get_show_bs_link() ? "" : "none";
        table.querySelectorAll("th.bs_link").forEach(bs_link => bs_link.style.display = bs_view);
        const oc_view = get_show_oc_link() ? "" : "none";
        table.querySelectorAll("th.oc_link").forEach(oc_link => oc_link.style.display = oc_view);
        const bb_view = get_show_bb_link() ? "" : "none";
        table.querySelectorAll("th.bb_link").forEach(bb_link => bb_link.style.display = bb_view);
    }

    async function check_for_updates() {
        const current_version = SSE_info.script.version;
        const update_check = localStorage.getItem("update_check");
        if (update_check && Number(update_check) >= new Date().getTime()) {
            return;
        }
        const latest_script = await fetch2(`https://raw.githubusercontent.com/Splamy/ScoreSaberEnhanced/master/scoresaber.user.js`);
        const latest_version = Global.script_version_reg.exec(latest_script)[1];
        if (current_version !== latest_version) {
            SseEvent.addNotification({ msg: "An update is available", type: "warning" });
        }
        else {
            const now = new Date();
            now.setDate(now.getDate() + 1);
            localStorage.setItem("update_check", now.getTime().toString());
        }
    }

    setup$3();
    setup$2();
    load();
    let has_loaded_head = false;
    function on_load_head() {
        if (!document.head) {
            logc("Head not ready");
            return;
        }
        if (has_loaded_head) {
            logc("Already loaded head");
            return;
        }
        has_loaded_head = true;
        logc("Loading head");
        setup$1();
        load_last_theme();
    }
    let has_loaded_body = false;
    function on_load_body() {
        if (document.readyState !== "complete" && document.readyState !== "interactive") {
            logc("Body not ready");
            return;
        }
        if (has_loaded_body) {
            logc("Already loaded body");
            return;
        }
        has_loaded_body = true;
        logc("Loading body");
        setup_dl_link_user_site();
        add_percentage();
        setup_user_rank_link_swap();
        setup_song_rank_link_swap();
        setup_wide_table_checkbox();
        setup_dl_link_leaderboard();
        setup_song_filter_tabs();
        highlight_user();
        add_percentage$1();
        setup_self_pin_button();
        setup_self_button();
        setup_user_compare();
        setup();
        update_button_visibility();
        setup_pp_graph();
        check_for_updates();
    }
    function onload() {
        on_load_head();
        on_load_body();
    }
    onload();
    window.addEventListener("DOMContentLoaded", onload);
    window.addEventListener("load", onload);

}());
//# sourceMappingURL=rollup.js.map
