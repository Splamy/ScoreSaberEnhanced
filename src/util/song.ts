import { IBeatSaverSongInfo, ISong } from "../declarations/Types";
import g from "../global";
import { fetch2 } from "./net";

export function get_song_compare_value(song_a: ISong, song_b: ISong): [number, number] {
	if (song_a.pp > 0 && song_b.pp) {
		return [song_a.pp, song_b.pp];
	} else if (song_a.score !== undefined && song_b.score !== undefined && song_a.score > 0) {
		return [song_a.score, song_b.score];
	} else if (song_a.accuracy !== undefined && song_b.accuracy !== undefined && song_a.accuracy > 0) {
		return [song_a.accuracy * get_song_mod_multiplier(song_a), song_b.accuracy * get_song_mod_multiplier(song_b)];
	} else {
		return [0, 0];
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

export async function fetch_song_info_by_hash(hash: string): Promise<IBeatSaverSongInfo | undefined> {
	try {
		const fetch_data = await fetch2(g.beatsaver_hash_api + hash);
		const data = JSON.parse(fetch_data);
		return data;
	} catch (e) { return undefined; }
}

export async function fetch_hash(link: string): Promise<string | undefined> {
	// we cant get the beatsaver song link directly so we fetch
	// the song hash from the leaderboard site with an async fetch request.
	const leaderboard_text = await (await fetch(link)).text();
	return get_song_hash_from_text(leaderboard_text);
}

export async function oneclick_install_byhash(song_hash: string): Promise<boolean> {
	const song_info = await fetch_song_info_by_hash(song_hash);
	if (!song_info) return false;
	await oneclick_install(song_info.key);
	return true;
}

export async function oneclick_install(song_key: string): Promise<void> {
	const lastCheck = localStorage.getItem("oneclick-prompt");
	// tslint:disable-next-line: triple-equals
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

		if (resp === "install") window.open("https://github.com/beat-saber-modding-group/BeatSaberModInstaller/releases");
	}

	console.log("Downloading: ", song_key);
	window.location.assign(`beatsaver://${song_key}`);
}
