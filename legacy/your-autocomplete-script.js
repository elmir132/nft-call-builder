function fetchCollections() {
      const apiUrl = 'https://api-mainnet.magiceden.io/v2/collections';
     

      fetch(`${apiUrl}?offset=${offset}&limit=${limit}`)
        .then(response => response.json())
        .then(data => {
          const collections = data;
          const collectionsMap = {};

          collections.forEach(collection => {
            const tagName = collection.name.trim().toLowerCase();
            const tagSymbol = collection.symbol;
            const listedCount = collection.listedCount;
            collectionsMap[tagName] = {
              symbol: tagSymbol,
              listedCount: listedCount
            };
          });

          const input = document.getElementById('name');
          const autocompleteList = document.getElementById('autocomplete-list');
          let selectedElementIndex = -1;
          const suggestions = [];

          input.addEventListener('input', function() {
            const inputText = this.value.toLowerCase();
            suggestions.length = 0;

            Object.keys(collectionsMap).forEach(tagName => {
              if (tagName.includes(inputText)) {
                suggestions.push(tagName);
              }
            });

            renderSuggestions();
          });

          function renderSuggestions() {
            autocompleteList.innerHTML = '';

            suggestions.forEach((tagName, index) => {
              const listItem = document.createElement('li');
              listItem.textContent = tagName;
              listItem.addEventListener('mouseover', () => {
                selectedElementIndex = index;
                updateSelectedElement();
              });
              listItem.addEventListener('click', () => {
                input.value = tagName;
                autocompleteList.style.display = 'none';
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
              }
            }
          });

          input.addEventListener('blur', function() {
            setTimeout(() => {
              autocompleteList.style.display = 'none';
            }, 200);
          });
        })
        .catch(error => console.error(error));
    }

    fetchCollections();