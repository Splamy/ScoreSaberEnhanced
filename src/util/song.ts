import * as beatsaver from "../api/beatsaver";
import * as modal from "../components/modal";
import { ISong } from "../declarations/Types";
import g from "../global";

export function get_song_compare_value(song_a: ISong, song_b: ISong): [number, number] {
	if (song_a.pp > 0 || song_b.pp > 0) {
		return [song_a.pp, song_b.pp];
	} else if (song_a.score !== undefined && song_b.score !== undefined) {
		return [song_a.score, song_b.score];
	} else if (song_a.accuracy !== undefined && song_b.accuracy !== undefined) {
		return [song_a.accuracy * get_song_mod_multiplier(song_a), song_b.accuracy * get_song_mod_multiplier(song_b)];
	} else {
		return [-1, -1];
	}
}

function get_song_mod_multiplier(song: ISong): number {
	if (!song.mods)
		return 1.0;

	// Note: ranked maps may use different values for modifiers like GN, DA, FS
	// this function returns a modifier which should only be used for accuracy.
	let multiplier = 1.0;
	for (const mod of song.mods) {
		switch (mod) {
			case "NF": multiplier -= 0.50; break;
			case "NO": multiplier -= 0.05; break;
			case "NB": multiplier -= 0.10; break;
			case "SS": multiplier -= 0.30; break;
			case "NA": multiplier -= 0.30; break;

			case "DA": multiplier += 0.07; break;
			case "GN": multiplier += 0.11; break;
			case "FS": multiplier += 0.08; break;
		}
	}
	return Math.max(0, multiplier);
}

export function get_song_hash_from_text(text: string): string | undefined {
	const res = g.song_hash_reg.exec(text);
	return res ? res[1] : undefined;
}

export async function fetch_hash(link: string): Promise<string | undefined> {
	// we can't get the beatsaver song link directly so we fetch
	// the song hash from the leaderboard site with an async fetch request.
	const leaderboard_text = await (await fetch(link)).text();
	return get_song_hash_from_text(leaderboard_text);
}

export async function oneclick_install_byhash(song_hash: string): Promise<boolean> {
	const song_info = await beatsaver.get_data_by_hash(song_hash);
	if (!song_info) return false;
	await oneclick_install(song_info.key);
	return true;
}

export async function oneclick_install(song_key: string): Promise<void> {
	const lastCheck = localStorage.getItem("oneclick-prompt");
	const prompt = !lastCheck ||
		new Date(lastCheck).getTime() + (1000 * 60 * 60 * 24 * 31) < new Date().getTime();

	if (prompt) {
		localStorage.setItem("oneclick-prompt", new Date().getTime().toString());

		const resp = await modal.show_modal({
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

export function song_equals(a?: ISong, b?: ISong): boolean {
	if (a === b) // Catches 'reference equal', and 'a = b = undefined'
		return true;
	if (a === undefined || b === undefined)
		return false;
	return (
		a.accuracy === b.accuracy &&
		a.pp === b.pp &&
		a.score === b.score &&
		a.time === b.time &&
		array_equals(a.mods, b.mods));
}

function array_equals<T>(a: T[] | undefined, b: T[] | undefined): boolean {
	if (a === b) // Catches 'reference equal', and 'a = b = undefined'
		return true;
	if (a === undefined || b === undefined)
		return false;
	if (a.length !== b.length)
		return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

export function parse_mods(mods: string): string[] | undefined {
	if (!mods) return undefined;
	const modarr = mods.split(/,/g);
	if (modarr.length === 0) return undefined;
	return modarr;
}

export function get_notes_count(diff_name: string, characteristic: beatsaver.IBeatSaverSongCharacteristic): number {
	switch (diff_name) {
		case "Easy":
			return characteristic.difficulties.easy.notes;
		case "Normal":
			return characteristic.difficulties.normal.notes;
		case "Hard":
			return characteristic.difficulties.hard.notes;
		case"Expert":
			return characteristic.difficulties.expert.notes;
		case"Expert+":
			return characteristic.difficulties.expertPlus.notes;
	}
	return -1;
}

export function calculate_max_score(notes: number): number {
	const note_score = 115;
	let max_score = 0;
	let counter = 1;
	// first note, multiplier x1, check if notes still present
	while (notes > 0 && counter > 0) {
		notes--;
		counter--;
		max_score += note_score;
	}
	// four notes, multiplier x2
	counter = 4;
	while (notes > 0 && counter > 0) {
		notes--;
		counter--;
		max_score += note_score * 2;
	}
	// eight notes, multiplier x4
	counter = 8;
	while (notes > 0 && counter > 0) {
		notes--;
		counter--;
		max_score += note_score * 4;
	}
	// all other notes with multiplier x8
	max_score += notes * note_score * 8;

	return max_score;
}
