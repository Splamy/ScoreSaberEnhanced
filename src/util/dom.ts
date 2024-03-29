type ElementBuilder<T extends keyof HTMLElementTagNameMap> = Omit<HTMLElementTagNameMap[T], "style">;
type AutoBuild<T extends keyof HTMLElementTagNameMap> = Partial<ElementBuilder<T> & {
	style: Partial<CSSStyleDeclaration>,
	id: string,
	class: string | string[],
	for: string,
	disabled: boolean,
	data: { [att: string]: string }
}>;
export type IntoElem = Node | string | Promise<Node | string>;

export function create<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs?: AutoBuild<K>,
	...children: IntoElem[]): HTMLElementTagNameMap[K] {
	if (tag === undefined) throw new Error("'tag' not defined");

	const ele = document.createElement(tag);
	if (attrs) {
		for (const [attrName, attrValue] of Object.entries(attrs)) {
			if (attrName === "style") {
				for (const [styleName, styleValue] of Object.entries(attrs.style!)) { ele.style[styleName as any] = styleValue; }
			} else if (attrName === "class") {
				if (typeof attrs.class === "string") {
					const classes = attrs.class.split(/ /g).filter(c => c.trim().length > 0);
					ele.classList.add(...classes);
				} else {
					ele.classList.add(...attrs.class!);
				}
			} else if (attrName === "for") {
				(ele as HTMLLabelElement).htmlFor = attrValue;
			} else if (attrName === "selected") {
				(ele as HTMLOptionElement).selected = (attrValue ? "selected" : undefined) as any;
			} else if (attrName === "disabled") {
				if (attrValue) ele.setAttribute("disabled", undefined!);
			} else if (attrName === "data") {
				const data_dict: { [att: string]: string } = attrs[attrName] as any;
				for (const [data_key, data_value] of Object.entries(data_dict)) {
					ele.dataset[data_key] = data_value;
				}
			} else {
				(ele as any)[attrName] = (attrs as any)[attrName];
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
export function intor(parent: HTMLElement, ...children: IntoElem[]): HTMLElement {
	clear_children(parent);
	return into(parent, ...children);
}

/**
 * Appends the children to the parent
 * @returns The parent itself. (Useful for fluent declaration.)
 */
export function into(parent: HTMLElement, ...children: IntoElem[]): HTMLElement {
	for (const child of children) {
		if (typeof child === "string") {
			if (children.length > 1) {
				parent.appendChild(to_node(child));
			} else {
				parent.textContent = child;
			}
		} else if ("then" in child) {
			const dummy = document.createElement("DIV");
			parent.appendChild(dummy);
			(async () => {
				const node = await child;
				parent.replaceChild(to_node(node), dummy);
			})();
		} else {
			parent.appendChild(child);
		}
	}
	return parent;
}

function to_node(elem: Node | string): Node {
	if (typeof elem === "string") {
		const text_div = document.createElement("DIV");
		text_div.textContent = elem;
		return text_div;
	}
	return elem;
}

export function as_fragment(builder: (target: Element) => void): Node {
	const frag = document.createDocumentFragment();
	builder(frag as any as Element);
	return frag;
}
