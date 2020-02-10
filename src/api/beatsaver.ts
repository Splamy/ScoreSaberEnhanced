import { fetch2 } from "../util/net";

const api_cache: { [song_hash: string]: IBeatSaverData } = {};

export async function get_data_by_hash(song_hash: string): Promise<IBeatSaverData | undefined> {
	const cached_data = api_cache[song_hash];
	if (cached_data)
		return cached_data;
	try {
		const data_str = await fetch2(`https://beatsaver.com/api/maps/by-hash/${song_hash}`);
		const data = JSON.parse(data_str);
		api_cache[song_hash] = data;
		return data;
	} catch (e) { return undefined; }
}

export interface IBeatSaverData {
	key: string;
	name: string;
	hash: string;
	downloadURL: string;
	stats: {
		downloads: number;
		plays: number;
		downVotes: number;
		upVotes: number;
		heat: number;
		rating: number;
	};
}
