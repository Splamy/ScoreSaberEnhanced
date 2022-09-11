<script lang="ts">
	import * as beastsaber from "../api/beastsaber";
	import * as compare from "../compare";
	import * as env from "../env";
	import * as modal from "./modal";
	import { update_button_visibility } from "../settings";
	import SseEvent from "./events";
	import type { PageButtons } from "../env";
	import QuickButton from "./QuickButton.svelte";
	import { update_wide_table_css } from "../pages/user";
	import { logc } from "../util/log";

	function onChangeWideTable(this: HTMLInputElement) {
		env.set_wide_table(this.checked);
		update_wide_table_css();
	}

	function onChangeUseNewSSApi(this: HTMLInputElement) {
		env.set_use_new_ss_api(this.checked);
	}

	async function updateAllUser() {
		await compare.fetch_all();
	}

	async function forceUpdateAllUser() {
		const resp = await modal.show_modal({
			text:
				"Warning: This might take a long time, depending " +
				"on how many users you have in your library list and " +
				"how many songs they have on ScoreSaber.\n" +
				"Use this only when all pp is fucked again.\n" +
				"And have mercy on the ScoreSaber servers.",
			buttons: {
				ok: { text: "Continue", class: "is-success" },
				x: { text: "Cancel", class: "is-danger" },
			},
		});
		if (resp === "ok") {
			await compare.fetch_all(true);
		}
	}

	function onChangeBeastSaber(this: HTMLInputElement) {
		env.set_bsaber_username(this.value);
		update_button_visibility();
	}

	let isBeastSaberSyncing = false;
	async function beastSaberSync(this: HTMLButtonElement) {
		const bsaber_username = env.get_bsaber_username();
		if (!bsaber_username) {
			await modal.show_modal({
				text: "Please enter a username first.",
				buttons: modal.buttons.OkOnly,
			});
			return;
		}

		isBeastSaberSyncing = true;
		await update_bsaber_bookmark_cache(bsaber_username);
		isBeastSaberSyncing = false;
	}

	async function update_bsaber_bookmark_cache(
		username: string
	): Promise<void> {
		for (let page = 1; ; page++) {
			SseEvent.StatusInfo.invoke({
				text: `Loading BeastSaber page ${page}`,
			});
			const bookmarks = await beastsaber.get_bookmarks(
				username,
				page,
				50
			);
			if (!bookmarks) break;
			process_bookmarks(bookmarks.songs);
			if (bookmarks.next_page === null) {
				break;
			}
		}

		SseEvent.StatusInfo.invoke({
			text: "Finished loading BeastSaber bookmarks",
		});
	}

	function process_bookmarks(songs: beastsaber.IBeastSaberSongInfo[]): void {
		for (const song of songs) {
			if (!song.hash) {
				continue;
			}
			if (!env.check_bsaber_bookmark(song.hash)) {
				env.add_bsaber_bookmark(song.hash);
			}
		}
	}

	const bm = env.get_button_matrix();
	function updateButtonMatrix(this: HTMLInputElement) {
		let key = this.dataset.key as PageButtons;
		let val = this.checked;
		logc("Updating", key, val);
		bm[key] = val;
		env.set_button_matrix(bm);
		update_button_visibility();
	}
</script>

<div>
	<div class="field">
		<label class="label">Song Table Options</label>
	</div>
	<div class="field">
		<input
			id="wide_song_table"
			type="checkbox"
			class="is-checkradio"
			checked={env.get_wide_table()}
			on:change={onChangeWideTable}
		/>
		<label for="wide_song_table" class="checkbox">
			Expand table to full width
		</label>
	</div>

	<div class="field">
		<label class="label">QuickAction Buttons</label>
	</div>
	<table class="table">
		<tr>
			<th />
			{#each env.BMButton as button}
				<th>
					<QuickButton
						size="medium"
						song_hash={undefined}
						type={button}
						preview={true}
					/>
				</th>
			{/each}
		</tr>
		{#each env.BMPage as page}
			<tr>
				<td>{page}</td>
				{#each env.BMButton as button}
					<td>
						<input
							id="show-{page}-{button}"
							type="checkbox"
							class="is-checkradio"
							data-key="{page}-{button}"
							checked={bm[`${page}-${button}`]}
							on:change={updateButtonMatrix}
						/>
						<label for="show-{page}-{button}" />
					</td>
				{/each}
			</tr>
		{/each}
	</table>

	<div class="field">
		<label class="label">Other</label>
	</div>
	<div class="field">
		<input
			id="use_new_ss_api"
			type="checkbox"
			class="is-checkradio"
			checked={env.get_use_new_ss_api()}
			on:change={onChangeUseNewSSApi}
		/>
		<label for="use_new_ss_api" class="checkbox">
			Use new ScoreSaber api
		</label>
	</div>

	<div class="field">
		<label class="label">Tools</label>
	</div>
	<div class="buttons">
		<button class="button" on:click={updateAllUser}>
			Update All User
		</button>
		<button class="button is-danger" on:click={forceUpdateAllUser}>
			Force Update All User
		</button>
	</div>

	<div class="field">
		<label class="label">Beastsaber Bookmarks</label>
	</div>
	<div class="field has-addons">
		<div class="control has-icons-left">
			<input
				id="bsaber_username"
				type="text"
				class="input"
				placeholder="Username"
				value={env.get_bsaber_username() ?? ""}
				on:change={onChangeBeastSaber}
			/>
			<span class="icon is-small is-left">
				<i class="fas fa-user fa-xs" />
			</span>
		</div>
		<div class="control">
			<button
				class="button bsaber_update_bookmarks"
				data-tooltip="Load Bookmarks"
				on:click={beastSaberSync}
			>
				<i class="fas fa-sync" class:fa-spin={isBeastSaberSyncing} />
			</button>
		</div>
	</div>
	<br />
</div>
