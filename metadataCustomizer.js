//@ts-check

// NAME: MetadataCustomizer
// AUTHOR: Ewan Selkirk
// VERSION: 0.7.1
// DESCRIPTION: A Spicetify extension that allows you to customize how much track/album metadata is visible

/// <reference path="../globals.d.ts" />

(function MetadataCustomizer() {
	const {Player, Platform, CosmosAsync, LocalStorage, React, SVGIcons} = Spicetify;
	const data_types = ["release_date", "tracks", "discs", "disc_ratio", "length"]

	// Used for previewing filters in the configuration menu
	const sample_data = {
		"release_date": "Monday, August 14, 2000",
		"tracks": "13 tracks",
		"discs": "3 discs",
		"disc_ratio": "5/4/4",
		"length": "57 min 23 sec"
	};

	// Locale-based option descriptions
	const option_descriptions = {
		"en": {
			"showDiscCountIfSingle": "Display number of discs and disc ratio if there is only one disc",
			"showTrackCountIfSingle": "Display number of tracks if there is only one track"
		}
	};

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
		console.log("Modifying Metadata...")

		let metadata = document.querySelector(".main-entityHeader-metaData");
		metadata.style.flexDirection = "column";
		metadata.style.alignItems = "start";

		let metadata_promise = new Promise(async function(resolve) {
			let details = await CosmosAsync.get("https://api.spotify.com/v1" 
				+ Platform.History.location.pathname.replace("album", "albums").replace("track", "tracks")
			);
			
			let tracks = [];
			let extra_details = [];
			let disc_count = {}

			/*if (details.tracks.next !== null) {
				extra_details = await GetAllTracks(details.tracks.next);
			}*/

			tracks = tracks.concat(details.tracks.items, extra_details);
	
			// Count how many tracks there are per disc (Why does the API not just have this already???)
			tracks.forEach(track => disc_count[track.disc_number] = (disc_count[track.disc_number] || 0) + 1);

			resolve({
				// Convert YYYY-MM-DD -> Unix -> Long Date
				release_date: new Intl.DateTimeFormat("default", {dateStyle: "full"}).format(Date.parse(details.release_date)),
				// Return # of tracks
				tracks: details.tracks.total > 1 || config["bools"]["showTrackCountIfSingle"] ? 
					(details.tracks.total.toString() + (details.tracks.total === 1 ? " track" : " tracks")) : "",
				// Return # of disc(s) & the ratio of track to disc
				// or just "1 disc" if only one disc
				discs: (Object.keys(disc_count).length > 1 || config["bools"]["showDiscCountIfSingle"]) ? 
					Object.keys(disc_count).length.toString() + (Object.keys(disc_count).length === 1 ? " disc" : " discs") : "",
				disc_ratio: (Object.keys(disc_count).length > 1 || config["bools"]["showDiscCountIfSingle"]) ? 
					Object.values(disc_count).toString().replace(/,/g, "/") : "",
				length: metadata.lastChild.innerText.split(", ")[1] ?? "Unavailable"
			})
		});

		// Get the result of our promise BEFORE accessing it...
		var new_metadata = await metadata_promise;

		for (var i = 0; i < 3; i++){
			let nestedHeader = MakeNewHeader(metadata);
			let customization = new Customization(config["filters"][i], new_metadata);

			// Create elements for the details
			let icon = CreateSVG(SVGIcons[config["icons"][i]], "24", "24");
			nestedHeader.appendChild(icon);
			let newElement = nestedHeader.appendChild(document.createElement("span"));

			// Add details to the new header
			newElement.className = "main-type-mesto";
			newElement.innerText = customization.ParseCustomization();
		}

		// Hide default metadata
		let multiArtist = metadata.childElementCount > 3;
		
		for (var i = multiArtist ? 2 : 1; i < metadata.childElementCount - 3; i++) {
			metadata.childNodes[i].style.display = "none";
		}

		if (multiArtist) {
			metadata.childNodes[1].style.display = "none";
		}
	}

	// Called if an album has more than 50 tracks
	async function GetAllTracks(album) {
		let details = await CosmosAsync.get(album);
		let store = details.items;

		// Recursive call for albums > 100 tracks
		if (details.next !== null) {
			store = store.concat(await GetAllTracks(details.next));
		}

		// Return array of tracks
		return store;
	}

	// Check if the extension has a previously saved config
	// If not, create a default config
	function CheckStorage(){
		if(LocalStorage.get(STORAGE_TOKEN) !== null) {
			config = JSON.parse(LocalStorage.get(STORAGE_TOKEN));

			if (Object.keys(config["bools"]).length < Object.keys(GetDefaultConfig()["bools"]).length) {
				Object.keys(GetDefaultConfig()["bools"]).forEach(key => config["bools"][key] = config["bools"][key] || 
					GetDefaultConfig()["bools"][key]);
				LocalStorage.set(STORAGE_TOKEN, JSON.stringify(config));
				Spicetify.showNotification("Metadata Customizer: Added new options to config!")
			}
		} else {
			ResetStorageToDefault(true);
		}
	}

	// Set local storage back to the default config.
	// 'startup' var changes the notification message printed
	function ResetStorageToDefault(startup = false) {
		LocalStorage.set(STORAGE_TOKEN, JSON.stringify(GetDefaultConfig()))
		config = JSON.parse(LocalStorage.get(STORAGE_TOKEN));
		Spicetify.showNotification(startup ? "Metadata Customizer: Created new config!" : "Metadata Customizer: Restored default config!");
	}

	// Return a copy of the default config
	function GetDefaultConfig() {
		const default_filters = ["$release_date$", "$tracks$, $discs$ [$disc_ratio$]", "$length$"];
		const default_icons = ["enhance", "album", "clock"];
		const default_bools = {"showDiscCountIfSingle": false, "showTrackCountIfSingle": true}

		return {"filters": default_filters, "icons": default_icons, "bools": default_bools}
	}

	function SaveToStorage(){
		// Save filters to local storage
		for (let i = 0; i < 3; i++){
			// @ts-ignore
			config["filters"][i] = document.getElementById(`metadata-config-filter-${i === 0 ? "one" : i === 1 ? "two" : "three"}`).value;
			// @ts-ignore
			config["icons"][i] = document.getElementById(`metadata-config-icon-${i === 0 ? "one" : i === 1 ? "two" : "three"}`).value;
		}

		// Options currently change the value in the config object directly
		// Therefore they do not need to be accessed here to be saved

		LocalStorage.set(STORAGE_TOKEN, JSON.stringify(config));
		Spicetify.showNotification("Config Saved!")
	}

	// Check if the current page is an album
	function CheckPage() {
		if (Platform.History.location.pathname.startsWith("/album/")) {
			ModifyMetadata();
		}
	}

	/**
	 * Create an SVG element with all the attributes already set
	 * @param {string} svg SVG path element
	 * @param {string} width Width of icon
	 * @param {string} height Height of icon
	 * @param {number} vb_w 
	 * @param {number} vb_h 
	 * @returns SVG document element
	 */
	function CreateSVG(svg, width, height, vb_w = 16, vb_h = 16) {
		var elem = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		elem.setAttribute("role", "img");
		elem.setAttribute("width", width);
		elem.setAttribute("height", height);
		elem.setAttribute("fill", "currentColor");
		elem.setAttribute("viewBox", `0 0 ${vb_w} ${vb_h}`);
		elem.innerHTML = svg;

		return elem;
	}


	/** 
	 * @param {string} title Title of popup.
	 * @param {string} description Descriptive text.
	 * @param {{labels: string[], callbacks: Array}} buttons Object containing the button label and function for the button to perform on click.
	 * */
	function CreatePopup(title, description, buttons) {
		let container = document.createElement("div");

		let desc = document.createElement("p");
		desc.innerText = description;
		desc.style.textAlign = "center";
		desc.style.paddingBottom = "20px";

		let button_container = document.createElement("div");
		button_container.className = "metadata-config-flex";

		for (let i = 0; i < buttons["labels"].length; i++){
			let btn = document.createElement("button");
			btn.innerText = buttons["labels"][i];
			btn.className = "main-buttons-button"
			btn.classList.add(i === 0 ? "main-button-primary" : "main-button-secondary");

			btn.onclick = (event) => {
				event.stopPropagation();
				buttons["callbacks"][i]();
				if (i === 0){
					document.getElementById("metadata-customization-overlay").remove();
				}
				document.getElementsByTagName("generic-modal")[0].remove();
			};

			button_container.append(btn);
		}

		container.append(desc, button_container);


		Spicetify.PopupModal.display({title: title, content: container, isLarge: false});
	}

	// Create a new metadata header
	function MakeNewHeader(parent){
		// Create new header element
		var newHeader = parent.appendChild(document.createElement("div"));
		newHeader.className = "main-entityHeader-metaData";

		// The header has a nested div that gives nice spacing
		var nestedHeader = newHeader.appendChild(document.createElement("div"));
		nestedHeader.className = "main-entityHeader-creatorWrapper";
	
		return nestedHeader;
	}

	// Customization Configuration Menu \\
	function CreateConfigMenu(){
		const background = document.createElement("div");
		background.id = "metadata-customization-overlay"
		background.className = "context-menu-container";
		background.style.zIndex = "99";

		const style = document.createElement("style")
		style.textContent = `
#metadata-customization-overlay {
	position: absolute;
	left: 0;
	right: 0;
	width: 100vw;
	height: 100vw;
}

#metadata-customization-config {
	display: inline-block;
	width: 55%;
	min-width: 475px;
	max-height: 35%;
	overflow: hidden auto;
	padding-bottom: 10px;
	position: absolute;
}

#metadata-config-navigation {
	display: flex;
	justify-content: space-around;
	padding-top: 10px;
}

#metadata-config-boolean-container, #metadata-config-filter-container {
	padding: 8px;
}

#metadata-config-footer {
	display: flex;
	flex-direction: column;
	flex-wrap: nowrap;
	align-items: center;
	align-content: center;
	justify-content: center;
}

.metadata-config-icon-input {
	margin-left: 8px;
	border-radius: 4px;
	padding: 0 8px 0 12px;
	height: 32px;
	align-items: center;
	background: transparent;
	border: 0;
	color: var(--spice-text);
}

.metadata-config-icon-input option {
	background: var(--spice-card);
}

.metadata-config-filter-input {
	color: var(--spice-text);
	background: transparent;
	margin-left: 8px;
	padding: 0 8px 0 12px;
}

.metadata-config-flex {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
}

.metadata-config-flex-label {
	flex-grow: 1;
	width: 175px;
}

.metadata-config-flex-input {
	flex-grow: 3;
}

.metadata-config-option-label {
	flex-grow: 3;
	width: 150px;
}

.metadata-config-option-input {
	flex-grow: 1;
	padding-left: 75px;
}

.metadata-config-option-button {
	align-items: center;
	border: 0;
	cursor: pointer;
	color: var(--spice-button);
	background-color: rbga(var(--spice-rgb-shadow), .7);
	display: flex;
	margin-inline-start: 12px;
	padding: 8px;
}

.metadata-config-option-button.disabled {
	color: rbga(var(--spice-rgb-text), .3);
}
`;
		const children = document.createElement("ul");
		children.id = "metadata-customization-config";
		children.className = "main-contextMenu-menu";
		children.onclick = (event) => event.stopPropagation();

		background.append(style, children);
		return {background, children};
	}

	function CreateConfigOptions(parent){
		let font_color = "var(--spice-text)";

		let navigation = document.createElement("li");
		navigation.id = "metadata-config-navigation"

		// Navigation Buttons
		const navigation_headers = ["filters", "options"]
		for (let i = 0; i < navigation_headers.length; i++){
			let nav_btn = document.createElement("button")
			nav_btn.id = `metadata-config-navigation-${navigation_headers[i]}`
			nav_btn.className = i === 0 ? "main-buttons-button main-button-primary" : "main-buttons-button main-button-secondary";
			nav_btn.innerText = navigation_headers[i][0].toUpperCase() + navigation_headers[i].substring(1);

			nav_btn.onclick = (event) => {
				SwitchPage(navigation_headers[i]);
				event.stopPropagation();
			};

			navigation.append(nav_btn);
		}

		// let valid_tokens = document.createElement("p");
		// valid_tokens.innerText = `Valid Tokens:	${"$" + data_types.toString().replace(/,/g, "$, $") + "$"}`;
		// valid_tokens.style.color = font_color;

		let filter_container = document.createElement("li");
		// filter_container.append(valid_tokens);
		filter_container.id = "metadata-config-filter-container";

		let boolean_container = document.createElement("li");
		boolean_container.style.display = "none";
		boolean_container.id = "metadata-config-boolean-container";

		// Boolean Options
		for (let i = 0; i < Object.keys(config["bools"]).length; i++){
			let option_container = document.createElement("div");
			option_container.className = "metadata-config-flex";

			let attribute = Object.keys(config["bools"])[i];

			let checkbox_container_input = document.createElement("div")
			checkbox_container_input.className = "metadata-config-option-input";

			let checkbox_label = document.createElement("label");
			checkbox_label.className = "metadata-config-option-label";
			// Get translated description string. If null, fallback to English
			// @ts-ignore
			checkbox_label.innerText = option_descriptions[(Spicetify.Locale.getLocale() in option_descriptions) ? Spicetify.Locale._locale : "en"][attribute];
			checkbox_label.style.color = font_color;

			let checkbox_input = document.createElement("button");
			checkbox_input.className = "metadata-config-option-button";
			if (!config["bools"][attribute]) checkbox_input.classList.add("disabled");
			
			// On Button clicked, invert bool and add/remove 'disabled' class
			checkbox_input.onclick = (event) => {
				config["bools"][attribute] = !config["bools"][attribute];
				if (config["bools"][attribute] === true) {
					checkbox_input.classList.remove("disabled");
				} else {
					checkbox_input.classList.add("disabled")
				}

				event.stopPropagation();
			}

			let checkbox_input_icon = CreateSVG(SVGIcons["check"], "24", "24", 24, 24);

			checkbox_input.append(checkbox_input_icon);
			checkbox_container_input.append(checkbox_label, checkbox_input);
			option_container.append(checkbox_label, checkbox_container_input);
			boolean_container.append(option_container);
		}

		// Filter Lines
		for (let i = 0; i < 3; i++) {
			let label = i === 0 ? "one" : i === 1 ? "two" : "three";

			let metadata_icon_line = document.createElement("div");
			let metadata_filter_line = document.createElement("div");

			metadata_icon_line.className = "metadata-config-flex";
			metadata_filter_line.className = "metadata-config-flex";

			let icon_label = document.createElement("label");
			let icon_input = document.createElement("select");

			icon_label.setAttribute("for", "metadata-config-icon-" + label);
			icon_label.className = "metadata-config-flex-label";
			icon_label.innerText = "Icon: ";
			icon_label.style.color = font_color;

			icon_input.className = "metadata-config-flex-input metadata-config-icon-input"
			icon_input.onclick = (event) => event.stopPropagation();
			icon_input.id = "metadata-config-icon-" + label;
			icon_input.onchange = () => {
				document.getElementById(`metadata-config-preview-icon-${label}`)
					.innerHTML = SVGIcons[icon_input.value];
			};

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
			filter_label.className = "metadata-config-flex-label";
			filter_label.style.color = font_color;

			filter_input.type = "text";
			filter_input.name = "metadata-config-filter-" + label;
			filter_input.id = "metadata-config-filter-" + label;
			filter_input.className = "metadata-config-flex-input metadata-config-filter-input";
			filter_input.value = config["filters"][i];
			filter_input.oninput = () => {
				let customization = new Customization(filter_input.value, sample_data)
				document.getElementById(`metadata-config-preview-filter-${label}`)
					.innerText = customization.ParseCustomization();
			}

			metadata_icon_line.append(icon_label, icon_input)
			metadata_filter_line.append(filter_label, filter_input);
			filter_container.append(metadata_icon_line, metadata_filter_line);
		}

		let button_container = document.createElement("li");
		button_container.style.width = "-webkit-fill-available";
		button_container.style.display = "flex";
		button_container.style.flexDirection = "row";
		button_container.style.justifyContent = "space-evenly";

		let apply_button = document.createElement("button");
		apply_button.innerText = "Apply Config";
		apply_button.className = "main-buttons-button main-button-primary"
		// @ts-ignore
		apply_button.onclick = (event) => {
			SaveToStorage();
			document.getElementById("metadata-customization-overlay").remove();
		}

		let reset_button = document.createElement("button");
		reset_button.innerText = "Restore Defaults";
		reset_button.className = "main-buttons-button main-button-secondary";
		reset_button.onclick = () => {
			CreatePopup("Warning!", "This will completely reset your configurations!\n Are you sure you want to continue?", 
				{labels: ["Restore Config", "Cancel"], callbacks: [ResetStorageToDefault, () => {}]});
		}

		let footer = document.createElement("li");
		footer.id = "metadata-config-footer"

		let preview = document.createElement("div");
		preview.style.color = "var(--spice-text)";
		
		// Filter Preview
		for (let i = 0; i < 3; i++){
			let label = i === 0 ? "one" : i === 1 ? "two" : "three";
			let filter_preview = document.createElement("div");
			filter_preview.className = "main-entityHeader-creatorWrapper";
			filter_preview.style.paddingBottom = "8px";

			let preview_icon = CreateSVG(SVGIcons[config["icons"][i]], "24", "24");
			preview_icon.id = `metadata-config-preview-icon-${label}`;

			let preview_text = document.createElement("span");
			preview_text.id = `metadata-config-preview-filter-${label}`;
			preview_text.className = "main-type-mesto";
			preview_text.innerText = new Customization(config["filters"][i], sample_data).ParseCustomization();

			filter_preview.append(preview_icon, preview_text);
			preview.append(filter_preview);
		}

		button_container.append(apply_button, reset_button);
		footer.append(preview, button_container)
		parent.append(navigation, filter_container, boolean_container, footer);
	}

	function SwitchPage(element){
		document.getElementById(element === "filters" ? "metadata-config-filter-container" : "metadata-config-boolean-container").style.display = "block";
		document.getElementById(element === "filters" ? "metadata-config-boolean-container" : "metadata-config-filter-container").style.display = "none";
		document.getElementById(element === "filters" ? "metadata-config-navigation-filters" : "metadata-config-navigation-options").classList
			.replace("main-button-secondary", "main-button-primary");
		document.getElementById(element === "filters" ? "metadata-config-navigation-options" : "metadata-config-navigation-filters").classList
			.replace("main-button-primary", "main-button-secondary");
	}

	class Customization{
		/**
		 * Constructor for the Customization Class
		 * @param {string} input The string to check for tokens in
		 * @param {{}} data The data to match the tokens to
		 */
		constructor(input, data){
			this.tokens = data_types;
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
					this.data[found[t]] !== "" ? "$<Opening>" + this.data[found[t]] + "$<Closing>" : "");
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