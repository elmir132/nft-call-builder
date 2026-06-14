      
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function copyFormInputs() {
    const nameInput = document.getElementById('name');
    const fp = document.getElementById('result-fp').textContent;
    const listedInput = document.getElementById('listed');
    const epInput = document.getElementById('ep');
    const risksInput = document.getElementById('risks');
    const descriptionInput = document.getElementById('description');
    const chartsInput = document.getElementById('charts');
    const linksInput = document.getElementById('links');

    const resultName = document.getElementById('result-name');
    const resultListed = document.getElementById('result-listed');
    const resultEp = document.getElementById('result-ep');
    const resultRisks = document.getElementById('result-risks');
    const resultDescription = document.getElementById('result-description');
    const resultCharts = document.getElementById('result-charts');
    const resultLinks = document.getElementById('result-links');

    resultName.textContent = capitalizeFirstLetter(nameInput.value);
    resultListed.textContent = listedInput.value;
    resultEp.textContent = epInput.value;
    resultRisks.textContent = risksInput.value;
    resultDescription.textContent = descriptionInput.value;
    resultCharts.textContent = chartsInput.value;
    resultLinks.textContent = linksInput.value;
    resultDescription.textContent = descriptionInput.value;

    const checkbox = document.querySelectorAll('input[type="checkbox"]:checked');
    const rsi = Array.from(checkbox).map((checkbox) => checkbox.value).join(', ');

    const rocketEmoji = document.querySelector('#rocket-emoji');
    const recycleEmoji = document.querySelector('#recycle-emoji');
    const emoji = rocketEmoji.classList.contains('selected') ? 'Rocket 🚀' : 'Re-invest ♻️';
    const emoji1 = rocketEmoji.classList.contains('selected') ? '🚀' : '♻️';





    const textToCopy =
    `
__From the ${emoji} chapter:__

**${emoji1} ${capitalizeFirstLetter(nameInput.value)}**

**Fp: ${fp}**
**Listed: ${listedInput.value}**
**EP: ${epInput.value}**

**📍Risks:** ${risksInput.value}

**🗞Project Description:** ${descriptionInput.value}

**📈Charts:** ${chartsInput.value} ${rsi}

*As always DYOR, touch the grass and feel progressed * #calls

**🔗Link:** ${linksInput.value}
    `;
    navigator.clipboard.writeText(textToCopy);
}




function copyFormInputs2() {
    const nameInput = document.getElementById('name');
    const fp = document.getElementById('result-fp').textContent;
    const listedInput = document.getElementById('listed');
    const epInput = document.getElementById('ep');
    const risksInput = document.getElementById('risks');
    const descriptionInput = document.getElementById('description');
    const chartsInput = document.getElementById('charts');
    const linksInput = document.getElementById('links');

    const resultName = document.getElementById('result-name');
    const resultListed = document.getElementById('result-listed');
    const resultEp = document.getElementById('result-ep');
    const resultRisks = document.getElementById('result-risks');
    const resultDescription = document.getElementById('result-description');
    const resultCharts = document.getElementById('result-charts');
    const resultLinks = document.getElementById('result-links');

    resultName.textContent = capitalizeFirstLetter(nameInput.value);
    resultListed.textContent = listedInput.value;
    resultEp.textContent = epInput.value;
    resultRisks.textContent = risksInput.value;
    resultDescription.textContent = descriptionInput.value;
    resultCharts.textContent = chartsInput.value;
    resultLinks.textContent = linksInput.value;
    resultDescription.textContent = descriptionInput.value;

    const checkbox = document.querySelectorAll('input[type="checkbox"]:checked');
    const rsi = Array.from(checkbox).map((checkbox) => checkbox.value).join(', ');

    const rocketEmoji = document.querySelector('#rocket-emoji');
    const recycleEmoji = document.querySelector('#recycle-emoji');
    const emoji = rocketEmoji.classList.contains('selected') ? 'Rocket 🚀' : 'Re-invest ♻️';
    const emoji1 = rocketEmoji.classList.contains('selected') ? '🚀' : '♻️';



    const textToCopy =
    `
__From the ${emoji} chapter:__

**${emoji1} ${capitalizeFirstLetter(nameInput.value)}**

**Fp: ${fp}**
**Listed: ${listedInput.value}**
**EP: ${epInput.value}**

**📍Risks:** ${risksInput.value}

**🗞Project Description:** ${descriptionInput.value}

**📈Charts:** ${chartsInput.value} ${rsi}

*As always DYOR, touch the grass and feel progressed * #calls

**🔗Link:** ${linksInput.value}

    `;
    navigator.clipboard.writeText(textToCopy);
}





const toggleSection = document.querySelector('.toggle-section');
const checkboxSection = document.querySelector('.checkbox-section');
const toggleArrowUp = document.querySelector('.arrow-up');
const toggleArrowDown = document.querySelector('.arrow-down');

toggleSection.addEventListener('click', function() {
    checkboxSection.classList.toggle('open');
    toggleArrowUp.classList.toggle('rotate');
    toggleArrowDown.classList.toggle('rotate');
});

function debounce(func, delay) {
    let timeoutId;

    return function () {
      const context = this;
      const args = arguments;

      clearTimeout(timeoutId);
      timeoutId = setTimeout(function () {
        func.apply(context, args);
    }, delay);
  };
}

