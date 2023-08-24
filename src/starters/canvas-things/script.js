import * as Dom from '../../ixfx/dom.js';
import { randomElement } from '../../ixfx/arrays.js';
import { continuously } from '../../ixfx/flow.js';

/**
 * Define our 'thing' (this is optional) which consists of 
 * scale,x,y,created and msg fields
 * @typedef {{
 *  x:number, 
 *  y:number, 
 *  scale:number, 
 *  msg:string, 
 *  created:number}} Thing
 */

// Define settings
const settings = Object.freeze({
  msgs: [ `🍎`, `🍏`, `🐈`, `🐝`, `🛹`, `🪂`, `🛰️`, `🦖`, `🐒` ],
  max: 10,
  addIntervalMs: 1000,
  // How much to let thing fall off edge before resetting it
  // This is needed or things can be reset too early
  edgeMax: 1.1,
  // Value to reset thing to if it goes past max
  edgeMin: -0.1,
  xSpeed: 0.01,
  ySpeed: 0.001,
  /** @type {HTMLCanvasElement|null} */
  canvasEl: document.querySelector(`#canvas`)
});

// Initial state with empty values
let state = Object.freeze({
  bounds: {
    width: 0,
    height: 0,
    center: { x: 0, y: 0 }
  },
  /** @type number */
  ticks: 0,
  /** @type Thing[] */
  things: []
});

/**
 * Adds a thing.
 * @param {Thing} t 
 */
const addThing = (t) => {
  updateState({ things: [ ...state.things, Object.freeze(t) ] });
};

/**
 * Adds a random thing
 */
const addRandomThing = () => {
  addThing({
    scale: Math.random(),
    x: Math.random(),
    y: Math.random(),
    created: Date.now(),
    msg: randomElement(settings.msgs)
  });
};

/**
 * Deletes a thing
 * @param {Thing} t 
 */
const deleteThing = (t) => {
  updateState({
    things: state.things.filter(v => v !== t)
  });
};

/**
 * Returns all things younger than given milliseconds.
 * It assumes things have a `created` field
 * @param {Thing[]} things
 * @param {number} milliseconds 
 */
const deleteOlderThan = (things, milliseconds) => {
  const cutoff = Date.now() - milliseconds;
  return things.filter(v => v.created >= cutoff);
};

/**
 * Updates a single thing, returning a changed copy
 * @param {Thing} t 
 * @returns {Thing}
 */
const updateThing = (t) => {
  const { edgeMax, edgeMin, xSpeed, ySpeed } = settings;

  // Drift thing across screen (using relative coordinates)
  let x = t.x + xSpeed;
  if (x > edgeMax) {
    x = edgeMin; // Reset x
  }

  let y = t.y + ySpeed;
  if (y > edgeMax) {
    x = y = edgeMin; // Reset x & y
  }
  return Object.freeze({ ...t, x, y });
};

/**
 * Draws a single thing
 * @param {CanvasRenderingContext2D} context 
 * @param {Thing} t 
 */
const drawThing = (context, t) => {
  const { bounds } = state;

  // Save state of drawing context before we translate
  context.save();

  // Translate, using absolute version of thing's x & y to be the origin
  context.translate(t.x * bounds.width, t.y * bounds.height);

  // This flips drawing operations so our emoji are pointing the right way
  context.scale(-1, 1);

  // Draw the 'msg' property of thing
  context.fillStyle = `black`;
  context.font = `${t.scale * 12}em Futura,Helvetica,Segoe,Arial`;
  context.textAlign = `center`;
  context.textBaseline = `top`;
  context.shadowBlur = 1;
  context.shadowColor = `gray`;
  context.shadowOffsetX = 5;
  context.shadowOffsetY = 5;
  context.fillText(t.msg, 0, 0);

  // Undo the translation
  context.restore();
};

// Update state of world
const update = () => {
  const ticks = state.ticks + 1;

  // Update things, creating new instances
  let things = state.things.map(t => updateThing(t));

  // Eg: delete things older than 1second
  // things = deleteOlderThan(things, 1000);

  updateState({ ticks, things });
};

const useState = () => {
  const { canvasEl } = settings;
  const { things } = state;

  // Get drawing context, or exit if element is missing
  const context = canvasEl?.getContext(`2d`);
  if (context === undefined || context === null) return;

  // Clear canvas
  clear(context);

  // Draw things
  for (const t of things) drawThing(context, t);

};

/**
 * Clear canvas
 * @param {CanvasRenderingContext2D} context 
 */
const clear = (context) => {
  const { width, height } = state.bounds;

  // Make background transparent
  context.clearRect(0, 0, width, height);

  // Clear with a colour
  //ctx.fillStyle = `orange`;
  //ctx.fillRect(0, 0, width, height);

  // Fade out previously painted pixels
  //ctx.fillStyle = `hsl(200, 100%, 50%, 0.1%)`;
  //ctx.fillRect(0, 0, width, height);
};

/**
 * Setup and run main loop 
 */
const setup = () => {
  const { canvasEl, addIntervalMs } = settings;

  // Keep our primary canvas full size
  if (canvasEl) {
    Dom.fullSizeCanvas(canvasEl, arguments_ => {
      updateState({
        bounds: arguments_.bounds
      });
    });
  }

  // Keep updating and using state
  continuously(() => {
    update();
    useState();
  }).start();

  // Every addIntervalMs add a thing if we're under the the max
  continuously(() => {
    const { max } = settings;
    if (state.things.length >= max) return;

    addRandomThing();
  }, addIntervalMs).start();
};
setup();

/**
 * Update state
 * @param {Partial<state>} s 
 */
function updateState (s) {
  state = Object.freeze({
    ...state,
    ...s
  });
}