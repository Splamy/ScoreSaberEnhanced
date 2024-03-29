import { create, into } from "./util/dom";
import { SSE_addStyle } from "./util/userscript";

export const themes = ["Default", "Cerulean", "Cosmo", "Cyborg", "Darkly", "Flatly",
	"Journal", "Litera", "Lumen", "Lux", "Materia", "Minty", "Nuclear", "Pulse",
	"Sandstone", "Simplex", "Slate", "Solar", "Spacelab", "Superhero", "United",
	"Yeti"];
export const dark_themes = ["Cyborg", "Darkly", "Nuclear", "Slate", "Solar", "Superhero"];

export const theme_light = `:root {
	--color-ahead: rgb(128, 255, 128);
	--color-behind: rgb(255, 128, 128);
	--color-highlight: lightgreen;
}`;
export const theme_dark = `:root {
	--color-ahead: rgb(0, 128, 0);
	--color-behind: rgb(128, 0, 0);
	--color-highlight: darkgreen;
}
.BS_bg_btn {
	background-color: white;
}
/* Reset colors for generic themes */
span.songBottom.time, span.scoreBottom, span.scoreTop.ppWeightedValue {
	color:unset;
}
span.songTop.pp, span.scoreTop.ppValue, span.scoreTop.ppLabel, span.songTop.mapper {
	text-shadow: 1px 1px 2px #000;
}`;

export function setup(): void {
	const style_data = `include$GULP_CSS`;
	SSE_addStyle(style_data);
	into(document.head, create("link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/bulma-checkradio/dist/css/bulma-checkradio.min.css" }));
}
