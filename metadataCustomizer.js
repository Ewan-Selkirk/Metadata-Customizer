//@ts-check

// NAME: MetadataCustomizer
// AUTHOR: Ewan Selkirk
// VERSION: 0.3
// DESCRIPTION: A Spicetify extension that allows you to customize how much track/album metadata is visible

/// <reference path="../../globals.d.ts" />

(function MetadataCustomizer() {
	const {Player, Platform, CosmosAsync, LocalStorage, React, SVGIcons} = Spicetify;
	const data_types = ["release_date", "tracks", "discs", "disc_ratio", "length"]

	// Local Storage Token
	const STORAGE_TOKEN = "Metadata_Customizer";
	// Object for storing our loaded config
	let config = {}

	// Make sure Spicetify has actually initiated before trying to run the extension
	if(!(Player && Platform && CosmosAsync && LocalStorage && React && SVGIcons)){
		setTimeout(MetadataCustomizer, 750);
		return
	}

	// Create new top bar button for customizing metadata
	new Spicetify.Topbar.Button(
		"Customize Metadata",
		`<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5 2a1 1 0 000 2h9a1 1 0 100-2H5zM8 7a1 1 0 000 2h6a1 1 0 100-2H8zM4 13a1 1 0 011-1h9a1 1 0 110 2H5a1 1 0 01-1-1zM2.707 5.293a1 1 0 00-1.414 1.414L2.586 8 1.293 9.293a1 1 0 001.414 1.414l2-2a1 1 0 000-1.414l-2-2z"/></svg>`,
		(self) => {
			const bound = self.element.getBoundingClientRect();
			// Create a new instance of the configuration menu
			const config_menu = new ConfigurationMenu();
			config_menu.setPosition(bound.left, bound.top);
			document.body.append(config_menu.background)
		}
	);

	// Create/Load configuration file
	CheckStorage();

	// If Spotify starts on a Album/Track page, do the thing
	CheckPage();

	// Page Change Event Listener
	Player.addEventListener("appchange", () => {
		// Check if the page is for an album or a single
		CheckPage();
	});

	async function ModifyMetadata() {
		let header = document.querySelector(".main-entityHeader-headerText");
		let metadata = header.lastChild;

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
				discs: config["bools"]["showDiscCountIfSingle"] ? Object.keys(disc_count).length.toString() + (Object.keys(disc_count).length === 1 ? " disc" : " discs") : "",
				disc_ratio: config["bools"]["showDiscCountIfSingle"] ? Object.values(disc_count).toString().replace(/,/g, "/") : "",
				// @ts-expect-error
				length: metadata.lastChild.innerText.split(", ")[1] ?? "Unavailable"
			})
		});

		// Get the result of our promise BEFORE accessing it...
		var new_metadata = await metadata_promise;

		for (var i = 0; i < 3; i++){
			let nestedHeader = MakeNewHeader(header);
			let customization = new Customization(data_types, config["filters"][i], new_metadata);

			// Create elements for the details
			let icon = CreateSVG(SVGIcons[config["icons"][i]]);
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

	// Check if the extension has a previously saved config
	// If not, create a default config
	function CheckStorage(){
		const default_filters = ["$release_date$", "$tracks$, $discs$ [$disc_ratio$]", "$length$"]
		const default_icons = ["enhance", "album", "clock"]
		const object = {"filters": default_filters, "icons": default_icons, "bools": {"allowScInToken": false, "showDiscCountIfSingle": false}}

		if(LocalStorage.get(STORAGE_TOKEN) !== null) {
			config = JSON.parse(LocalStorage.get(STORAGE_TOKEN));
		} else {
			LocalStorage.set(STORAGE_TOKEN, JSON.stringify(object))
			config = object;
		}
	}

	function SaveToStorage(){
		for (let i = 0; i < 3; i++){
			// @ts-expect-error
			config["filters"][i] = document.getElementById(`metadata-config-filter-${i === 0 ? "one" : i === 1 ? "two" : "three"}`).value;
			// @ts-expect-error
			config["icons"][i] = document.getElementById(`metadata-config-icon-${i === 0 ? "one" : i === 1 ? "two" : "three"}`).value;
		}

		LocalStorage.set(STORAGE_TOKEN, JSON.stringify(config));
		console.log("Config Saved")
	}

	// Check if the current page is an album
	function CheckPage() {
		if (Platform.History.location.pathname.startsWith("/album/")) {
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

	// Customization Configuration Menu \\
	function CreateConfigMenu(){
		const background = document.createElement("div");
		background.id = "metadata-customization-config"
		background.className = "";
		background.style.zIndex = "1029";

		const style = document.createElement("style")
		style.textContent = `
#metadata-customization-config {
	position: absolute;
	left: 0;
	right: 0;
	width: 100vw;
	height: 100vw;
	z-index: 5000;
}

#metadata-customization-options {
	display: inline-block;
	width: 55%;
	min-width: 465px;
	max-height: 15%;
	overflow: hidden auto;
	padding-bottom: 10px;
	position: absolute;
	z-index: 5001;
}

.metadata-config-icon-input {
	margin-left: 8px;
	border-radius: 4px;
	padding: 0 8px 0 12px;
	height: 32px;
	align-items: center;
	background: var(--spice-card);
	border: 0;
	color: var(--spice-text);
}

.metadata-config-filter-label {
	width: 150px;
}

.metadata-config-filter-input {
	color: var(--spice-text);
	background: var(--spice-card);
	margin-left: 8px;
	padding: 0 8px 0 12px;
}

.metadata-config-btn-apply {
	background: var(--spice-button);
	color: var(--spice-text);
	padding: 5px;
}
`;
		const children = document.createElement("div");
		children.id = "metadata-customization-options";
		children.className = "main-contextMenu-menu";
		children.onclick = (event) => event.stopPropagation();

		background.append(style, children);
		return {background, children};
	}

	function CreateConfigOptions(parent){
		let font_color = "var(--spice-text)";

		let title = document.createElement("h2")
		title.innerText = "Metadata Customization";
		title.style.color = font_color;

		let valid_tokens = document.createElement("h5");
		valid_tokens.innerText = `Valid Tokens:	${"$" + data_types.toString().replace(/,/g, "$, $") + "$"}`;
		valid_tokens.style.color = font_color;


		parent.append(title, valid_tokens);

		// Metadata Lines
		for (var i = 0; i < 3; i++) {
			let label = i === 0 ? "one" : i === 1 ? "two" : "three";

			let metadata_icon_line = document.createElement("div");
			let metadata_filter_line = document.createElement("div");

			let icon_label = document.createElement("label");
			let icon_input = document.createElement("select");

			icon_label.setAttribute("for", "metadata-config-icon-" + label);
			icon_label.innerText = "Icon: ";
			icon_label.style.color = font_color;

			icon_input.className = "GlueDropdown metadata-config-icon-input"
			icon_input.onclick = (event) => event.stopPropagation();
			icon_input.id = "metadata-config-icon-" + label;

			// Add every SVG icon as an option to the select element
			Object.keys(SVGIcons).sort().forEach(element => {
				let option = document.createElement("option")
				option.text = element;
				icon_input.append(option);
			});

			// Set the selected option to the index of the option loaded from local storage
			icon_input.options[Object.keys(SVGIcons).sort().findIndex(
				icon => icon === config["icons"][i])].selected = true;

			let filter_label = document.createElement("label")
			let filter_input = document.createElement("input")

			filter_label.setAttribute("for", "metadata-config-filter-" + label)
			filter_label.innerText = `Metadata Line ${label[0].toUpperCase() + label.substring(1)}: `
			filter_label.className = "metadata-config-filter-label";
			filter_label.style.color = font_color;

			filter_input.type = "text";
			filter_input.name = "metadata-config-filter-" + label;
			filter_input.id = "metadata-config-filter-" + label;
			filter_input.className = "metadata-config-filter-input";
			filter_input.value = config["filters"][i];

			metadata_icon_line.append(icon_label, icon_input)
			metadata_filter_line.append(filter_label, filter_input);
			parent.append(metadata_icon_line, metadata_filter_line);
		}

		let apply_button = document.createElement("button");
		apply_button.innerText = "Apply Config";
		apply_button.className = "metadata-config-btn-apply"
		apply_button.onclick = (event) => {
			SaveToStorage();
			event.stopPropagation();
		};

		parent.append(apply_button);
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
				new_input = new_input.replace(new RegExp("(?<Opening>(?:, *)*[\\(\\[\\{]*)*(?<Token>\\$" + 
					`(${found[t]})` + "\\$)(?<Closing>[\\}\\]\\)]*)*", "g"), 
				"$<Opening>" + this.data[found[t]] + "$<Closing>")
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

	class ConfigurationMenu {
		constructor(){
			const menu = CreateConfigMenu();

			this.background = menu.background;
			this.children = menu.children;

			this.background.onclick = () => {
				this.background.remove();
			}

			CreateConfigOptions(this.children);
		}

		setPosition(x, y){
			this.children.style.left = x + "px";
			this.children.style.top = y + 40 + "px";
		}
	}
})();