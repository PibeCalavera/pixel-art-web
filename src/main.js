import { createApp } from "./app/app.js";
import { createControls } from "./ui/controls.js";
import { createPreview } from "./ui/preview.js";
import { createExporter } from "./ui/export.js";
import { getPaletteDefinitions } from "./processing/palette.js";
import { ImageDataBuffer } from "./processing/image.js";

const openImageButton = document.querySelector("#open-image-button");
const imageInput = document.querySelector("#image-input");
const processButton = document.querySelector("#process-button");
const saveButton = document.querySelector("#save-button");
const discardButton = document.querySelector("#discard-button");
const statusElement = document.querySelector("#status");
const imageSizeElement = document.querySelector("#image-size");
const previewCanvas = document.querySelector("#preview-canvas");
const emptyPreview = document.querySelector("#empty-preview");
const ditherStrengthValue = document.querySelector("#dither-strength-value");

validateRequiredElement(openImageButton, "#open-image-button");
validateRequiredElement(imageInput, "#image-input");
validateRequiredElement(processButton, "#process-button");
validateRequiredElement(saveButton, "#save-button");
validateRequiredElement(discardButton, "#discard-button");
validateRequiredElement(statusElement, "#status");
validateRequiredElement(imageSizeElement, "#image-size");
validateRequiredElement(previewCanvas, "#preview-canvas");
validateRequiredElement(emptyPreview, "#empty-preview");

const controls = createControls(document.body, {
  palettes: getPaletteDefinitions(),
});

const preview = createPreview(previewCanvas);

const exporter = createExporter(previewCanvas, { filename: "pixel-art.png" });

const app = createApp();

let realtimeTimer = null;
let lastProcessedImage = null;

openImageButton.addEventListener("click", handleOpenImage);
imageInput.addEventListener("change", handleImageSelection);
processButton.addEventListener("click", handleProcess);
saveButton.addEventListener("click", handleSave);
discardButton.addEventListener("click", handleDiscard);

controls.onChange(handleControlsChange);

app.subscribe(renderState);

renderState(app.getState());
updateDitherStrengthLabel();

function createProcessingOptions() {
  const options = controls.getOptions();

  const paletteId = options.dither.palette ?? options.quantize.palette ?? null;

  if (!paletteId) {
    throw new Error("No palette selected.");
  }

  return {
    resize: {
      algorithm: options.resize.algorithm,
      width: options.resize.width,
      height: options.resize.height,
    },

    quantize: { algorithm: options.quantize.algorithm, palette: paletteId },

    dither: {
      algorithm: options.dither.algorithm,
      strength: options.dither.strength,
      matrixSize: options.dither.matrixSize,
      palette: paletteId,
    },
  };
}

function handleOpenImage() {
  imageInput.click();
}

function handleControlsChange() {
  try {
    const options = createProcessingOptions();

    app.updateProcessingOptions(options);
    updateDitherStrengthLabel();

    if (controls.getRealtimePreview() && app.getState().image.original) {
      scheduleRealtimeProcessing();
    }
  } catch (error) {
    console.error("[Pixel Art] Invalid controls:", error);

    setStatus(error?.message ?? "Invalid settings.", true);
  }
}

async function handleImageSelection(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  setStatus(`Loading ${file.name}...`);

  try {
    const image = await loadImageFile(file);

    app.setOriginalImage(image);

    lastProcessedImage = null;

    preview.render(image);

    imageSizeElement.textContent = `${image.width} × ${image.height}`;

    emptyPreview.hidden = true;
    previewCanvas.hidden = false;

    setStatus(`Loaded ${file.name}.`);

    if (controls.getRealtimePreview()) {
      scheduleRealtimeProcessing();
    }
  } catch (error) {
    console.error("[Pixel Art] Unable to load image:", error);

    setStatus(error?.message ?? "Unable to load image.", true);
  } finally {
    imageInput.value = "";
  }
}

function handleProcess() {
  const original = app.getState().image.original;

  if (!original) {
    setStatus("Open an image before processing.", true);

    return;
  }

  try {
    const options = createProcessingOptions();

    app.process(options);
  } catch (error) {
    console.error("[Pixel Art] Unable to process image:", error);

    setStatus(error?.message ?? "Unable to process image.", true);
  }
}

async function handleSave() {
  if (!lastProcessedImage) {
    return;
  }

  try {
    await exporter.save(lastProcessedImage);

    setStatus("Image saved.");
  } catch (error) {
    console.error("[Pixel Art] Unable to save image:", error);

    setStatus(error?.message ?? "Unable to save image.", true);
  }
}

function handleDiscard() {
  lastProcessedImage = null;

  exporter.discard();

  setStatus("Result discarded.");

  renderState(app.getState());
}

function scheduleRealtimeProcessing() {
  if (realtimeTimer !== null) {
    clearTimeout(realtimeTimer);
  }

  realtimeTimer = setTimeout(() => {
    realtimeTimer = null;

    handleProcess();
  }, 120);
}

function renderState(state) {
  const original = state.image.original;
  const result = state.image.result;

  processButton.disabled =
    !original || state.processing.status === "processing";

  saveButton.disabled = !result;
  discardButton.disabled = !result;

  if (result) {
    lastProcessedImage = result;

    preview.render(result);

    imageSizeElement.textContent = `${result.width} × ${result.height}`;

    emptyPreview.hidden = true;
    previewCanvas.hidden = false;
  } else if (original) {
    preview.render(original);

    imageSizeElement.textContent = `${original.width} × ${original.height}`;

    emptyPreview.hidden = true;
    previewCanvas.hidden = false;
  } else {
    previewCanvas.hidden = true;
    emptyPreview.hidden = false;
    imageSizeElement.textContent = "No image";
  }

  switch (state.processing.status) {
    case "idle":
      if (original) {
        setStatus("Ready.");
      }
      break;

    case "processing":
      setStatus("Processing…");
      break;

    case "success":
      setStatus("Processing complete.");
      break;

    case "error":
      setStatus(state.processing.error?.message ?? "Processing failed.", true);
      break;

    default:
      break;
  }
}

function updateDitherStrengthLabel() {
  if (!ditherStrengthValue) {
    return;
  }

  const options = controls.getOptions();

  ditherStrengthValue.textContent = String(options.dither.strength);
}

async function loadImageFile(file) {
  if (!(file instanceof File)) {
    throw new TypeError("Expected an image file.");
  }

  if (!file.type.startsWith("image/")) {
    throw new TypeError("The selected file is not an image.");
  }

  if (typeof createImageBitmap !== "function") {
    throw new TypeError("Image loading is not supported by this browser.");
  }

  const bitmap = await createImageBitmap(file);

  try {
    if (bitmap.width <= 0 || bitmap.height <= 0) {
      throw new Error("The image has invalid dimensions.");
    }

    const canvas = document.createElement("canvas");

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("Unable to create a 2D canvas context.");
    }

    context.drawImage(bitmap, 0, 0);

    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);

    return ImageDataBuffer.fromImageData(imageData);
  } finally {
    bitmap.close();
  }
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.dataset.error = isError ? "true" : "false";
}

function validateRequiredElement(element, selector) {
  if (!element) {
    throw new Error(`Required element "${selector}" was not found.`);
  }
}
