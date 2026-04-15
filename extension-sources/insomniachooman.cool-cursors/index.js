const CURSORS = [
  {
    id: "lavender",
    label: "Lavender",
    defaultImage: "cursors/lavender/default.png",
    clickImage: "cursors/lavender/pointer.png",
    hotspot: { x: 0.08, y: 0.08 },
  },
  {
    id: "parched",
    label: "Parched",
    defaultImage: "cursors/parched/default.png",
    clickImage: "cursors/parched/pointer.png",
    hotspot: { x: 0.08, y: 0.08 },
  },
  {
    id: "chooper",
    label: "Chooper",
    defaultImage: "cursors/chooper/default.png",
    clickImage: "cursors/chooper/pointer.png",
    hotspot: { x: 0.08, y: 0.08 },
  },
  {
    id: "amongus",
    label: "Among Us",
    defaultImage: "cursors/amongus/default.png",
    clickImage: "cursors/amongus/pointer.png",
    hotspot: { x: 0.5, y: 0.5 },
  },
  {
    id: "turtle",
    label: "Turtle",
    defaultImage: "cursors/turtle/default.png",
    clickImage: "cursors/turtle/pointer.png",
    hotspot: { x: 0.5, y: 0.5 },
  },
];

export function activate(api) {
  for (const cursor of CURSORS) {
    api.registerCursorStyle(cursor);
  }
}

export function deactivate() {}
