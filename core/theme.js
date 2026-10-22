{
  const params = new URLSearchParams(location.search);
  const name = params.get("theme");
  const pet = params.get("pet");
  if (/^[\w-]+$/.test(pet || "")) document.documentElement.dataset.pet = pet;
  const link = document.getElementById("theme");
  if (link && /^[\w-]+$/.test(name || "")) link.href = link.getAttribute("href").replace(/templates\/[\w-]+\//, `templates/${name}/`);
}
