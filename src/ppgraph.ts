import SseEvent from "./components/events";
import { button, IButtonElement } from "./components/toggle_button";
import { get_compare_user, get_current_user, insert_compare_display, insert_compare_feature, is_user_page } from "./env";
import g from "./global";
import { create } from "./util/dom";
import { check } from "./util/err";

let chart: Chart | undefined;
let chart_elem: HTMLCanvasElement | undefined;
let chart_button: IButtonElement | undefined;

export function setup_pp_graph(): void {
	if (!is_user_page()) { return; }

	chart_elem = create("canvas");
	const chart_container = create("div", {
		style: {
			width: "100%",
			height: "20em",
			display: "none", // for the toggle button
		}
	}, chart_elem);
	insert_compare_display(chart_container);

	chart_button = button({
		default: false,
		text: "Show pp Graph",
		onclick(active) {
			if (!chart_elem) return;
			this.innerText = (active ? "Hide" : "Show") + " pp Graph";
			set_pp_graph_visibility(chart_container, active);
		}
	});
	insert_compare_feature(chart_button);

	update_pp_graph_buttons();

	SseEvent.UserCacheChanged.register(update_pp_graph_buttons);
	SseEvent.CompareUserChanged.register(update_pp_graph);
}

function chartUserData(canvasContext: CanvasRenderingContext2D, datasets: Chart.ChartDataSets[], labels: Array<string | string[]>): void {
	if (chart !== undefined) {
		chart.data = {
			labels,
			datasets
		};
		chart.update();
		return;
	}

	// @ts-ignore
	chart = new Chart(canvasContext, {
		type: "line",
		data: {
			labels,
			datasets,
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			elements: {
				point: {
					radius: 2,
				}
			},
			tooltips: {
				callbacks: {
					label: tooltipItem => String(tooltipItem.yLabel),
					title: () => "",
				}
			},
			scales: {
				xAxes: [{
					display: false,
				}]
			}
		},
	});
}

function get_graph_data(user_id: string) {
	const user = g.user_list[user_id];
	if (user === undefined)
		return [];

	const data: number[] = [];
	const data_scaled: number[] = [];
	Object.keys(user.songs)
		.filter(sid => user.songs[sid].pp > 0)
		.sort((a, b) => user.songs[b].pp - user.songs[a].pp)
		.forEach((songId, index) => {
			// labels.push("lul");
			const pp = user.songs[songId].pp;
			data.push(pp);
			data_scaled.push(+(pp * Math.pow(g.pp_weighting_factor, index)).toFixed(2));
		});
	const color = (Number(user_id) % 3600) / 10;

	return [{
		label: `${user.name} (song pp)`,
		backgroundColor: `hsl(${color}, 100%, 50%)`,
		borderColor: `hsl(${color}, 100%, 50%)`,
		fill: false,
		data,
	}, {
		label: `${user.name} (weighted pp)`,
		backgroundColor: `hsl(${color}, 60%, 25%)`,
		borderColor: `hsl(${color}, 60%, 25%)`,
		fill: false,
		data: data_scaled,
	}];
}

function update_pp_graph(): void {
	if (chart_elem === undefined)
		return;
	let dataSets = get_graph_data(get_current_user().id);
	const compare_user = get_compare_user();
	if (get_current_user().id !== compare_user && compare_user !== undefined)
		dataSets = [...dataSets, ...get_graph_data(compare_user)];

	let max = 0;
	for (const set of dataSets) {
		max = Math.max(max, set.data.length);
	}
	for (const set of dataSets) {
		if (set.data.length < max) {
			set.data.length = max;
			set.data.fill(0, set.data.length, max);
		}
	}
	const labels = Array(max);
	labels.fill("Song", 0, max);

	chartUserData(check(chart_elem.getContext("2d")), dataSets, labels);
}

export function update_pp_graph_buttons() {
	if (!chart_button) { return; }

	// Check if the current user is in the database
	const user = get_current_user();
	if (g.user_list[user.id] === undefined) {
		// He is now, we disable the feature
		chart_button.setAttribute("disabled", "");
		chart_button.setAttribute("data-tooltip", "Add the user to your score cache for this feature");
		chart_button.off();
	} else {
		chart_button.removeAttribute("disabled");
		chart_button.removeAttribute("data-tooltip");
	}
}

function set_pp_graph_visibility(elem: HTMLElement, active: boolean) {
	if (active) {
		if (!chart) {
			update_pp_graph();
		}
		elem.style.display = "";
	} else {
		elem.style.display = "none";
	}
}
