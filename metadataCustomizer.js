//@ts-check

// NAME: MetadataCustomizer
// AUTHOR: Ewan Selkirk
// VERSION: 0.2.2
// DESCRIPTION: A Spicetify extension that allows you to customize how much track/album metadata is visible

/// <reference path="../../globals.d.ts" />

(function MetadataCustomizer() {
	const {Player, Platform, CosmosAsync, SVGIcons} = Spicetify;
	const data_types = ["release_date", "tracks", "discs", "disc_ratio", "length"]
	const default_filters = ["$release_date$", "$tracks$, $discs$ [$disc_ratio$]", "$length$"]
	const default_icons = ["enhance", "album", "clock"]

	// Make sure Spicetify has actually initiated before trying to run the extension
	if(!(Player && Platform && CosmosAsync && SVGIcons)){
		setTimeout(MetadataCustomizer, 500);
		return
	}

	// If Spotify starts on a Album/Track page, do the thing
	CheckPage();

	// Page Change Event Listener
	Player.addEventListener("appchange", () => {
		// Check if the page is for an album or a single
		CheckPage();
	});

	async function ModifyMetadata() {
		let header = document.querySelector(".main-entityHeader-headerText");
		let metadata = header.children[2];

		let metadata_promise = new Promise(async function(resolve) {
			let details = await CosmosAsync.get("https://api.spotify.com/v1/albums/" + Platform.History.location.pathname.split("/")[2])
			let disc_count = {}
	
			// Count how many tracks there are per disc (Why does the API not just have this already???)
			details.tracks.items.forEach(track => disc_count[track.disc_number] = (disc_count[track.disc_number] || 0) + 1);

			resolve({
				// Convert YYYY-MM-DD -> Unix -> Long Date
				release_date: new Intl.DateTimeFormat("default", {dateStyle: "full"}).format(Date.parse(details.release_date)),
				// Return # of tracks
				tracks: (details.tracks.total.toString() + (details.tracks.total === 1 ? " track" : " tracks")),
				// Return # of disc(s) & the ratio of track to disc
				// or just "1 disc" if only one disc
				discs: Object.keys(disc_count).length.toString() + (Object.keys(disc_count).length === 1 ? " disc" : " discs"),
				disc_ratio: Object.values(disc_count).toString().replaceAll(",", "/"),
				// @ts-expect-error
				length: metadata.lastChild.innerText.split(", ")[1] ?? "Unavailable"
			})
		});

		// Get the result of our promise BEFORE accessing it...
		var new_metadata = await metadata_promise;

		for (var i = 0; i < 3; i++){
			let nestedHeader = MakeNewHeader(header);
			let customization = new Customization(data_types, default_filters[i], new_metadata);

			// Create elements for the details
			let icon = CreateSVG(SVGIcons[default_icons[i]]);
			nestedHeader.appendChild(icon);
			let newElement = nestedHeader.appendChild(document.createElement("span"));

			// Add details to the new header
			newElement.classList.add("main-type-mesto");
			newElement.innerText = customization.ParseCustomization();
		}

		// Remove default metadata
		for (var i = 0; i < 2; i++){
			metadata.lastChild.remove();
		}
	}

	// Check if the current page is an album
	// TODO: Check if "/collection/tracks" is actually necessary.
	function CheckPage() {
		if (Platform.History.location.pathname.startsWith("/collection/tracks") || 
			Platform.History.location.pathname.startsWith("/album/")) {
			ModifyMetadata();
		}
	}

	// Create an SVG element with all the attributes already set
	function CreateSVG(svg) {
		var elem = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		elem.setAttribute("role", "img");
		elem.setAttribute("height", "24");
		elem.setAttribute("width", "24");
		elem.setAttribute("fill", "currentColor");
		elem.setAttribute("viewBox", "0 0 16 16");
		elem.innerHTML = svg;

		return elem;
	}

	// Create a new metadata header
	function MakeNewHeader(parent){
		// Create new header element
		var newHeader = parent.appendChild(document.createElement("div"));
		newHeader.classList.add("main-entityHeader-metaData");

		// The header has a nested div that gives nice spacing
		var nestedHeader = newHeader.appendChild(document.createElement("div"));
		nestedHeader.classList.add("main-entityHeader-creatorWrapper");
	
		return nestedHeader;
	}

	class Customization{
		/**
		 * Constructor for the Customization Class
		 * @param {string[]} tokens List of valid data types
		 * @param {string} input The string to check for tokens in
		 * @param {string[]} data The data to match the tokens to
		 */
		constructor(tokens, input, data){
			this.tokens = tokens;
			this.input = input;
			this.data = data;
		}

		// Token Replacer Method
		ParseCustomization(){
			// List of tokens found in the input string
			var found = this.FindTokens();

			// Skip everything if no tokens were found
			if (found.length < 1) return this.input

			// Mutable version of the input string
			var new_input = this.input;

			// Replace all instances of the token with the data
			for (var t = 0; t < found.length; t++){
				// @ts-expect-error
				new_input = new_input.replaceAll(`\$${found[t]}\$`, this.data[found[t]])
			}

			// Return the new string
			return new_input;
		}

		// Token Finder Method
		FindTokens(){
			var found_tokens = []

			// Iterate through the list of data types
			// If a token is found, push it to the found_tokens array
			for (var t = 0; t < this.tokens.length; t++){
				if (this.input.includes(`\$${this.tokens[t]}\$`)){
					found_tokens.push(this.tokens[t])
				}
			}

			// Return the array
			return found_tokens;
		}
	}
})();