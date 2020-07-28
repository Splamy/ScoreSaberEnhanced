export class SessionCache<T> {
	constructor(
		private prefix: string
	) {
		if (prefix === undefined)
			throw Error("Prefix must be set. If you don't want a prefix, explicitely pass ''.");
	}

	public get(key: string): T | undefined {
		const item = sessionStorage.getItem(this.prefix + key);
		if (item === null)
			return undefined;
		return JSON.parse(item);
	}

	public set(key: string, value: T): void {
		sessionStorage.setItem(this.prefix + key, JSON.stringify(value));
	}
}
