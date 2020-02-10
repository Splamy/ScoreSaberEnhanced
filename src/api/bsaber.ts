import { fetch2 } from "../util/net";

export async function get_data(song_key: string): Promise<IBsaberData> {
	const data_str = await fetch2(`https://bsaber.com/wp-json/bsaber-api/songs/${song_key}/ratings`);
	const data = JSON.parse(data_str);
	return data;
}

interface IBsaberData {
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
