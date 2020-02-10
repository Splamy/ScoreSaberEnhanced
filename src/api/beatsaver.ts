import { fetch2 } from "../util/net";

export async function get_data(song_hash: string): Promise<IBeatSaverData> {
	const data_str = await fetch2(`https://beatsaver.com/api/maps/by-hash/${song_hash}`);
	const data = JSON.parse(data_str);
	return data;
}

interface IBeatSaverData {
	key: string;
	name: string;
	hash: string;
	stats: {
		downloads: number;
		plays: number;
		downVotes: number;
		upVotes: number;
		heat: number;
		rating: number;
	};
}
