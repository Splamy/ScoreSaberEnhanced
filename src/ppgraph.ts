import { get_compare_user, get_current_user, is_user_page } from "./env";
import g from "./global";
import { create } from "./util/dom";
import { check } from "./util/err";

let chart: Chart | undefined;

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
			data_scaled.push(pp * Math.pow(0.965, index));
		});
	const color = (Number(user_id) % 3600) / 10;

	return [{
		label: `${user.name} (song pp)`,
		backgroundColor: `hsl(${color}, 100%, 50%)`,
		borderColor: `hsl(${color}, 100%, 50%)`,
		fill: false,
		data,
	}, {
		label: `${user.name} (scaled pp)`,
		backgroundColor: `hsl(${color}, 60%, 25%)`,
		borderColor: `hsl(${color}, 60%, 25%)`,
		fill: false,
		data: data_scaled,
	}];
}

export function update_pp_distribution_graph(): void {
	const chart_elem = document.getElementById("pp_chart") as HTMLCanvasElement | null;
	if (chart_elem == null)
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

export function setup_pp_distribution_graph(): void {
	if (!is_user_page())
		return;

	const baseBox = check(document.querySelector(".section > .container > .content > *:nth-child(1)"));
	baseBox.insertAdjacentElement("afterend",
		create("div", { class: "box has-shadow" },
			create("canvas", {
				id: "pp_chart",
				style: {
					width: "100%",
					height: "20em",
				}
			})
		)
	);

	update_pp_distribution_graph();
}
