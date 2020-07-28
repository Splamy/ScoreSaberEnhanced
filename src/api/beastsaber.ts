import { fetch2 } from "../util/net";
import { SessionCache } from "../util/sessioncache";

const api_cache = new SessionCache<IBeastSaberData>("beast");

export async function get_data(song_key: string): Promise<IBeastSaberData | undefined> {
	const cached_data = api_cache.get(song_key);
	if (cached_data !== undefined)
		return cached_data;
	try {
		const data_str = await fetch2(`https://bsaber.com/wp-json/bsaber-api/songs/${song_key}/ratings`);
		const data = JSON.parse(data_str);
		api_cache.set(song_key, data);
		return data;
	} catch (e) { return undefined; }
}

export async function get_bookmarks(username: string, page: number, count: number): Promise<IBeastSaberBookmarks | undefined> {
	try {
		const data_str = await fetch2(`https://bsaber.com/wp-json/bsaber-api/songs/?bookmarked_by=${username}&page=${page}&count=${count}`);
		const data = JSON.parse(data_str);
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

export interface IBeastSaberSongInfo {
	title: string;
	song_key: string;
	hash: string;
	level_author: string;
}

export interface IBeastSaberBookmarks {
	songs: IBeastSaberSongInfo[];
	next_page: number;
}
