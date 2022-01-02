//@ts-check

// NAME: MetadataCustomizer
// AUTHOR: Ewan Selkirk
// DESCRIPTION: A Spicetify extension that allows you to customize how much track/album metadata is visible

/// <reference path="../../globals.d.ts" />

// TODO: Customization?

(function MetadataCustomizer() {
	const {Player, Platform, SVGIcons, CosmosAsync} = Spicetify;

	// Make sure Spicetify has actually initiated before trying to run the extension
	if(!(Player && Platform && SVGIcons && CosmosAsync)){
		setTimeout(MetadataCustomizer, 1000);
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
		var header = document.querySelector(".main-entityHeader-headerText");
		var metadata = header.children[2];
		const data_values = ["release_date", "tracks", "discs"]

		// I *think* this is how you do async promises in Javascript...
		// It works ¯\_(ツ)_/¯
		var metadata_promise = new Promise(async function(resolve) {
			var details = await CosmosAsync.get("https://api.spotify.com/v1/albums/" + Platform.History.location.pathname.split("/")[2])

			// Hacky ugly work about I made a 8 am
			var disc_count = [0, 0, 0, 0, 0, 0]
	
			// Count how many tracks there are per disc (Why does the API not just have this already???)
			details.tracks.items.forEach(track => disc_count[track.disc_number - 1] += 1);
			disc_count = disc_count.slice(0, disc_count.findIndex(x => x === 0));

			resolve({
				// Convert YYYY-MM-DD -> Unix -> Long Date
				release_date: new Intl.DateTimeFormat("default", {dateStyle: "full"}).format(Date.parse(details.release_date)),
				// Return # of tracks
				tracks: (details.tracks.total.toString() + " tracks"),
				// Return # of disc(s) & the ratio of track to disc
				// or just "1 disc" if only one disc
				discs: (disc_count.length.toString() + (disc_count.length === 1 ? " disc" : " discs")
					+ (disc_count.length === 1 ? "" : " (" + disc_count.toString().replace(",", "/") + ")")),
				// @ts-expect-error
				length: metadata.children[2].innerText.split(", ")[1]
			})
		});

		// Get the result of our promise BEFORE accessing it...
		var new_metadata = await metadata_promise;

		// TODO: Break element creation into a function for more modularity
		// TODO: Switch Statement so things are optional
		for (var i = 0; i < data_values.length; i++){
			// Create new header element
			var newHeader = header.appendChild(document.createElement("div"));
			newHeader.classList.add("main-entityHeader-metaData");

			// The header has a nested div that gives nice spacing
			var nestedHeader = newHeader.appendChild(document.createElement("div"));
			nestedHeader.classList.add("main-entityHeader-creatorWrapper");

			// Create elements for the details
			// @ts-expect-error (globals.d.ts only has 'check' as a valid option for SVGIcons)
			// Check 'Spicetify.SVGIcons' in the DevTools for a full list
			var icon = CreateSVG(SVGIcons.album);
			nestedHeader.appendChild(icon);
			var newElement = nestedHeader.appendChild(document.createElement("span"));

			// Add details to the new header
			newElement.classList.add("main-type-mesto");
			newElement.innerText = new_metadata[data_values[i]]
		}

		// Remove default metadata
		for (var i = 0; i < 2; i++){
			metadata.children[1].remove();
		}
	}

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

})();