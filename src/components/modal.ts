import { create, into, IntoElem } from "../util/dom";

interface IModalOptions<T extends string> {
	title?: IntoElem;
	text: IntoElem;
	footer?: IntoElem;
	type?: "content" | "card";
	buttons?: IModalButtonGroup<T>;
	default?: boolean;
}

type IModalButtonGroup<T extends string> = { [K in T]: IModalButton; };
type Answer<T extends string> = T | "x";

interface IModalButton {
	text: string;
	class?: string;
}

export class Modal<T extends string> {
	public after_close?: (answer: Answer<T>) => any;
	private elem: HTMLElement;
	constructor(elem: HTMLElement) {
		this.elem = elem;
	}
	public show(): void {
		this.elem.classList.add("is-active");
		document.documentElement.classList.add("is-clipped");
	}
	public close(answer?: Answer<T>): void {
		this.elem.classList.remove("is-active");
		if (!document.querySelector(".modal.is-active"))
			document.documentElement.classList.remove("is-clipped");
		if (this.after_close)
			this.after_close(answer ?? "x");
	}
	public dispose(): void {
		document.body.removeChild(this.elem);
	}
}

export function create_modal<T extends string>(opt: IModalOptions<T>): Modal<T> {
	const base_div = create("div", { class: "modal" });
	const modal = new Modal<T>(base_div);

	const button_bar = create("div", { class: "buttons" });

	let inner;
	switch (opt.type ?? "content") {
		case "content":
			inner = create("div", { class: "modal-content" },
				create("div", { class: "box" },
					opt.text,
					create("br"),
					button_bar,
				),
			);
			break;
		case "card":
			inner = create("div", { class: "modal-card" },
				create("header", { class: "modal-card-head" }, opt.title ?? ""),
				create("header", { class: "modal-card-body" }, opt.text),
				create("header", { class: "modal-card-foot" }, opt.footer ?? button_bar),
			);
			break;
		default:
			throw new Error("invalid type");
	}

	into(base_div,
		create("div", {
			class: "modal-background",
			onclick() {
				modal.close("x");
			}
		}),
		inner,
		create("button", {
			class: "modal-close is-large",
			/*aria-label="close"*/
			onclick() {
				modal.close("x");
			}
		})
	);

	if (opt.buttons) {
		for (const btn_name of Object.keys(opt.buttons) as T[]) {
			const btn_data = opt.buttons[btn_name];
			into(button_bar, create("button", {
				class: ["button", btn_data.class ?? ""],
				onclick() {
					modal.close(btn_name);
				}
			}, btn_data.text));
		}
	}

	document.body.appendChild(base_div);
	if (opt.default) modal.show();

	return modal;
}

export function show_modal<T extends string>(opt: IModalOptions<T>): Promise<Answer<T>> {
	return new Promise((resolve, reject) => {
		opt.default = true;
		const modal = create_modal(opt);
		modal.after_close = (answer) => {
			modal.dispose();
			resolve(answer);
		};
	});
}

export const buttons = {
	OkOnly: { x: { text: "Ok", class: "is-primary" } },
};
