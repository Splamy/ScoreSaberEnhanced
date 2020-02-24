interface ParentNode {
	querySelector<E extends HTMLElement = HTMLElement>(selectors: string): E | null;
	querySelectorAll<E extends HTMLElement = HTMLElement>(selectors: string): NodeListOf<E>;
}

type Modify<T, R> = Omit<T, keyof R> & R;
