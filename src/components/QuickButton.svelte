<script lang="ts">
	import * as beatsaver from "../api/beatsaver";
	import g from "../global";
	import type { BulmaSize } from "../declarations/Types";
	import { BMButtonHelp, check_bsaber_bookmark } from "../env";
	import type { Buttons } from "../env";
	import { oneclick_install } from "../util/song";

	export let song_hash: string | undefined = undefined;
	export let type: Buttons;
	export let size: BulmaSize;
	export let preview: boolean = false;
	export let page: string | undefined = undefined;

	let button: HTMLElement;
	let txtDummyNode: HTMLInputElement;

	$: disabled = (!preview && song_hash === undefined
		? "disabled"
		: undefined) as any as boolean;

	$: display =
		!preview && page !== undefined
			? `display: var(--sse-show-${page}-${type}, inline-flex);`
			: "";

	let color: string;
	let tooltip: string;
	$: {
		color = "";
		tooltip = BMButtonHelp[type].tip;

		if (type === "BeastBook" && !preview) {
			const bookmarked =
				song_hash === undefined
					? false
					: check_bsaber_bookmark(song_hash);
			color = bookmarked ? "is-success" : "is-danger";
			tooltip = bookmarked
				? "Bookmarked on BeastSaber"
				: "Not Bookmarked on BeastSaber";
		}
	}

	async function checked_hash_to_song_info(
		song_hash: string | undefined
	): Promise<beatsaver.IBeatSaverData> {
		reset_download_visual();
		if (song_hash === undefined) {
			failed_to_download();
			throw new Error("song_hash is undefined");
		}
		const song_info = await beatsaver.get_data_by_hash(song_hash);
		if (song_info === undefined) {
			failed_to_download();
			throw new Error("song_info is undefined");
		}
		return song_info;
	}

	function reset_download_visual(): void {
		button.classList.remove("button_success");
		button.classList.remove("button_error");
	}

	function failed_to_download(): void {
		button.classList.add("button_error");
	}

	function ok_after_download(): void {
		button.classList.add("button_success");
	}

	function new_page(link: string): void {
		window.open(link, "_blank");
	}

	async function onclick(this: HTMLElement) {
		if (preview) return;
		try {
			const song_info = await checked_hash_to_song_info(song_hash);
			if (type === "BS") {
				new_page(g.beatsaver_link + song_info.id);
			} else if (type === "OC") {
				await oneclick_install(song_info.id);
				ok_after_download();
			} else if (type === "Beast") {
				new_page(g.bsaber_songs_link + song_info.id);
			} else if (type === "BeastBook") {
				new_page(g.bsaber_songs_link + song_info.id);
			} else if (type === "Preview") {
				new_page(
					"https://skystudioapps.com/bs-viewer/?id=" + song_info.id
				);
			} else if (type === "BSR") {
				txtDummyNode.value = `!bsr ${song_info.id}`;
				txtDummyNode.select();
				txtDummyNode.setSelectionRange(0, 99999);
				document.execCommand("copy");
				ok_after_download();
			}
		} catch (err) {
			console.log("Failed QuickAction", song_hash, err);
			failed_to_download();
		}
	}
</script>

<div
	bind:this={button}
	class="button icon is-{size} {type}_bg_btn"
	class:has-tooltip-left={size !== "large" && !preview}
	style={display}
	{disabled}
	data-tooltip={tooltip}
	on:click={onclick}
>
	{#if type === "BS"}
		<div class="beatsaver_bg" />
	{:else if type === "OC"}
		<i class="fas fa-cloud-download-alt" />
	{:else if type === "Beast"}
		<div class="bsaber_bg" />
	{:else if type === "BeastBook"}
		<i class="fas fa-thumbtack" />
	{:else if type === "Preview"}
		<i class="fas fa-glasses" />
	{:else if type === "BSR"}
		<i class="fas fa-exclamation" />
		<input bind:this={txtDummyNode} class="dummy" />
	{/if}
</div>

<style>
	div {
		padding: 0;
		cursor: pointer;
	}
	div:disabled {
		cursor: default;
	}

	.bsaber_bg {
		background-image: url("https://bsaber.com/wp-content/themes/beastsaber-wp-theme/assets/img/avater-callback.png");
		background-size: cover;
		background-repeat: no-repeat;
		background-position: center;
		width: 100%;
		height: 100%;
		border-radius: inherit;
	}

	.dummy {
		position: absolute;
		top: 0px;
		left: -100000px;
	}
</style>
