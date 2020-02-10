import { fetch2 } from "../util/net";

const api_cache: { [song_hash: string]: IBeastSaberData } = {};

export async function get_data(song_key: string): Promise<IBeastSaberData | undefined> {
	const cached_data = api_cache[song_key];
	if (cached_data)
		return cached_data;
	try {
		const data_str = await fetch2(`https://bsaber.com/wp-json/bsaber-api/songs/${song_key}/ratings`);
		const data = JSON.parse(data_str);
		api_cache[song_key] = data;
		return data;
	} catch (e) { return undefined; }
}

export interface IBeastSaberData {
	overall_rating: number;

	average_ratings: {
		fun_factor: number;
		rhythm: number;
		flow: number;
		pattern_quality: number;
		readability: number;
		level_quality: number;
	};
}
