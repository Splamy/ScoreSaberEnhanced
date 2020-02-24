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

export type BulmaColor = "primary" | "link" | "info" | "success" | "warning" | "danger";

export type BulmaColorClass = "is-primary" | "is-link" | "is-info" | "is-success" | "is-warning" | "is-danger";
