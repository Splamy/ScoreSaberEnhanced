import { logc } from "../util/log";
import { fetch2 } from "../util/net";
import { SessionCache } from "../util/sessioncache";
import { diff_name_to_value } from "../util/song";

const api_cache = new SessionCache<IBeatSaverData>("saver");

export async function get_data_by_hash(song_hash: string): Promise<IBeatSaverData | undefined> {
	const cached_data = api_cache.get(song_hash);
	if (cached_data !== undefined)
		return cached_data;
	try {
		const data_str = await fetch2(`https://api.beatsaver.com/maps/hash/${song_hash}`);
		const data = JSON.parse(data_str);
		api_cache.set(song_hash, data);
		return data;
	} catch (err) {
		logc("Failed to download song data", err)
		return undefined;
	}
}

export async function get_scoresaber_data_by_hash(song_hash: string, diff_name?: string): Promise<IBeatSaverScoreSaber | undefined> {
	try {
		const diff_value = diff_name === undefined ? 0 : diff_name_to_value(diff_name);
		const data_str = await fetch2(`https://beatsaver.com/api/scores/${song_hash}/0?difficulty=${diff_value}&gameMode=0`);
		const data = JSON.parse(data_str);
		return data;
	} catch (err) {
		logc("Failed to download song data", err)
		return undefined;
	}
}


export interface IBeatSaverData {
	id: string;
	name: string;
	stats: {
		plays: number;
		downloads: number;
		upvotes: number;
		downvotes: number;
		score: number;
	};
	versions: IBeatSaverSongVersion[];
	metadata: {
		duration: number;
	};
}

export interface IBeatSaverSongVersion {
	hash: string;
	diffs: {
		characteristic: string;
		difficulty: string;
		notes: number;
	}[];
	downloadURL: string;
}

export interface IBeatSaverScoreSaber {
	ranked: boolean;
	uid: string;
	scores: {
		playerId: string;
		name: string;
		rank: number;
		score: number;
		pp: number;
		mods: string[];
	}[];
	mods: boolean;
	valid: boolean;
}
