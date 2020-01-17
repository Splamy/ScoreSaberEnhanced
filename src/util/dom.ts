type ElementBuilder<T extends keyof HTMLElementTagNameMap> = Omit<HTMLElementTagNameMap[T], "style">;
type AutoBuild<T extends keyof HTMLElementTagNameMap> = Partial<ElementBuilder<T> & {
	style: Partial<CSSStyleDeclaration>,
	id: string,
	class: string | string[],
	for: string,
	disabled: boolean,
	data: { [att: string]: string }
}>;

export function create<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs?: AutoBuild<K>,
	...children: (HTMLElement | string)[]): HTMLElementTagNameMap[K] {
	if (!tag) throw new SyntaxError("'tag' not defined");

	const ele = document.createElement(tag);
	if (attrs) {
		for (const attrName in attrs) {
			if (attrName === "style") {
				for (const styleName in attrs.style) { ele.style[styleName as any] = attrs.style[styleName as any]!; }
			} else if (attrName === "class") {
				if (typeof attrs.class === "string") {
					const classes = attrs.class.split(/ /g).filter(c => c.trim().length > 0);
					ele.classList.add(...classes);
				} else {
					ele.classList.add(...attrs.class!);
				}
			} else if (attrName === "for") {
				// @ts-ignore
				ele.htmlFor = attrs[attrName];
			} else if (attrName === "selected") {
				// @ts-ignore
				ele.selected = attrs[attrName] ? "selected" : undefined;
			} else if (attrName === "disabled") {
				// @ts-ignore
				if (attrs[attrName]) ele.setAttribute("disabled", undefined);
			} else if (attrName === "data") {
				// @ts-ignore
				const data_dict: { [att: string]: string } = attrs[attrName];
				for (const data_key in data_dict) {
					ele.setAttribute(`data-${data_key}`, data_dict[data_key]);
				}
			} else {
				// @ts-ignore
				ele[attrName] = attrs[attrName];
			}
		}
	}

	into(ele, ...children);
	return ele;
}

/**
 * Removes all child elements
 */
export function clear_children(elem: HTMLElement): void {
	while (elem.lastChild) {
		elem.removeChild(elem.lastChild);
	}
}

/**
 * Into, but replaces the content
 */
export function intor(parent: HTMLElement, ...children: (HTMLElement | string)[]): void {
	clear_children(parent);
	return into(parent, ...children);
}

/**
 * Appends the children to the parent
 */
export function into(parent: HTMLElement, ...children: (HTMLElement | string)[]): void {
	for (const child of children) {
		if (typeof child === "string") {
			if (children.length > 1) {
				parent.appendChild(create("div", {}, child));
			} else {
				parent.innerText = child;
			}
		} else {
			parent.appendChild(child);
		}
	}
}
