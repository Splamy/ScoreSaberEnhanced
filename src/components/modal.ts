import { create, into } from "../util/dom";

interface IModalOptions {
	text: string | HTMLElement;
	buttons?: { [name: string]: { text: string, class?: string } };
	default?: boolean;
}

export class Modal {
	public after_close?: (answer: string) => any;
	private elem: HTMLElement;
	constructor(elem: HTMLElement) {
		this.elem = elem;
	}
	public show(): void {
		this.elem.classList.add("is-active");
	}
	public close(answer?: string): void {
		this.elem.classList.remove("is-active");
		if (this.after_close)
			this.after_close(answer ?? "");
	}
	public dispose(): void {
		document.body.removeChild(this.elem);
	}
}

export function create_modal(opt: IModalOptions): Modal {
	const base_div = create("div", { class: "modal" });
	const modal = new Modal(base_div);

	const buttons = create("div", { class: "buttons" });
	into(base_div,
		create("div", {
			class: "modal-background",
			onclick() {
				modal.close("x");
			}
		}),
		create("div", { class: "modal-content" },
			create("div", { class: "box" },
				opt.text,
				create("br"),
				buttons,
			),
		),
		create("button", {
			class: "modal-close is-large",
			/*aria-label="close"*/
			onclick() {
				modal.close("x");
			}
		})
	);

	if (opt.buttons) {
		for (const btn_name of Object.keys(opt.buttons)) {
			const btn_data = opt.buttons[btn_name];
			into(buttons, create("button", {
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

export function show_modal(opt: IModalOptions): Promise<string> {
	return new Promise((resolve, reject) => {
		opt.default = true;
		const modal = create_modal(opt);
		modal.after_close = (answer) => {
			modal.dispose();
			resolve(answer);
		};
	});

}
