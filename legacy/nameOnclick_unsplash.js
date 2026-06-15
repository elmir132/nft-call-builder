	document.addEventListener("DOMContentLoaded", function() {
		var imgElement = document.getElementById("img");
		imgElement.src = "https://source.unsplash.com/user/wsanter";
		imgElement.onerror = function() {
			this.onerror = null;
			this.src = "https://source.unsplash.com/user/wsanter";
			this.style.width = "600px";
			this.style.height = "300px";
		};


		
	});







// 	   document.addEventListener("DOMContentLoaded", function() {
//       // Get the value of the name parameter from the URL
//       const urlParams = new URLSearchParams(window.location.search);
//       const nameParam = urlParams.get('name');
//       const tagParam = urlParams.get('tag'); // New parameter for collection tag

//       // Autofill the input fields with the parameters' values
//       const nameInput = document.getElementById('name');
//       const collectionTagInput = document.getElementById('collectionTag');

//       nameInput.value = nameParam;
//       collectionTagInput.value = tagParam; // Autofill collection tag input

    

//     // Set collection tag as page title
//     document.title = `${tagParam} - Collection Details`;
//     fetchCollectionData(tagParam);
  
// });

