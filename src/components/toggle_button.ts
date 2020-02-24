import { create } from "../util/dom";

export type IButtonElement = HTMLElement & {
	on: () => any,
	off: () => any,
	toggle: () => any,
	view_class: string,
};

type ButtonType = "primary" | "link" | "info" | "success" | "danger";

interface IButtonOptions {
	text: string;
	type?: ButtonType;
	onclick?: (this: IButtonElement, state: boolean) => any;
	default?: boolean;
}

function get_state(elem: IButtonElement): boolean {
	return !elem.classList.contains(elem.view_class);
}

function set_state(elem: IButtonElement, state: boolean): void {
	if (state) {
		elem.classList.remove(elem.view_class);
	} else {
		elem.classList.add(elem.view_class);
	}
}

export function button(opt: IButtonOptions): IButtonElement {
	const btn = create("div", {
		class: ["button"]
	}, opt.text) as any as IButtonElement;
	btn.view_class = `is-${opt.type ?? "primary"}`;

	btn.on = () => {
		set_state(btn, true);
		opt.onclick?.call(btn, true);
	};

	btn.off = () => {
		set_state(btn, false);
		opt.onclick?.call(btn, false);
	};

	btn.toggle = () => {
		const state = !get_state(btn);
		set_state(btn, state);
		opt.onclick?.call(btn, state);
	};

	btn.onclick = () => {
		if (btn.getAttribute("disabled") == null) {
			btn.toggle();
		}
	};

	set_state(btn, opt.default ?? false);

	return btn;
}
