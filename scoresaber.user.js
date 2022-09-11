// ==UserScript==
// @name         ScoreSaberEnhanced
// @version      2.0.0-beta.0
// @description  Adds links to beatsaver, player comparison and various other improvements
// @author       Splamy, TheAsuro
// @namespace    https://scoresaber.com
// @match        http://scoresaber.com/*
// @match        https://scoresaber.com/*
// @icon         https://scoresaber.com/favicon-32x32.png
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
// @connect      beatsaver.com
// @connect      githubusercontent.com
// @connect      bsaber.com
// ==/UserScript==

(function () {
    'use strict';

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

    class Global {
    }
    Global.debug = false;
    Global.scoresaber_link = "https://scoresaber.com";
    Global.beatsaver_link = "https://beatsaver.com/maps/";
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

    function setup$1() {
        Global.debug = localStorage.getItem("debug") === "true";
    }
    function logc(message, ...optionalParams) {
        if (Global.debug) {
            console.log("DBG", message, ...optionalParams);
        }
    }

    let SSE_xmlhttpRequest;
    function setup() {
        if (typeof (GM) !== "undefined") {
            logc("Using GM.* extenstions", GM);
            SSE_xmlhttpRequest = GM.xmlHttpRequest;
            GM.info;
        }
        else {
            logc("Using GM_ extenstions");
            GM_addStyle;
            SSE_xmlhttpRequest = GM_xmlhttpRequest;
            GM_info;
        }
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
    function new_page(link) {
        window.open(link, "_blank");
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

    const api_cache$1 = new SessionCache("beast");
    async function get_data(song_key) {
        const cached_data = api_cache$1.get(song_key);
        if (cached_data !== undefined)
            return cached_data;
        try {
            const data_str = await fetch2(`https://bsaber.com/wp-json/bsaber-api/songs/${song_key}/ratings`);
            const data = JSON.parse(data_str);
            api_cache$1.set(song_key, data);
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
                inner = create("div", { class: "modal-card" }, create("header", { class: "modal-card-head" }, (_b = opt.title) !== null && _b !== void 0 ? _b : ""), create("section", { class: "modal-card-body" }, opt.text), create("footer", { class: "modal-card-foot" }, (_c = opt.footer) !== null && _c !== void 0 ? _c : button_bar));
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

    function check(elem) {
        if (elem === undefined || elem === null) {
            throw new Error("Expected value to not be null");
        }
        return elem;
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
    function read_inline_date(date) {
        return moment.utc(date, "YYYY-MM-DD HH:mm:ss UTC");
    }

    function get_song_hash_from_text(text) {
        var _a;
        const res = Global.song_hash_reg.exec(text);
        return res ? (_a = res[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase() : undefined;
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
    function diff_name_to_value(name) {
        switch (name) {
            case "Easy": return 1;
            case "Medium": return 3;
            case "Hard": return 5;
            case "Expert": return 7;
            case "ExpertPlus": return 9;
            default: return -1;
        }
    }

    const api_cache = new SessionCache("saver");
    async function get_data_by_hash(song_hash) {
        const cached_data = api_cache.get(song_hash);
        if (cached_data !== undefined)
            return cached_data;
        try {
            const data_str = await fetch2(`https://api.beatsaver.com/maps/hash/${song_hash}`);
            const data = JSON.parse(data_str);
            api_cache.set(song_hash, data);
            return data;
        }
        catch (err) {
            logc("Failed to download song data", err);
            return undefined;
        }
    }
    async function get_scoresaber_data_by_hash(song_hash, diff_name) {
        try {
            const diff_value = diff_name === undefined ? 0 : diff_name_to_value(diff_name);
            const data_str = await fetch2(`https://beatsaver.com/api/scores/${song_hash}/0?difficulty=${diff_value}&gameMode=0`);
            const data = JSON.parse(data_str);
            return data;
        }
        catch (err) {
            logc("Failed to download song data", err);
            return undefined;
        }
    }

    const BMPage = ["song", "songlist", "user"];
    const BMButton = ["BS", "OC", "Beast", "BeastBook", "Preview", "BSR"];
    BMPage
        .map(p => BMButton.map(b => `${p}-${b}`))
        .reduce((agg, lis) => [...agg, ...lis], []);
    const BMButtonHelp = {
        BS: { short: "BS", long: "BeatSaver", tip: "View on BeatSaver" },
        OC: { short: "OC", long: "OneClick™", tip: "Download with OneClick™" },
        Beast: { short: "BST", long: "BeastSaber", tip: "View/Add rating on BeastSaber" },
        BeastBook: { short: "BB", long: "BeastSaber Bookmark", tip: "Bookmark on BeastSaber" },
        Preview: { short: "👓", long: "Preview", tip: "Preview map" },
        BSR: { short: "❗", long: "BeatSaver Request", tip: "Copy !bsr" },
    };
    function get_bsaber_bookmarks() {
        const data = localStorage.getItem("bsaber_bookmarks");
        if (!data)
            return [];
        return JSON.parse(data);
    }
    function check_bsaber_bookmark(song_hash) {
        const bookmarks = get_bsaber_bookmarks();
        return bookmarks.includes(song_hash.toLowerCase());
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

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function append_styles(target, style_sheet_id, styles) {
        const append_styles_to = get_root_for_style(target);
        if (!append_styles_to.getElementById(style_sheet_id)) {
            const style = element('style');
            style.id = style_sheet_id;
            style.textContent = styles;
            append_stylesheet(append_styles_to, style);
        }
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\components\QuickButton.svelte generated by Svelte v3.44.1 */

    function add_css(target) {
    	append_styles(target, "svelte-1so5nc2", "div.svelte-1so5nc2{padding:0;cursor:pointer}div.svelte-1so5nc2:disabled{cursor:default}.bsaber_bg.svelte-1so5nc2{background-image:url(\"https://bsaber.com/wp-content/themes/beastsaber-wp-theme/assets/img/avater-callback.png\");background-size:cover;background-repeat:no-repeat;background-position:center;width:100%;height:100%;border-radius:inherit}.dummy.svelte-1so5nc2{position:absolute;top:0px;left:-100000px}");
    }

    // (113:26) 
    function create_if_block_5(ctx) {
    	let i;
    	let t;
    	let input;

    	return {
    		c() {
    			i = element("i");
    			t = space();
    			input = element("input");
    			attr(i, "class", "fas fa-exclamation");
    			attr(input, "class", "dummy svelte-1so5nc2");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    			insert(target, t, anchor);
    			insert(target, input, anchor);
    			/*input_binding*/ ctx[12](input);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(i);
    			if (detaching) detach(t);
    			if (detaching) detach(input);
    			/*input_binding*/ ctx[12](null);
    		}
    	};
    }

    // (111:30) 
    function create_if_block_4(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-glasses");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (109:32) 
    function create_if_block_3(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-thumbtack");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (107:28) 
    function create_if_block_2(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", "bsaber_bg svelte-1so5nc2");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (105:25) 
    function create_if_block_1(ctx) {
    	let i;

    	return {
    		c() {
    			i = element("i");
    			attr(i, "class", "fas fa-cloud-download-alt");
    		},
    		m(target, anchor) {
    			insert(target, i, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(i);
    		}
    	};
    }

    // (103:1) {#if type === "BS"}
    function create_if_block(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", "beatsaver_bg svelte-1so5nc2");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let div_class_value;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*type*/ ctx[0] === "BS") return create_if_block;
    		if (/*type*/ ctx[0] === "OC") return create_if_block_1;
    		if (/*type*/ ctx[0] === "Beast") return create_if_block_2;
    		if (/*type*/ ctx[0] === "BeastBook") return create_if_block_3;
    		if (/*type*/ ctx[0] === "Preview") return create_if_block_4;
    		if (/*type*/ ctx[0] === "BSR") return create_if_block_5;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr(div, "class", div_class_value = "button icon is-" + /*size*/ ctx[1] + " " + /*type*/ ctx[0] + "_bg_btn " + /*color*/ ctx[5] + " svelte-1so5nc2");
    			attr(div, "style", /*display*/ ctx[7]);
    			attr(div, "disabled", /*disabled*/ ctx[8]);
    			attr(div, "data-tooltip", /*tooltip*/ ctx[6]);
    			toggle_class(div, "has-tooltip-left", /*size*/ ctx[1] !== "large" && !/*preview*/ ctx[2]);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			/*div_binding*/ ctx[13](div);

    			if (!mounted) {
    				dispose = listen(div, "click", /*onclick*/ ctx[9]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}

    			if (dirty & /*size, type, color*/ 35 && div_class_value !== (div_class_value = "button icon is-" + /*size*/ ctx[1] + " " + /*type*/ ctx[0] + "_bg_btn " + /*color*/ ctx[5] + " svelte-1so5nc2")) {
    				attr(div, "class", div_class_value);
    			}

    			if (dirty & /*display*/ 128) {
    				attr(div, "style", /*display*/ ctx[7]);
    			}

    			if (dirty & /*disabled*/ 256) {
    				attr(div, "disabled", /*disabled*/ ctx[8]);
    			}

    			if (dirty & /*tooltip*/ 64) {
    				attr(div, "data-tooltip", /*tooltip*/ ctx[6]);
    			}

    			if (dirty & /*size, type, color, size, preview*/ 39) {
    				toggle_class(div, "has-tooltip-left", /*size*/ ctx[1] !== "large" && !/*preview*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);

    			if (if_block) {
    				if_block.d();
    			}

    			/*div_binding*/ ctx[13](null);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let disabled;
    	let display;
    	let { song_hash = undefined } = $$props;
    	let { type } = $$props;
    	let { size } = $$props;
    	let { preview = false } = $$props;
    	let { page = undefined } = $$props;
    	let button;
    	let txtDummyNode;
    	let color;
    	let tooltip;

    	async function checked_hash_to_song_info(song_hash) {
    		reset_download_visual();

    		if (song_hash === undefined) {
    			failed_to_download();
    			throw new Error("song_hash is undefined");
    		}

    		const song_info = await get_data_by_hash(song_hash);

    		if (song_info === undefined) {
    			failed_to_download();
    			throw new Error("song_info is undefined");
    		}

    		return song_info;
    	}

    	function reset_download_visual() {
    		button.classList.remove("button_success");
    		button.classList.remove("button_error");
    	}

    	function failed_to_download() {
    		button.classList.add("button_error");
    	}

    	function ok_after_download() {
    		button.classList.add("button_success");
    	}

    	async function onclick() {
    		if (preview) return;

    		try {
    			const song_info = await checked_hash_to_song_info(song_hash);

    			if (type === "BS") {
    				new_page(Global.beatsaver_link + song_info.id);
    			} else if (type === "OC") {
    				await oneclick_install(song_info.id);
    				ok_after_download();
    			} else if (type === "Beast") {
    				new_page(Global.bsaber_songs_link + song_info.id);
    			} else if (type === "BeastBook") {
    				new_page(Global.bsaber_songs_link + song_info.id);
    			} else if (type === "Preview") {
    				new_page("https://skystudioapps.com/bs-viewer/?id=" + song_info.id);
    			} else if (type === "BSR") {
    				$$invalidate(4, txtDummyNode.value = `!bsr ${song_info.id}`, txtDummyNode);
    				txtDummyNode.select();
    				txtDummyNode.setSelectionRange(0, 99999);
    				document.execCommand("copy");
    				ok_after_download();
    			}
    		} catch(err) {
    			console.log("Failed QuickAction", song_hash, err);
    			failed_to_download();
    		}
    	}

    	function input_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			txtDummyNode = $$value;
    			$$invalidate(4, txtDummyNode);
    		});
    	}

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			button = $$value;
    			$$invalidate(3, button);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('song_hash' in $$props) $$invalidate(10, song_hash = $$props.song_hash);
    		if ('type' in $$props) $$invalidate(0, type = $$props.type);
    		if ('size' in $$props) $$invalidate(1, size = $$props.size);
    		if ('preview' in $$props) $$invalidate(2, preview = $$props.preview);
    		if ('page' in $$props) $$invalidate(11, page = $$props.page);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*preview, song_hash*/ 1028) {
    			$$invalidate(8, disabled = !preview && song_hash === undefined
    			? "disabled"
    			: undefined);
    		}

    		if ($$self.$$.dirty & /*preview, page, type*/ 2053) {
    			$$invalidate(7, display = !preview && page !== undefined
    			? `display: var(--sse-show-${page}-${type}, inline-flex);`
    			: "");
    		}

    		if ($$self.$$.dirty & /*type, preview, song_hash*/ 1029) {
    			{
    				$$invalidate(5, color = "");
    				$$invalidate(6, tooltip = BMButtonHelp[type].tip);

    				if (type === "BeastBook" && !preview) {
    					const bookmarked = song_hash === undefined
    					? false
    					: check_bsaber_bookmark(song_hash);

    					$$invalidate(5, color = bookmarked ? "is-success" : "is-danger");

    					$$invalidate(6, tooltip = bookmarked
    					? "Bookmarked on BeastSaber"
    					: "Not Bookmarked on BeastSaber");
    				}
    			}
    		}
    	};

    	return [
    		type,
    		size,
    		preview,
    		button,
    		txtDummyNode,
    		color,
    		tooltip,
    		display,
    		disabled,
    		onclick,
    		song_hash,
    		page,
    		input_binding,
    		div_binding
    	];
    }

    class QuickButton extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(
    			this,
    			options,
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				song_hash: 10,
    				type: 0,
    				size: 1,
    				preview: 2,
    				page: 11
    			},
    			add_css
    		);
    	}
    }

    var PageType;
    (function (PageType) {
        PageType[PageType["Unknown"] = 0] = "Unknown";
        PageType[PageType["Leaderboard"] = 1] = "Leaderboard";
        PageType[PageType["User"] = 2] = "User";
    })(PageType || (PageType = {}));

    const PAGE = "song";
    const shared = new Lazy(() => {
        var _a;
        let details_box = check(document.querySelector(".content .title.is-5"));
        details_box = check(details_box.parentElement);
        const song_hash = get_song_hash_from_text(details_box.innerHTML);
        const diff_name = (_a = document.querySelector(`div.tabs li.is-active span`)) === null || _a === void 0 ? void 0 : _a.innerText;
        return { song_hash, details_box, diff_name };
    });
    class DlLinkLeaderboard {
        constructor() {
            this.page = PageType.Leaderboard;
        }
        try_apply(mut) {
            var _a;
            const node = document.querySelector(".page-container .window.card-content div.content");
            const mapHashElem = node === null || node === void 0 ? void 0 : node.querySelector("strong.text-muted");
            const mapHash = (_a = mapHashElem === null || mapHashElem === void 0 ? void 0 : mapHashElem.textContent) === null || _a === void 0 ? void 0 : _a.trim();
            console.log("HOOK: DlLinkLeaderboard", node, mapHashElem, mapHash);
            if (mapHash !== undefined && node != null) {
                setup_dl_link_leaderboard(mapHash, node);
                return true;
            }
            return false;
        }
        cleanup() {
            var _a;
            (_a = document.getElementById(tool_strip_id)) === null || _a === void 0 ? void 0 : _a.remove();
        }
    }
    const dl_link_leaderboard = new DlLinkLeaderboard();
    const tool_strip_id = "leaderboard_tool_strip";
    function setup_dl_link_leaderboard(song_hash, details_box) {
        let tool_strip = document.getElementById(tool_strip_id);
        if (tool_strip)
            return;
        tool_strip = create("div", {
            id: tool_strip_id,
            style: {
                marginTop: "1em"
            }
        });
        for (const btn of BMButton) {
            new QuickButton({
                target: tool_strip,
                props: { song_hash, size: "large", type: btn, page: PAGE }
            });
        }
        details_box.appendChild(tool_strip);
        const song_warning = create("div");
        details_box.appendChild(song_warning);
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
            show_song_warning(song_warning, song_hash, data);
            show_beatsaver_song_data(beatsaver_box, data);
            const data2 = await get_data(data.id);
            if (!data2)
                return;
            show_beastsaber_song_data(beastsaber_box, data2);
        })();
    }
    function show_song_warning(elem, song_hash, data) {
        const contains_version = data.versions.some(x => x.hash === song_hash);
        if (!contains_version) {
            const new_song_hash = data.versions[data.versions.length - 1].hash;
            const { diff_name } = shared.get();
            intor(elem, create("div", {
                style: { marginTop: "1em", cursor: "pointer" },
                class: "notification is-warning",
                onclick: async () => {
                    const bs2ss = await get_scoresaber_data_by_hash(new_song_hash, diff_name);
                    if (bs2ss === undefined)
                        return;
                    new_page(`https://scoresaber.com/leaderboard/${bs2ss.uid}`);
                },
            }, create("i", { class: "fas fa-exclamation-triangle" }), create("span", { style: { marginLeft: "0.25em" } }, "A newer version of this song exists on BeatSaver")));
        }
    }
    function show_beatsaver_song_data(elem, data) {
        intor(elem, create("div", { title: "Downloads" }, `${data.stats.downloads} 💾`), create("div", { title: "Upvotes" }, `${data.stats.upvotes} 👍`), create("div", { title: "Downvotes" }, `${data.stats.downvotes} 👎`), create("div", { title: "Beatmap Rating" }, `${(data.stats.score * 100).toFixed(2)}% 💯`), create("div", { title: "Beatmap Duration" }, `${number_to_timespan(data.metadata.duration)} ⏱`));
    }
    function show_beastsaber_song_data(elem, data) {
        intor(elem, create("div", { title: "Fun Factor" }, `${data.average_ratings.fun_factor} 😃`), create("div", { title: "Rhythm" }, `${data.average_ratings.rhythm} 🎶`), create("div", { title: "Flow" }, `${data.average_ratings.flow} 🌊`), create("div", { title: "Pattern Quality" }, `${data.average_ratings.pattern_quality} 💠`), create("div", { title: "Readability" }, `${data.average_ratings.readability} 👓`), create("div", { title: "Level Quality" }, `${data.average_ratings.level_quality} ✔️`));
    }

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

    setup$1();
    setup();
    load();
    const hooks = [];
    hooks.push(dl_link_leaderboard);
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
    let last_page = undefined;
    function apply_sse_dispached(mutations) {
        const url = window.location.href;
        let changed = false;
        if (url !== last_page) {
            changed = true;
            hooks.forEach((hook) => {
                var _a;
                (_a = hook.cleanup) === null || _a === void 0 ? void 0 : _a.call(hook);
                hook.__loaded = false;
            });
            last_page = url;
        }
        let page = PageType.Unknown;
        if (url.includes("/leaderboard/")) {
            page = PageType.Leaderboard;
        }
        else if (url.includes("/u/")) {
            page = PageType.User;
        }
        logc("Page: ", changed ? "new" : "old", " ", PageType[page]);
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

})();
//# sourceMappingURL=rollup.js.map
