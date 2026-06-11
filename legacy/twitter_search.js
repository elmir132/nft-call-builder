document.addEventListener("DOMContentLoaded", function() {
	var nameInput = document.getElementById("name");
	var autocompleteList = document.getElementById("autocomplete-list");
	var projectDescriptionLink = document.getElementById("project-description-link");
	var selectedValue = "";

	nameInput.addEventListener("input", function() {
		selectedValue = "";
		var collectionName = nameInput.value.trim();
		var twitterUrl = "https://twitter.com/search?q=" + encodeURIComponent(collectionName) + "&src=typed_query&f=top";
		projectDescriptionLink.href = twitterUrl;
	});

	autocompleteList.addEventListener("click", function(event) {
		if (event.target.tagName === "LI") {
			selectedValue = event.target.innerText;
			nameInput.value = selectedValue;
			var twitterUrl = "https://twitter.com/search?q=" + encodeURIComponent(selectedValue) + "&src=typed_query&f=top";
			projectDescriptionLink.href = twitterUrl;
		}
	});
});