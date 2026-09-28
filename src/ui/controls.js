export function createControls(root, { palettes = [] } = {}) {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError("Controls require an HTMLElement root.");
  }

  const elements = {
    resizeAlgorithm: root.querySelector('[data-control="resize-algorithm"]'),

    targetWidth: root.querySelector('[data-control="target-width"]'),

    targetHeight: root.querySelector('[data-control="target-height"]'),

    quantizationAlgorithm: root.querySelector(
      '[data-control="quantization-algorithm"]',
    ),

    palette: root.querySelector('[data-control="palette"]'),

    ditherAlgorithm: root.querySelector('[data-control="dither-algorithm"]'),

    ditherStrength: root.querySelector('[data-control="dither-strength"]'),

    bayerMatrixSize: root.querySelector('[data-control="bayer-matrix-size"]'),

    realtimePreview: root.querySelector('[data-control="realtime-preview"]'),
  };

  populatePaletteSelect(elements.palette, palettes);

  return {
    getOptions,
    setOptions,
    getRealtimePreview,
    setRealtimePreview,
    onChange,
  };

  function getOptions() {
    const paletteId = getValue(elements.palette, null);

    return {
      resize: {
        algorithm: getValue(elements.resizeAlgorithm, "nearest"),
        width: getPositiveInteger(elements.targetWidth, null),
        height: getPositiveInteger(elements.targetHeight, null),
      },

      quantize: {
        algorithm: getValue(elements.quantizationAlgorithm, "nearest"),
        palette: paletteId,
      },

      dither: {
        algorithm: getValue(elements.ditherAlgorithm, "none"),
        strength: getNumber(elements.ditherStrength, 1),

        /*
         * Bayer matrix size is kept as a separate option
         * because it configures the Bayer algorithm.
         */
        matrixSize: getPositiveInteger(elements.bayerMatrixSize, 4),

        palette: paletteId,
      },
    };
  }

  function setOptions(options = {}) {
    if (!options || typeof options !== "object") {
      throw new TypeError("Options must be an object.");
    }

    if (options.resize) {
      setValue(elements.resizeAlgorithm, options.resize.algorithm);

      setValue(elements.targetWidth, options.resize.width);

      setValue(elements.targetHeight, options.resize.height);
    }

    if (options.quantize) {
      setValue(elements.quantizationAlgorithm, options.quantize.algorithm);
    }

    if (options.dither) {
      setValue(elements.ditherAlgorithm, options.dither.algorithm);

      setValue(elements.ditherStrength, options.dither.strength);

      /*
       * Restore the selected Bayer matrix size when provided.
       */
      setValue(elements.bayerMatrixSize, options.dither.matrixSize);
    }

    const paletteId = options.quantize?.palette ?? options.dither?.palette;

    if (paletteId) {
      setValue(elements.palette, paletteId);
    }

    if (options.realtimePreview !== undefined) {
      setRealtimePreview(options.realtimePreview);
    }
  }

  function getRealtimePreview() {
    return elements.realtimePreview ? elements.realtimePreview.checked : false;
  }

  function setRealtimePreview(enabled) {
    if (!elements.realtimePreview) {
      return;
    }

    elements.realtimePreview.checked = Boolean(enabled);
  }

  function onChange(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Listener must be a function.");
    }

    const cleanups = [];

    for (const element of Object.values(elements)) {
      if (!element) {
        continue;
      }

      element.addEventListener("change", listener);

      cleanups.push(() => element.removeEventListener("change", listener));
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }
}

function populatePaletteSelect(select, palettes) {
  if (!select) {
    return;
  }

  if (!Array.isArray(palettes)) {
    throw new TypeError("Palettes must be an array.");
  }

  select.replaceChildren();

  const grouped = groupPalettesByCategory(palettes);

  for (const [category, definitions] of grouped) {
    const group = document.createElement("optgroup");

    group.label = formatCategoryName(category);

    for (const palette of definitions) {
      const option = document.createElement("option");

      option.value = palette.id;

      option.textContent = createPaletteLabel(palette);

      if (palette.description) {
        option.title = palette.description;
      }

      group.appendChild(option);
    }

    select.appendChild(group);
  }

  if (select.options.length > 0) {
    select.selectedIndex = 0;
  }
}

function groupPalettesByCategory(palettes) {
  const groups = new Map();

  for (const palette of palettes) {
    if (!palette || typeof palette !== "object") {
      continue;
    }

    const category = palette.category ?? "other";

    if (!groups.has(category)) {
      groups.set(category, []);
    }

    groups.get(category).push(palette);
  }

  return groups;
}

function createPaletteLabel(palette) {
  const colorCount =
    Number.isInteger(palette.colorCount) && palette.colorCount > 0
      ? ` · ${palette.colorCount} colors`
      : "";

  return `${palette.name}${colorCount}`;
}

function formatCategoryName(category) {
  const labels = {
    console: "Consoles",
    computer: "Computers",
    "fantasy-console": "Fantasy consoles",
    artist: "Pixel art",
    other: "Other",
  };

  if (labels[category]) {
    return labels[category];
  }

  return String(category)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getValue(element, fallback) {
  if (!element || element.value === "") {
    return fallback;
  }

  return element.value;
}

function getPositiveInteger(element, fallback) {
  if (!element || element.value === "") {
    return fallback;
  }

  const value = Number(element.value);

  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function getNumber(element, fallback) {
  if (!element || element.value === "") {
    return fallback;
  }

  const value = Number(element.value);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function setValue(element, value) {
  if (!element || value === undefined || value === null) {
    return;
  }

  element.value = String(value);
}
