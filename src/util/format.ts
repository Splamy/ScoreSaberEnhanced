export function format_en(num: number, digits?: number): string {
	if (digits === undefined) digits = 2;
	return num.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function toggled_class(bool: boolean, css_class: string): string {
	return bool ? css_class : "";
}

export function number_invariant(num: string): number {
	return Number(num.replace(/,/g, ""));
}

export function number_to_timespan(num: number): string {
	const SECONDS_IN_MINUTE = 60;
	const MINUTES_IN_HOUR = 60;
	let str = "";

	let mod = (num % SECONDS_IN_MINUTE);
	str = mod.toFixed(0).padStart(2, "0") + str;
	num = (num - mod) / SECONDS_IN_MINUTE;

	mod = (num % MINUTES_IN_HOUR);
	str = mod.toFixed(0).padStart(2, "0") + ":" + str;
	num = (num - mod) / MINUTES_IN_HOUR;

	// optional hours
	return str;
}

export function round2(num: number): number {
	return Math.round(num * 100) / 100;
}

export function read_inline_date(date: string): moment.Moment {
	return moment.utc(date, "YYYY-MM-DD HH:mm:ss UTC");
}
