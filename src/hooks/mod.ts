
export enum PageType {
	Unknown,
	// https://scoresaber.com/leaderboard
	Leaderboard,
	//	https://scoresaber.com/u/
	User,
}

export interface IHook {
	readonly page: PageType;
	__loaded?: boolean;
	try_apply(mut: MutationRecord[]): boolean;
	cleanup?(): void;
}
