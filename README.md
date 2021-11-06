# ScoreSaberEnhanced
Provides additional features to the ScoreSaber website

# Install
Get Tampermonkey or Greasemonkey for [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) or [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/). Then install the script from [here](https://github.com/Splamy/ScoreSaberEnhanced/raw/master/scoresaber.user.js).

# Compare Scores
- Compare your scores with your friends
- Extend the song table to the full box width
- Direct links to BeatSaver and OneClick download

![Compare](https://i.imgur.com/3xy8FQo.png)

- Compare scores on a song page with friends

![Compare2](https://i.imgur.com/ZtCGEbx.png)

- Show pp distribution Graphs

![Compare3](https://i.imgur.com/KQNqWFg.png)

# Pin
- Pin your own profile to the nav bar
- Jump directly to other saved users

![Pin](https://i.imgur.com/2B0GLwi.png)

# Themes
- Many themes, including various dark themes.

![Themes](https://i.imgur.com/3Nso0TP.png)

# Other
- Rank number link on a user page jumps to the page where the user is
- Rank number now links to the song leaderboard page where the user is
![LinkFix2](https://i.imgur.com/U1quEKP.png)



# Development

Setup everything with `yarn` / `npm install`

Run `yarn build` to build the project.

Run `yarn dev` to run the watcher which will continuously build the project.

The generated output file is always `scoresaber.user.js`.

# Changelog

1.11.1 | 2021-11-06
 - Fixed calculated percentages on Expert+ ([#26](https://github.com/Splamy/ScoreSaberEnhanced/pull/25) Thanks [@ChrisJAllan](https://github.com/ChrisJAllan) for this PR)

1.11.0 | 2021-08-05
 - Updated to new beatsaber api ([#25](https://github.com/Splamy/ScoreSaberEnhanced/pull/25) Thanks [@ChrisJAllan](https://github.com/ChrisJAllan) for this PR)

1.10.1 | 2021-08-04
 - Added option to disable user song compare

1.10.0 | 2021-08-04
 - Added Download links to the main song list & filter for hiding duplicate songs ([#24](https://github.com/Splamy/ScoreSaberEnhanced/pull/24) Thanks [@urholaukkarinen](https://github.com/urholaukkarinen) for this PR)
 - Added ButtonMatrix in the options to customize where to show which quickaction buttons
 - Minor Bugfixes

1.9.2 | 2021-05-10
 - Fixed [#21](https://github.com/Splamy/ScoreSaberEnhanced/issues/21) sometimes failing to update users. ([#23](https://github.com/Splamy/ScoreSaberEnhanced/pull/23) Thanks [@Lemmmy](https://github.com/Lemmmy) for this PR)

1.9.1 | 2021-02-25
 - Also change country rank link to jump to correct page.

1.9.0 | 2020-08-13
 - Added percentage info on Leaderboard and Profile pages ([#20](https://github.com/Splamy/ScoreSaberEnhanced/pull/20) Thanks [@karghoff](https://github.com/karghoff) for this PR)

1.8.7 | 2020-08-05
 - Fixed graphjs throwing when loading in background tab.

1.8.6 | 2020-08-04
 - Fixed [#19](https://github.com/Splamy/ScoreSaberEnhanced/issues/19) incorrectly loading css.

1.8.5 | 2020-07-28
 - Using sessionStore to cache some data.

1.8.4 | 2020-07-27
 - Explicitely import graphjs to make ppgraph loading more consistent ([#18](https://github.com/Splamy/ScoreSaberEnhanced/pull/18) Thanks [@trgwii](https://github.com/trgwii) for this PR)

1.8.3 | 2020-07-13
 - Added ratelimit detection for the scoresaber api

1.8.2 | 2020-06-20
 - Fixed new.scoresaber api data contract ([#14](https://github.com/Splamy/ScoreSaberEnhanced/pull/14) Thanks [@ErisApps](https://github.com/ErisApps) for this PR)

1.8.1 | 2020-05-05
 - Added !bsr button

1.8.0 | 2020-05-05
 - Added BeastSaber bookmarks loading ([#12](https://github.com/Splamy/ScoreSaberEnhanced/pull/12) Thanks [@sre](https://github.com/sre) for this PR)
 - Improved options modal

1.7.1
 - Actually fixed colors for default dark theme (hopefully)

1.7.0
 - Added 'Update All' and 'Force Update All' for easier updating ([#11](https://github.com/Splamy/ScoreSaberEnhanced/issues/11))  
   (Especially since the recent pp rework this might be useful)

1.6.6
 - Fixed compatibility for GreaseMonkey ([#10](https://github.com/Splamy/ScoreSaberEnhanced/issues/10))

1.6.5
 - Fixed typo ([#9](https://github.com/Splamy/ScoreSaberEnhanced/issues/9))

1.6.4
 - Fixed wrong accuracy calculation with new ss api

1.6.3
 - Added preview button to song page
 - Fixed issues with the new ss backend api

1.6.2
 - Added new ScoreSaber api as loader backend.
   Retrieving data should now be super fast again.
   If you have Problems you can disable it in the settings.

1.6.1
 - Improved layout of bs/bs stats and added song length

1.6.0
 - Added song stats from BeatSaver and BeastSaber to song page

1.5.0
 - Added pp distribution graph
 - Adjust colors to dark mode of ScoreSaber

1.4.1
 - Fixed force update for song pages

1.4.0
 - Added visual feedback for download start/fail

1.3.1
 - Fixed 'friends' tab being broken
 - Fixed some songs breaking the song comparison
 - Disable BS/OC buttons on songs with invalid ids
