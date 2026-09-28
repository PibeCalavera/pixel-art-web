# Pixel Art Web

A small image-processing web app created as a personal project to experiment
with image-processing concepts and generate reference images for pixel art.

The main goal is not to create pixel art directly, but to produce simplified
images that can be used as visual references when creating pixel art.

## Features

- Image resizing
- Color quantization
- Color palettes
- Multiple dithering algorithms
- Real-time preview
- PNG export
- Image processing using a Web Worker

### Dithering Algorithms

- None
- Bayer
- Floyd-Steinberg
- Atkinson
- Pair dithering

Pair dithering is a custom algorithm designed to expand the perceived range of a
small color palette. It combines colors available in the palette to create the
perception of colors that are not directly available.

It is currently quite slow and still has room for improvement.

## Tech Stack

- JavaScript
- HTML
- CSS
- Canvas API
- Web Workers
- Vite
- Vitest

## Getting Started

### Requirements

- Node.js
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

### Tests

```bash
npm test
```

## Project Structure

```text
src/
├── app/          Application state and setup
├── data/         Palettes and other data
├── processing/   Image-processing algorithms
├── ui/           User interface
├── worker/       Background image processing
└── main.js       Application entry point

styles/           Application styles
tests/            Test suite
index.html        Application entry point
```

## Status

This is a personal project created for learning, experimentation, and my pixel
art workflow.

There are still many things that could be improved. The pair dithering algorithm
in particular is currently quite slow. For now, further development of that
algorithm is not a priority.

## Author

Created as a personal project and portfolio piece.
