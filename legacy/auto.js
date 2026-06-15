// Tags to names
const collectionsMap = {};
const apiUrl = 'https://api-mainnet.magiceden.io/v2/collections/';
const Url = 'https://magiceden.io/marketplace/';
const limit = 500;
let offset = 0;
let collections = [];
const input = document.getElementById('name');
const resultFp = document.getElementById('result-fp');
const resultLinks = document.getElementById('result-links');
const resultListed = document.getElementById('result-listed');
const resultDescription = document.getElementById('result-description');

const fpInput = document.getElementById('fp');
const listedInput = document.getElementById('listed');
const linksInput = document.getElementById('links');
const descriptionInput = document.getElementById('description');

let timeoutId; // Debounce timeout ID

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function fetchCollections() {
  fetch(`${apiUrl}?offset=${offset}&limit=${limit}`)
    .then(response => response.json())
    .then(data => {
      collections = collections.concat(data);
      offset += limit;
      if (data.length === limit) {
        fetchCollections();
      } else {
        collections.forEach(collection => {
          const tagName = collection.name.trim().toLowerCase();
          const tagSymbol = collection.symbol;
          const listedCount = collection.listedCount;
          collectionsMap[tagName] = {
            symbol: tagSymbol,
            listedCount: listedCount
          };
        });

        console.log(collectionsMap);
      }





          /*<------ AUTO COMPLETE ----> */
  /*<------ AUTO COMPLETE ----> */
          /*<------ AUTO COMPLETE ----> */

      const autocompleteList = document.getElementById('autocomplete-list');
      let selectedElementIndex = -1;
      const suggestions = [];

      function updateSuggestions() {
        const inputText = input.value.toLowerCase();
        suggestions.length = 0;

        Object.keys(collectionsMap).forEach(tagName => {
          if (tagName.includes(inputText)) {
            suggestions.push(tagName);
          }
        });

        renderSuggestions();
      }

      function renderSuggestions() {
        autocompleteList.innerHTML = '';

        suggestions.forEach((tagName, index) => {
          const listItem = document.createElement('li');
          listItem.textContent = capitalizeFirstLetter(tagName);
          listItem.addEventListener('mouseover', () => {
            selectedElementIndex = index;
            updateSelectedElement();
          });
          listItem.addEventListener('click', () => {
            input.value = tagName;
            autocompleteList.style.display = 'none';
            fetchCollectionData(tagName);
            render(tagName); // Add this line to trigger rendering
          });

          autocompleteList.appendChild(listItem);
        });

        updateSelectedElement();
        autocompleteList.style.display = suggestions.length ? 'block' : 'none';
      }

      function updateSelectedElement() {
        const listItems = autocompleteList.querySelectorAll('li');
        listItems.forEach((item, index) => {
          item.classList.toggle('selected', index === selectedElementIndex);
        });

        scrollSelectedItemIntoView();
      }

      function scrollSelectedItemIntoView() {
        const selectedItem = autocompleteList.querySelector('li.selected');
        if (selectedItem) {
          selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      input.addEventListener('input', function () {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const selectedTagName = input.value.trim();
          if (selectedTagName !== '') {
            fetchCollectionData(selectedTagName);
            updateSuggestions();
          } else {
            clearResults();
            updateSuggestions();
          }
        }, 200); // Debounce delay
      });

      input.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedElementIndex = Math.max(selectedElementIndex - 1, 0);
          updateSelectedElement();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedElementIndex = Math.min(selectedElementIndex + 1, suggestions.length - 1);
          updateSelectedElement();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedElementIndex !== -1) {
            const selectedTagName = suggestions[selectedElementIndex];
            input.value = selectedTagName;
            autocompleteList.style.display = 'none';
            fetchCollectionData(selectedTagName);
            render(selectedTagName); // Add this line to trigger rendering
          }
        }
      });

      input.addEventListener('blur', function () {
        setTimeout(() => {
          autocompleteList.style.display = 'none';
        }, 200);
      });

      // Extract name parameter from URL on page load
      const urlParams = new URLSearchParams(window.location.search);
      const nameParam = urlParams.get('name');
      if (nameParam) {
        const decodedName = decodeURIComponent(nameParam);
        input.value = decodedName;
        setTimeout(() => {
          fetchCollectionData(decodedName);
          render(decodedName); // Add this line to trigger rendering
        }, 7000); // Delayed fetching after 10 seconds
      }
    })
    .catch(error => console.error(error));
}


/*<------ AUTO COMPLETE ----> */
/*<------ AUTO COMPLETE ----> */
/*<------ AUTO COMPLETE ----> */



function fetchCollectionData(collectionIdentifier) {
  const collectionData = collectionsMap[collectionIdentifier];
  const iframe = document.getElementById('myIframe');
  let collectionTag;



  if (collectionData) {
    collectionTag = collectionData.symbol;
  } else {
    collectionTag = collectionIdentifier;
  }

  const apiUrlWithCollectionTag = `${apiUrl}${collectionTag}`;
  const UrlWithCollectionTag = `${Url}${collectionTag}`;

  fetch(apiUrlWithCollectionTag)
    .then(response => response.json())
    .then(data => {
      const floorPrice = data.floorPrice;
      const formattedFloorPrice = (floorPrice / 1000000000).toFixed(1);
      const listedCount = data.listedCount;
      const image = data.image;
      const description = data.description;
      resultFp.textContent = formattedFloorPrice;
      resultLinks.textContent = UrlWithCollectionTag;
      resultListed.textContent = listedCount;
      resultDescription.textContent = description;
      fpInput.value = formattedFloorPrice;
      listedInput.value = listedCount;
      linksInput.value = UrlWithCollectionTag;
      descriptionInput.value = description;

      iframe.src = UrlWithCollectionTag + "?activeTab=stats&checkoutTab=undefined";

      img.onload = function() {
        this.style.width = '200px'; // Set the width of the image to 200px
        this.style.height = '200px'; // Set the width of the image to 200px
        this.style.transform = 'translate(10px, 0px)'; // Set the transform property
      };

      img.src = image;
    })
    .catch(error => {
      console.error(error);
      clearResults();
    });
}

function clearResults() {
  resultFp.textContent = '';
  resultListed.textContent = '';
  resultLinks.textContent = '';
  resultDescription.textContent = '';
  fpInput.value = '';
  listedInput.value = '';
  linksInput.value = '';
  descriptionInput.value = '';
  img.src = '';
}

fetchCollections();





