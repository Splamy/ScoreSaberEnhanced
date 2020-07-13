import { ISong } from "../declarations/Types";
import { get_document_user, get_use_new_ss_api } from "../env";
import g from "../global";
import { check } from "../util/err";
import { number_invariant, read_inline_date, round2 } from "../util/format";
import { logc } from "../util/log";
import { sleep, Limiter } from "../util/limiter";

const SCORESABER_LINK = "https://new.scoresaber.com/api";
const API_LIMITER = new Limiter();

export async function get_user_recent_songs_dynamic(user_id: string, page: number): Promise<IUserPageData> {
	logc(`Fetching user ${user_id} page ${page}`);
	if (get_use_new_ss_api()) {
		return get_user_recent_songs_new_api_wrap(user_id, page);
	} else {
		return get_user_recent_songs_old_api_wrap(user_id, page);
	}
}

// NEW API ====================================================================

async function get_user_recent_songs_new_api_wrap(user_id: string, page: number): Promise<IUserPageData> {
	const recent_songs = await get_user_recent_songs(user_id, page);

	return {
		meta: {
			was_last_page: recent_songs.scores.length < 8
		},
		songs: recent_songs.scores.map(s => [String(s.leaderboardId), {
			time: s.timeSet,
			pp: s.pp,
			accuracy: s.maxScore !== 0 ? round2((s.unmodififiedScore / s.maxScore) * 100) : undefined,
			score: s.score !== 0 ? s.score : undefined,
			mods: s.mods ? s.mods.split(/,/g) : undefined
		}])
	};
}

export async function get_user_recent_songs(user_id: string, page: number): Promise<IScoresaberSongList> {
	const req = await auto_fetch_retry(`${SCORESABER_LINK}/player/${user_id}/scores/recent/${page}`);
	const data = await req.json() as IScoresaberSongList;
	return sanitize_song_ids(data);
}

export async function get_user_top_songs(user_id: string, page: number): Promise<IScoresaberSongList> {
	const req = await auto_fetch_retry(`${SCORESABER_LINK}/player/${user_id}/scores/top/${page}`);
	const data = await req.json() as IScoresaberSongList;
	return sanitize_song_ids(data);
}

export async function get_user_info_basic(user_id: string): Promise<IScoresaberUserBasic> {
	const req = await auto_fetch_retry(`${SCORESABER_LINK}/player/${user_id}/full`);
	const data = await req.json() as IScoresaberUserBasic;
	return sanitize_player_ids(data);
}

export async function get_user_info_full(user_id: string): Promise<IScoresaberUserFull> {
	const req = await auto_fetch_retry(`${SCORESABER_LINK}/player/${user_id}/full`);
	const data = await req.json() as IScoresaberUserFull;
	return sanitize_player_ids(data);
}

async function auto_fetch_retry(url: string) {
	// 'MAX_RETRIES * SLEEP_WAIT' should be grater than the max time we are blocked
	// when hitting the rate limit. Rate limit timeout is currently 60sec
	const MAX_RETRIES = 20;
	const SLEEP_WAIT = 5000;

	for (let retries = MAX_RETRIES; retries >= 0; retries--) {
		await API_LIMITER.wait();
		const response = await fetch(url);
		const remaining = Number(response.headers.get("x-ratelimit-remaining"));
		const reset = Number(response.headers.get("x-ratelimit-reset"));
		const limit = Number(response.headers.get("x-ratelimit-limit"));
		API_LIMITER.setLimitData(remaining, reset, limit);
		if (response.status === 429) { // Too Many Requests
			await sleep(SLEEP_WAIT);
		} else {
			return response;
		}
	}
	throw new Error("Can't fetch data from new.scoresaber.");
}

function sanitize_player_ids<T extends IScoresaberUserBasic | IScoresaberUserFull>(data: T): T {
	data.playerInfo.playerId = String(data.playerInfo.playerId);
	return data;
}

function sanitize_song_ids<T extends IScoresaberSongList>(data: T): T {
	for (const s of data.scores) {
		s.scoreId = String(s.scoreId);
		s.leaderboardId = String(s.leaderboardId);
		s.playerId = String(s.playerId);
	}
	return data;
}

// OLD API ====================================================================

async function get_user_recent_songs_old_api_wrap(user_id: string, page: number): Promise<IUserPageData> {
	let doc: Document | undefined;
	let tries = 5;
	while ((!doc || doc.body.textContent === '"Rate Limit Exceeded"') && tries > 0) {
		await sleep(500);
		doc = await fetch_user_page(user_id, page);
		tries--;
	}

	if (doc === undefined) {
		throw Error("Error fetching user page");
	}

	// Get meta stuff
	const last_page_elem = doc.querySelector("nav ul.pagination-list li:last-child a")!;
	const max_pages = Number(last_page_elem.innerText) + 1;
	const data: IUserPageData = {
		meta: {
			max_pages,
			user_name: get_document_user(doc).name,
			was_last_page: page === max_pages,
		},
		songs: [],
	};

	// Extract data into format
	const table_row = doc.querySelectorAll("table.ranking.songs tbody tr");
	for (const row of table_row) {
		const song_data = get_row_data(row);
		data.songs.push(song_data);
	}

	return data;
}

async function fetch_user_page(user_id: string, page: number): Promise<Document> {
	const link = g.scoresaber_link + `/u/${user_id}&page=${page}&sort=2`;
	if (window.location.href.toLowerCase() === link) {
		logc("Efficient get :P");
		return document;
	}

	const init_fetch = await (await fetch(link)).text();
	const parser = new DOMParser();
	return parser.parseFromString(init_fetch, "text/html");
}

export function get_row_data(row: Element): ISongTuple {
	const rowc = row as Element & { cache?: ISongTuple; };
	if (rowc.cache) {
		return rowc.cache;
	}

	const leaderboard_elem = check(row.querySelector<HTMLAnchorElement>("th.song a"));
	const pp_elem = check(row.querySelector("th.score .ppValue"));
	const score_elem = check(row.querySelector("th.score .scoreBottom"));
	const time_elem = check(row.querySelector("th.song .time"));

	const song_id = g.leaderboard_reg.exec(leaderboard_elem.href)![1];
	const pp = Number(pp_elem.innerText);
	const time = read_inline_date(time_elem.title).toISOString();
	let score = undefined;
	let accuracy = undefined;
	let mods = undefined;
	const score_res = check(g.score_reg.exec(score_elem.innerText));
	logc(score_res);
	if (score_res[1] === "score") {
		score = number_invariant(score_res[2]);
	} else if (score_res[1] === "accuracy") {
		accuracy = Number(score_res[2]);
	}
	if (score_res[4]) {
		mods = score_res[4].split(/,/g);
	}

	const song = {
		pp,
		time,
		score,
		accuracy,
		mods,
	};
	const data: [string, ISong] = [song_id, song];
	rowc.cache = data;
	return data;
}

export type ISongTuple = [string, ISong];

// ============================================================================

interface IUserPageData {
	meta: {
		max_pages?: number;
		user_name?: string;
		was_last_page: boolean;
	};
	songs: ISongTuple[];
}

interface IScoresaberSong {
	scoreId: string; // SANITIZED
	leaderboardId: string; // SANITIZED
	/** Final score (After applying all song modifier factors) */
	score: number;
	/**
	 * unmodified score (Raw score before applying song modifier factors)
	 * TODO: Will probably break again due to typo?
	 */
	unmodififiedScore: number;
	mods: string; // comma separated number list
	playerId: string; // SANITIZED
	/** Time of score set. Format in ISO-8601 */
	timeSet: string;
	pp: number;
	/** Score weighting factor (Depends on the position in the top songs list of the user) */
	weight: number; // factor
	/** Song hash */
	songHash: string;
	songName: string;
	songSubName: string;
	songAuthorName: string;
	levelAuthorName: string;
	difficulty: number;
	difficultyRaw: string
	/** Max possible score (Without modifiers) */
	maxScore: number;
	rank: number;
}

export interface IScoresaberSongList {
	scores: IScoresaberSong[];
}

export interface IScoresaberUserBasic {
	playerInfo: IScoresaberPlayerInfoBasic;
}

export interface IScoresaberUserFull {
	playerInfo: Modify<IScoresaberPlayerInfoBasic, IScoresaberPlayerInfoFull>;
	scoreStats: IScoresaberScoreStats;
}

interface IScoresaberPlayerInfoBasic {
	playerId: string; // SANITIZE
	pp: number;
	banned: number; // boolean?
	inactive: number; // boolean?
	playerName: string;
	country: string;
	role: string;
	badges: string; // comma separated number list
	history: string; // comma separated number list
	rank: number;
	countryRank: number;
}

interface IScoresaberPlayerInfoFull {
	badges: {
		image: string;
		description: string;
	}[];
}

interface IScoresaberScoreStats {
	totalScore: number;
	totalRankedScore: number;
	averageRankedAccuracy: number;
	totalPlayCount: number;
	rankedPlayCount: number;
}
