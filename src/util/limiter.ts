export class Limiter {
	public ratelimit_reset: number | undefined;
	public ratelimit_remaining: number | undefined;
	public ratelimit_limit: number | undefined;

	constructor() {
		this.ratelimit_reset = undefined;
		this.ratelimit_remaining = undefined;
	}

	public async wait(): Promise<void> {
		const now = unix_timestamp();
		if (this.ratelimit_reset === undefined || now > this.ratelimit_reset) {
			this.ratelimit_reset = undefined;
			this.ratelimit_remaining = undefined;
			return;
		}

		if (this.ratelimit_remaining === 0) {
			const sleepTime = (this.ratelimit_reset - now);
			console.log(`Waiting for cloudflare rate limiter... ${sleepTime}sec`);
			await sleep(sleepTime * 1000);
			this.ratelimit_remaining = this.ratelimit_limit;
			this.ratelimit_reset = undefined;
		}
	}

	public setLimitData(remaining: number, reset: number, limit: number): void {
		this.ratelimit_remaining = remaining;
		this.ratelimit_reset = reset;
		this.ratelimit_limit = limit;
	}
}

export async function sleep(timeout: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, timeout));
}

export function unix_timestamp(): number {
	return Math.round((new Date()).getTime() / 1000);
}

// Some benchmarks for scoresaber.com

// Requesting user [2538637699496776]; has 243 pages
//   (Requests, Time, RPM, OK)
// - (      80,   27, 180, ❌)
// - (      80,   40, 120, ❌)
// - (     134,   90,  90, ❌)
// - (     138,   98,  85, ❌)
// - (     ALL,  183,  80, ✅)
// - (     ALL,  217,  70, ✅)
// - (     ALL,  244,  60, ✅)

// The cloudflare rate limit data matches this observation
// x-ratelimit-limit: 80
// x-ratelimit-remaining: 79
// x-ratelimit-reset: 1594669651
