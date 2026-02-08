import { bootstrapGallery } from "./gallery.js";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => bootstrapGallery());
} else {
  bootstrapGallery();
}
