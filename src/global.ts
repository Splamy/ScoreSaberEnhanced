import { IDbUser, IUser } from "./declarations/Types";

export default class Global {
	public static user_list: { [user_id: string]: IDbUser };
	public static status_elem: HTMLElement;
	public static users_elem: HTMLElement;
	public static last_selected: string;
	public static debug = false;
	public static _current_user: IUser;
	public static _home_user: IUser;
	public static style_themed_elem: HTMLStyleElement;
	public static song_table_backup: HTMLElement | undefined;

	public static readonly scoresaber_link = "https://scoresaber.com";
	public static readonly beatsaver_link = "https://beatsaver.com/beatmap/";
	public static readonly beatsaver_hash_api = "https://beatsaver.com/api/maps/by-hash/";
	public static readonly bsaber_link = "https://bsaber.com/songs/";
	public static readonly song_hash_reg = /\/([\da-zA-Z]{40})\.png/;
	public static readonly score_reg = /(score|accuracy):\s*([\d\.,]+)%?\s*(\(([\w,]*)\))?/;
	public static readonly leaderboard_reg = /leaderboard\/(\d+)/;
	public static readonly leaderboard_rank_reg = /#([\d,]+)/;
	public static readonly user_reg = /u\/(\d+)/;
	public static readonly script_version_reg = /\/\/\s*@version\s+([\d\.]+)/;
	public static readonly user_per_page_global_leaderboard = 50;
	public static readonly user_per_page_song_leaderboard = 12;
}