export interface ISong {
	time: string;
	pp: number;
	accuracy?: number;
	score?: number;
	mods?: string[];
}

export interface IUser {
	id: string;
	name: string;
}

export interface IDbUser {
	name: string;
	songs: { [song_id: string]: ISong };
}

export type BulmaSize = "small" | "medium" | "large";

export interface IBeatSaverSongInfo {
	key: string;
	name: string;
	hash: string;
	downloadURL: string;
	// ...
}