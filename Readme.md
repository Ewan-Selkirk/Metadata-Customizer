# Metadata Customizer
Metadata Customizer is a Spicetify extension that allows you to customize how much track/album metadata is visible. 

## Why?
It's always annoyed the hell out of me that Spotify doesn't show when a track or album was released (unless you hover over the release year for like 3 seconds). Originally was meant to just change that one thing but apparently I don't know when to stop.

## Requirements

 - Spotify Desktop Client (Not from the Windows store if on Windows)
 - [Spicetify-cli](https://github.com/khanhas/spicetify-cli)

## How to Install

 1. Follow [this guide](https://spicetify.app/docs/getting-started/installation) for instructions on how to install Spicetify for your platform, including the ['Basic Usage'](https://spicetify.app/docs/getting-started/basic-usage) page.
 2. Run `spicetify path` to find where you Spicetify home folder is. This should contain  the folders `CustomApps & Themes`, and you may have to create an`Extensions` folder yourself.
 3. Drop the `metadataCustomizer.js` file into the `Extensions` folder.
 4. Run `spicetify config extensions metadataCustomizer.js` to enable the extension.
 5. Run `spicetify apply` to apply the changes and restart Spotify.

## List of Tokens
| Token          | Value                                       |
|----------------|---------------------------------------------|
| $release_date$ | The date and year the track released        |
| $tracks$       | Number of tracks in the album               |
| $discs$        | Number of discs in the album                |
| $disc_ratio$   | The ratio of # of tracks to disc (E.G. 7/8) |
| $length$       | The length of the album*                    |

Got a suggestion? Feel free to [make an issue](https://github.com/Ewan-Selkirk/Metadata-Customizer/issues/new?assignees=Ewan-Selkirk&labels=enhancement&template=token-request.md&title=%5BREQUEST%5D+) and I'll look into whether it's possible!

## Known Issues
- The Spotify album API has a hard limit of 50 tracks, meaning any album with more than 50 tracks will only show as having 50 tracks. This is in the process of being fixed.
- Longer albums won't have an accurate length and will instead show "about x hr".

## Screenshots
![alt text](assets/preview.jpg "Screenshot of the Spotify window with customized metadata")

## Acknowledgements
- [bookmark.js](https://github.com/khanhas/spicetify-cli/blob/master/Extensions/bookmark.js) for demonstrating how to make a pretty configuration menu and giving me a lot of pointers
- [Spicetify-Comfy](https://github.com/NYRI4/Comfy-spicetify) theme which is used in the screenshots