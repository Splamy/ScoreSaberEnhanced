export class Lazy<T> {
	private value: T | undefined;

	constructor(
		private generator: () => T
	) { }

	public get(): T {
		if (this.value === undefined) {
			this.value = this.generator();
		}
		return this.value!;
	}
	public reset() {
		this.value = undefined;
	}
}
