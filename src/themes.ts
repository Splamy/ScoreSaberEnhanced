import { create, into } from "./util/dom";

export const themes = ["Default", "Cerulean", "Cosmo", "Cyborg", "Darkly", "Flatly",
	"Journal", "Litera", "Lumen", "Lux", "Materia", "Minty", "Nuclear", "Pulse",
	"Sandstone", "Simplex", "Slate", "Solar", "Spacelab", "Superhero", "United",
	"Yeti"];
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
.beatsaver_bg {
	filter: invert(1);
}
/* Reset colors for generic themes */
span.songBottom.time, span.scoreBottom, span.scoreTop.ppWeightedValue {
	color:unset;
}
span.songTop.pp, span.scoreTop.ppValue, span.scoreTop.ppLabel, span.songTop.mapper {
	text-shadow: 1px 1px 2px #000;
}`;

export function setup(): void {
	GM_addStyle(`.compact {
		padding-right: 0 !important;
		padding-left: 0 !important;
		margin-left: 0px !important;
		margin-right: 0px !important;
		text-align: center !important;
	}
	h5 > * {
		margin-right: 0.3em;
	}
	#wide_song_table_css:checked ~ table.ranking.songs {
		max-width: unset !important;
	}
	.beatsaver_bg {
		background: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200' version='1.1'%3E%3Cg fill='none' stroke='%23000000' stroke-width='10'%3E %3Cpath d='M 100,7 189,47 100,87 12,47 Z' stroke-linejoin='round'/%3E %3Cpath d='M 189,47 189,155 100,196 12,155 12,47' stroke-linejoin='round'/%3E %3Cpath d='M 100,87 100,196' stroke-linejoin='round'/%3E %3Cpath d='M 26,77 85,106 53,130 Z' stroke-linejoin='round'/%3E %3C/g%3E %3C/svg%3E") no-repeat center/85%;
		width: 100%;
		height: 100%;
		background-color: #FFF;
	}
	.fas_big {
		line-height: 150%;
		padding-right: 0.5em;
		padding-left: 0.5em;
		min-width: 2.25em;
		/* Fix for some themes overriding font */
		font-weight: 900;
		font-family: "Font Awesome 5 Free";
	}
	.fas_big::before {
		font-size: 120%;
	}
	.tooltip { }
	.tooltip .tooltiptext {
		visibility: hidden;
		background-color: #555;
		color: #fff;
		border-radius: 6px;
		position: absolute;
		z-index: 1;
		bottom: 125%;
		margin-left: -3em;
		opacity: 0;
		transition: opacity 0.3s;
		padding: 0.2em 1em;
	}
	.tooltip:hover .tooltiptext {
		visibility: visible;
		opacity: 1;
	}
	#leaderboard_tool_strip > * {
		margin-right: 0.5em;
	}
	.offset_tab {
		margin-left: auto;
	}`);
	into(document.head, create("link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/bulma-checkradio/dist/css/bulma-checkradio.min.css" }));
	// into(document.head, create("link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/bulma-tooltip/dist/css/bulma-tooltip.min.css" }));
}
