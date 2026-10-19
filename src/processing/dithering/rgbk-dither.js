import { ImageDataBuffer } from "../image.js";

/**
 * Defines the valid subpixel configurations for the RGBK dithering algorithm.
 *
 * Each configuration represents a 2x2 output block using binary flags in the
 * following order: top-left (R), top-right (G), bottom-left (B1), and
 * bottom-right (B2). A value of `1` activates the corresponding color subpixel;
 * a value of `0` renders that position as black.
 *
 * Only configurations permitted by the algorithm's subpixel placement rules
 * are included.
 */
const COMBINATIONS = [
  [0, 0, 0, 0], // KKKK
  [0, 0, 1, 0], // KKBK
  [1, 0, 0, 0], // RKKK
  [1, 0, 1, 0], // RKBK
  [0, 1, 0, 0], // KGKK
  [0, 1, 0, 1], // KGKB
  [1, 1, 0, 0], // RGKK
  [1, 1, 1, 0], // RGBK
  [1, 1, 0, 1], // RGKB
  [1, 1, 1, 1], // RGBB
];

/** RGB channel values for the output subpixel colors. */
const BLACK = [0, 0, 0];
const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];

/** RGB values of the background used to remove source transparency. */
const BACKGROUND = [0, 0, 0];

/** Alpha value for every output pixel. */
const OPAQUE_ALPHA = 255;

/**
 * Maps each subpixel position to its corresponding RGB color.
 * The order must match the flag order used by `COMBINATIONS`.
 */
const SUBPIXEL_COLORS = [RED, GREEN, BLUE, BLUE];

/**
 * Converts an image into a 2x-resolution RGBK subpixel representation.
 *
 * Each source pixel is first composited over a solid white background using
 * its alpha value. The resulting opaque RGB color is then matched to the
 * closest valid subpixel configuration in linear-light RGB space.
 *
 * Each source pixel becomes a 2x2 output block containing red, green, blue,
 * or black subpixels. Every output pixel is fully opaque.
 *
 * @param {ImageDataBuffer} image - Source image containing RGBA pixel data.
 * @returns {ImageDataBuffer} A fully opaque image with twice the source width and height.
 * @throws {TypeError} If the input does not contain valid dimensions and RGBA data.
 */
export function ditherRetroRGBK(image) {
  if (
    !image ||
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width <= 0 ||
    image.height <= 0 ||
    !image.data ||
    image.data.length < image.width * image.height * 4
  ) {
    throw new TypeError(
      "Expected an image with valid width, height and RGBA data.",
    );
  }

  const { width, height, data } = image;
  const output = ImageDataBuffer.empty(width * 2, height * 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceIndex = (y * width + x) * 4;

      const r = data[sourceIndex];
      const g = data[sourceIndex + 1];
      const b = data[sourceIndex + 2];
      const alpha = data[sourceIndex + 3] / 255;

      // Composite the source pixel over the opaque background.
      const opaqueR = compositeChannel(r, BACKGROUND[0], alpha);
      const opaqueG = compositeChannel(g, BACKGROUND[1], alpha);
      const opaqueB = compositeChannel(b, BACKGROUND[2], alpha);

      const combination = findClosestCombination(opaqueR, opaqueG, opaqueB);

      const outputX = x * 2;
      const outputY = y * 2;

      // Top-left subpixel: red when enabled; otherwise black.
      writePixel(output, outputX, outputY, combination[0] ? RED : BLACK);

      // Top-right subpixel: green when enabled; otherwise black.
      writePixel(output, outputX + 1, outputY, combination[1] ? GREEN : BLACK);

      // Bottom-left subpixel: blue when enabled; otherwise black.
      writePixel(output, outputX, outputY + 1, combination[2] ? BLUE : BLACK);

      // Bottom-right subpixel: blue when enabled; otherwise black.
      writePixel(
        output,
        outputX + 1,
        outputY + 1,
        combination[3] ? BLUE : BLACK,
      );
    }
  }

  return output;
}

/**
 * Composites a source channel over a background channel.
 *
 * @param {number} source - Source channel value in the range 0–255.
 * @param {number} background - Background channel value in the range 0–255.
 * @param {number} alpha - Normalized source alpha in the range 0–1.
 * @returns {number} The composited channel value, rounded to an integer.
 */
function compositeChannel(source, background, alpha) {
  return Math.round(source * alpha + background * (1 - alpha));
}

/**
 * Selects the valid subpixel configuration with the smallest squared
 * Euclidean distance from the source color in linear-light RGB space.
 *
 * Converting sRGB channel values to linear light before comparison makes
 * the distance calculation better reflect differences in emitted light.
 * If multiple configurations have the same distance, the first one in
 * `COMBINATIONS` is retained.
 *
 * @param {number} r - Source red channel value in the range 0–255.
 * @param {number} g - Source green channel value in the range 0–255.
 * @param {number} b - Source blue channel value in the range 0–255.
 * @returns {number[]} The selected four-flag subpixel configuration.
 */
function findClosestCombination(r, g, b) {
  const target = [
    srgbToLinear(r / 255),
    srgbToLinear(g / 255),
    srgbToLinear(b / 255),
  ];

  let bestCombination = COMBINATIONS[0];
  let bestDistance = Infinity;

  for (const combination of COMBINATIONS) {
    const candidate = getAverageColor(combination);

    const dr = target[0] - candidate[0];
    const dg = target[1] - candidate[1];
    const db = target[2] - candidate[2];

    const distance = dr * dr + dg * dg + db * db;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestCombination = combination;
    }
  }

  return bestCombination;
}

/**
 * Calculates the average linear-light RGB contribution of a 2x2 subpixel block.
 *
 * Each active subpixel contributes one quarter of its linear-light color,
 * corresponding to its share of the four positions in the output block.
 * Disabled subpixels contribute zero because they render as black.
 *
 * @param {number[]} combination - Four binary flags in the order defined by `COMBINATIONS`.
 * @returns {number[]} Average linear-light RGB values, normalized to the range 0–1.
 */
function getAverageColor(combination) {
  const result = [0, 0, 0];

  for (let i = 0; i < combination.length; i++) {
    if (!combination[i]) {
      continue;
    }

    const color = SUBPIXEL_COLORS[i];

    result[0] += srgbToLinear(color[0] / 255) / 4;
    result[1] += srgbToLinear(color[1] / 255) / 4;
    result[2] += srgbToLinear(color[2] / 255) / 4;
  }

  return result;
}

/**
 * Converts a normalized sRGB channel value to linear-light intensity.
 *
 * Applies the inverse sRGB transfer function. Input and output values are
 * expected to be normalized to the range 0–1.
 *
 * @param {number} value - Normalized sRGB channel value.
 * @returns {number} Corresponding linear-light intensity.
 */
function srgbToLinear(value) {
  if (value <= 0.04045) {
    return value / 12.92;
  }

  return ((value + 0.055) / 1.055) ** 2.4;
}

/**
 * Writes a fully opaque RGB pixel to the output image buffer.
 *
 * Coordinates are expressed in output-image pixels. The caller is responsible
 * for supplying valid coordinates and channel values.
 *
 * @param {ImageDataBuffer} output - Destination image buffer.
 * @param {number} x - Horizontal output coordinate.
 * @param {number} y - Vertical output coordinate.
 * @param {number[]} color - RGB channel values for the pixel.
 */
function writePixel(output, x, y, color) {
  const index = (y * output.width + x) * 4;

  output.data[index] = color[0];
  output.data[index + 1] = color[1];
  output.data[index + 2] = color[2];
  output.data[index + 3] = OPAQUE_ALPHA;
}
