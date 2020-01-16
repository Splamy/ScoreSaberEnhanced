export function check<T>(elem: T | undefined | null): T {
	if (elem === undefined || elem === null) {
		throw new Error("Expected value to not be null");
	}
	return elem;
}
