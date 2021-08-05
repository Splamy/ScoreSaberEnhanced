import { logc } from "../util/log";
import { fetch2 } from "../util/net";
import { SessionCache } from "../util/sessioncache";

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
