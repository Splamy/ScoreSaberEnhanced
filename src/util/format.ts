export function format_en(num: number, digits?: number): string {
    if (digits === undefined) digits = 2;
    return num.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function toggled_class(bool: boolean, css_class: string) {
    return bool ? css_class : "";
}

export function number_invariant(num: string): number {
    return Number(num.replace(/,/g, ""));
}