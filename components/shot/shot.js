function viewer() {
  let dialog = document.getElementById("image-viewer");
  if (!dialog) {
    document.body.insertAdjacentHTML("beforeend", `<dialog id="image-viewer" class="overlay image-viewer" aria-labelledby="image-viewer-title"><div class="dialog-head"><h2 id="image-viewer-title">Screenshot</h2><button type="button" class="btn" data-close>Close · Esc</button></div><img alt=""><p></p></dialog>`);
    dialog = document.getElementById("image-viewer");
  }
  return dialog;
}

Deck.use({
  name: "shot",
  init(slide, deck) {
    slide.querySelectorAll(".shot img").forEach(img => {
      if (img.parentElement.classList.contains("image-zoom")) return;
      const figure = img.closest(".shot");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "image-zoom";
      button.setAttribute("aria-label", "Enlarge: " + img.alt);
      img.before(button);
      button.append(img);
      button.addEventListener("click", () => {
        const dialog = viewer();
        const large = dialog.querySelector("img");
        large.src = img.currentSrc || img.src;
        large.alt = img.alt;
        dialog.querySelector("p").textContent = figure.querySelector("figcaption")?.textContent || img.alt;
        deck.openDialog(dialog, button);
      });
    });
  }
});
